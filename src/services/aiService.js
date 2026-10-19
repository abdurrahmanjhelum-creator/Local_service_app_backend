/**
 * Production AI layer for LocalServe.
 * - Uses local Python AI service (ensemble classifier, no external APIs)
 * - Rule-based fallback for when Python service is unavailable
 * - NO external API dependencies (Gemini/OpenAI removed)
 */

const CATEGORIES = [
  'Electrician',
  'Plumber',
  'AC Repair',
  'Carpenter',
  'Painter',
  'Cleaner',
];

// Python AI service endpoint (local deployment)
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

const FAQ_KB = [
  {
    q: ['book', 'booking', 'how to book', 'schedule'],
    a: 'Open Services → choose a provider → Book Now → pick date/time and address → confirm. Pay cash after the job is done.',
  },
  {
    q: ['cancel', 'cancellation'],
    a: 'Open Bookings → select your booking → Cancel. Providers may also reject a request. Cancelled slots are released automatically.',
  },
  {
    q: ['otp', 'complete', 'completion', 'verify'],
    a: 'When a provider accepts, you get a 4-digit job code by email. Share it only after work is 100% done so they can mark the booking completed.',
  },
  {
    q: ['pay', 'payment', 'cash', 'price', 'cost'],
    a: 'Payments are cash-on-service. Starting prices are shown on each provider card. There is no in-app card checkout yet.',
  },
  {
    q: ['chat', 'message', 'talk'],
    a: 'Open Messages (or a provider profile → Message) to chat about timing, location, or job details.',
  },
  {
    q: ['notification', 'alert', 'bell'],
    a: 'Booking and chat alerts appear automatically. Full history is under Profile → Notification history.',
  },
  {
    q: ['provider', 'become', 'register', 'sign up'],
    a: 'On signup choose Provider, verify email OTP, then set category, price, and location so customers can find you.',
  },
  {
    q: ['availability', 'calendar', 'slot'],
    a: 'Providers set free slots in Availability calendar. Customers only book open times.',
  },
  {
    q: ['invoice', 'receipt', 'bill'],
    a: 'After a completed booking, open booking details → Download Invoice to get a PDF receipt.',
  },
  {
    q: ['hello', 'hi', 'help', 'support'],
    a: 'Hi! I am LocalServe Assistant. Ask about booking, payments, chat, cancellations, or finding a provider.',
  },
];

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const detectCategory = (text = '') => {
  const t = text.toLowerCase();
  const map = [
    [/electr|wiring|fan|switch|light|socket/, 'Electrician'],
    [/plumb|pipe|leak|tap|toilet|drain|water/, 'Plumber'],
    [/ac\b|air.?cond|cooling|hvac/, 'AC Repair'],
    [/carpent|wood|door|cabinet|furniture/, 'Carpenter'],
    [/paint|wall.?paint|color/, 'Painter'],
    [/clean|maid|dust|mop/, 'Cleaner'],
  ];
  for (const [re, cat] of map) {
    if (re.test(t)) return cat;
  }
  for (const cat of CATEGORIES) {
    if (t.includes(cat.toLowerCase())) return cat;
  }
  return null;
};

const parseSearchIntentRuleBased = (query = '') => {
  const text = String(query).trim();
  const lower = text.toLowerCase();
  const intent = {
    query: text,
    category: detectCategory(text),
    minPrice: null,
    maxPrice: null,
    minRating: null,
    isAvailable: true,
    sortBy: 'ai_score',
    keywords: [],
  };

  const under = lower.match(/(?:under|below|max|less than)\s*(?:rs\.?|pkr)?\s*(\d+)/);
  if (under) intent.maxPrice = Number(under[1]);

  const above = lower.match(/(?:above|over|min|more than)\s*(?:rs\.?|pkr)?\s*(\d+)/);
  if (above) intent.minPrice = Number(above[1]);

  if (/available|now|today|nearby/.test(lower)) intent.isAvailable = true;
  if (/top|best|highest.?rated/.test(lower)) {
    intent.minRating = 4;
    intent.sortBy = 'rating';
  }
  if (/cheap|budget|affordable|low.?price/.test(lower)) intent.sortBy = 'price_asc';

  return intent;
};

const answerFaqRuleBased = (question = '') => {
  const q = question.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const item of FAQ_KB) {
    let score = 0;
    for (const kw of item.q) {
      if (q.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (best && bestScore > 0) {
    return {
      answer: best.a,
      source: 'knowledge_base',
      confidence: Math.min(0.95, 0.55 + bestScore / 40),
    };
  }
  return {
    answer:
      'I can help with booking, cancellations, payments (cash), chat, OTP completion, invoices, and finding providers. Try asking: “How do I book a plumber?”',
    source: 'fallback',
    confidence: 0.35,
  };
};

const scoreProvider = (p, opts = {}) => {
  let score = 0;
  const reasons = [];

  if (opts.category) {
    const cat = (p.category || '').toLowerCase();
    if (cat.includes(String(opts.category).toLowerCase())) {
      score += 40;
      reasons.push(`Matches ${opts.category}`);
    }
  } else {
    score += 10;
  }

  if (p.isAvailable) {
    score += 20;
    reasons.push('Available now');
  }

  const rating = Number(p.rating) || 0;
  score += Math.min(20, rating * 4);
  if (rating >= 4) reasons.push(`Rated ${rating.toFixed(1)}`);

  if (p.isVerified) {
    score += 8;
    reasons.push('Verified');
  }

  const price = Number(p.priceStarting) || 0;
  if (opts.maxPrice != null && price > 0 && price <= opts.maxPrice) {
    score += 10;
    reasons.push(`Within budget`);
  }
  if (opts.minPrice != null && price >= opts.minPrice) score += 4;

  if (
    opts.latitude != null &&
    opts.longitude != null &&
    p.latitude != null &&
    p.longitude != null
  ) {
    const km = haversineKm(
      Number(opts.latitude),
      Number(opts.longitude),
      Number(p.latitude),
      Number(p.longitude)
    );
    p._distanceKm = Math.round(km * 10) / 10;
    if (km <= 5) {
      score += 15;
      reasons.push(`${p._distanceKm} km away`);
    } else if (km <= 15) {
      score += 8;
      reasons.push(`${p._distanceKm} km away`);
    } else if (km <= 40) {
      score += 3;
    }
  }

  const exp = Number(p.experienceYears) || 0;
  if (exp >= 3) {
    score += 5;
    reasons.push(`${exp}+ yrs experience`);
  }

  return { score, reasons };
};

async function callPythonAi(endpoint, payload) {
  /**
   * Call local Python AI service for advanced ML predictions.
   * Uses ensemble classifier trained on app data - no external APIs.
   */
  if (process.env.VERCEL) return null;

  try {
    const url = `${PYTHON_AI_URL}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`Python AI service returned ${res.status}, using fallback`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.warn('Python AI service unavailable, using rule-based fallback:', error.message);
    return null;
  }
}

async function parseSearchIntent(query) {
  const fallback = parseSearchIntentRuleBased(query);

  // Try Python AI service for better intent classification
  try {
    const pythonResult = await callPythonAi('/predict', { text: query });

    if (pythonResult && pythonResult.intent) {
      // Map Python AI intent to search parameters
      const intentMap = {
        'find_provider': {
          category: detectCategory(query),
          isAvailable: true,
          sortBy: 'ai_score',
        },
        'book_service': {
          category: detectCategory(query),
          isAvailable: true,
          sortBy: 'ai_score',
        },
        'cancel_booking': {
          isAvailable: false,
          sortBy: 'ai_score',
        },
      };

      const mapped = intentMap[pythonResult.intent] || {};
      return {
        query,
        category: mapped.category || fallback.category,
        minPrice: fallback.minPrice,
        maxPrice: fallback.maxPrice,
        minRating: fallback.minRating,
        isAvailable: mapped.isAvailable ?? fallback.isAvailable,
        sortBy: mapped.sortBy || fallback.sortBy,
        keywords: [],
        engine: 'python_ai+rules',
        confidence: pythonResult.confidence,
      };
    }
  } catch (error) {
    console.warn('Python AI intent classification failed:', error.message);
  }

  return { ...fallback, engine: 'rules' };
}

async function answerFaq(question) {
  const fallback = answerFaqRuleBased(question);

  // Try Python AI service for better FAQ answers
  try {
    const pythonResult = await callPythonAi('/chat', { text: question });

    if (pythonResult && pythonResult.answer) {
      return {
        answer: pythonResult.answer,
        confidence: 0.85, // High confidence for Python AI
        source: 'python_ai',
        engine: 'python_ai',
      };
    }
  } catch (error) {
    console.warn('Python AI FAQ answering failed:', error.message);
  }

  return { ...fallback, engine: 'rules' };
}

/**
 * Get provider recommendations from Python AI service.
 * Uses custom recommendation engine trained on app data.
 */
async function getRecommendations(options = {}) {
  const {
    category,
    latitude,
    longitude,
    budget_max,
    min_rating = 0,
    limit = 10,
  } = options;

  try {
    const pythonResult = await callPythonAi('/recommend', {
      category,
      latitude,
      longitude,
      budget_max,
      min_rating,
      limit,
    });

    if (pythonResult && pythonResult.recommendations) {
      return {
        success: true,
        recommendations: pythonResult.recommendations,
        category: pythonResult.category,
        count: pythonResult.count,
        engine: 'python_ai',
      };
    }
  } catch (error) {
    console.warn('Python AI recommendation failed:', error.message);
  }

  // Fallback: return empty (recommendations handled by controller logic)
  return {
    success: false,
    recommendations: [],
    engine: 'fallback',
  };
}

/**
 * Analyze sentiment of text using Python AI service.
 * Uses local sentiment analyzer trained on reviews.
 */
async function analyzeSentiment(text) {
  try {
    const pythonResult = await callPythonAi('/sentiment', { text });

    if (pythonResult) {
      return {
        sentiment: pythonResult.sentiment,
        confidence: pythonResult.confidence,
        probabilities: pythonResult.probabilities,
        engine: 'python_ai',
      };
    }
  } catch (error) {
    console.warn('Python AI sentiment analysis failed:', error.message);
  }

  // Simple rule-based fallback
  const lower = text.toLowerCase();
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'nice', 'acha', 'accha', 'behtareen'];
  const negativeWords = ['bad', 'terrible', 'worst', 'awful', 'bekaar', 'bura', 'ghatiya'];

  const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

  let sentiment = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';

  return {
    sentiment,
    confidence: 0.6,
    engine: 'rules',
  };
}

module.exports = {
  CATEGORIES,
  detectCategory,
  parseSearchIntent,
  parseSearchIntentRuleBased,
  answerFaq,
  answerFaqRuleBased,
  scoreProvider,
  haversineKm,
  // New advanced functions
  getRecommendations,
  analyzeSentiment,
};
