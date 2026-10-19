const User = require('../models/User');
const {
  parseSearchIntent,
  answerFaq,
  scoreProvider,
  detectCategory,
  CATEGORIES,
  analyzeSentiment,
} = require('../services/aiService');

const publicProvider = (doc, extra = {}) => {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    _id: o._id,
    id: o._id?.toString?.() || o.id,
    name: o.name,
    email: o.email,
    phone: o.phone,
    role: o.role,
    category: o.category,
    priceStarting: o.priceStarting,
    experienceYears: o.experienceYears,
    rating: o.rating,
    isAvailable: o.isAvailable,
    isVerified: o.isVerified,
    profileImage: o.profileImage,
    address: o.address,
    latitude: o.latitude,
    longitude: o.longitude,
    serviceRadius: o.serviceRadius,
    ...extra,
  };
};

const loadProviders = async (filters = {}) => {
  const query = { role: 'provider' };

  if (filters.category) {
    const escaped = String(filters.category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.category = { $regex: escaped, $options: 'i' };
  }
  if (filters.isAvailable === true) query.isAvailable = true;
  if (filters.minPrice != null || filters.maxPrice != null) {
    query.priceStarting = {};
    if (filters.minPrice != null) query.priceStarting.$gte = Number(filters.minPrice);
    if (filters.maxPrice != null) query.priceStarting.$lte = Number(filters.maxPrice);
  }
  if (filters.minRating != null) {
    query.rating = { $gte: Number(filters.minRating) };
  }
  if (filters.search && String(filters.search).trim()) {
    const s = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { category: { $regex: s, $options: 'i' } },
    ];
  }

  return User.find(query).select('-password -fcmToken -otp').lean();
};

const rankProviders = (providers, opts) => {
  return providers
    .map((p) => {
      const { score, reasons } = scoreProvider(p, opts);
      return publicProvider(p, {
        aiScore: Math.round(score * 10) / 10,
        matchReasons: reasons,
        distanceKm: p._distanceKm ?? null,
      });
    })
    .sort((a, b) => {
      if (opts.sortBy === 'price_asc') {
        return (a.priceStarting || 0) - (b.priceStarting || 0);
      }
      if (opts.sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      return (b.aiScore || 0) - (a.aiScore || 0);
    });
};

// POST/GET /api/ai/match
const matchProviders = async (req, res) => {
  try {
    const body = { ...(req.query || {}), ...(req.body || {}) };
    const category =
      body.category ||
      detectCategory(body.query || body.need || '') ||
      null;
    const latitude = body.latitude != null && body.latitude !== ''
      ? Number(body.latitude)
      : null;
    const longitude = body.longitude != null && body.longitude !== ''
      ? Number(body.longitude)
      : null;
    const limit = Math.min(parseInt(body.limit || 20, 10), 50);

    const providers = await loadProviders({
      category,
      isAvailable: body.isAvailable !== false,
      minPrice: body.minPrice,
      maxPrice: body.maxPrice,
      minRating: body.minRating,
    });

    const ranked = rankProviders(providers, {
      category,
      latitude,
      longitude,
      minPrice: body.minPrice,
      maxPrice: body.maxPrice,
      sortBy: body.sortBy || 'ai_score',
    }).slice(0, limit);

    res.json({
      success: true,
      engine: 'ai_matching_v1',
      filters: { category, latitude, longitude },
      count: ranked.length,
      providers: ranked,
      categories: CATEGORIES,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/search
const smartSearch = async (req, res) => {
  try {
    const query = (req.body?.query || req.body?.q || '').toString().trim();
    if (!query) {
      return res.status(400).json({ success: false, message: 'query is required' });
    }

    const intent = await parseSearchIntent(query);
    const latitude =
      req.body?.latitude != null ? Number(req.body.latitude) : null;
    const longitude =
      req.body?.longitude != null ? Number(req.body.longitude) : null;
    const limit = Math.min(parseInt(req.body?.limit || 20, 10), 50);

    let providers = await loadProviders({
      category: intent.category,
      isAvailable: intent.isAvailable,
      minPrice: intent.minPrice,
      maxPrice: intent.maxPrice,
      minRating: intent.minRating,
      search: intent.category ? null : query,
    });

    // If category filter returned empty, broaden search
    if (providers.length === 0) {
      providers = await loadProviders({ search: query });
    }

    const ranked = rankProviders(providers, {
      category: intent.category,
      latitude,
      longitude,
      minPrice: intent.minPrice,
      maxPrice: intent.maxPrice,
      sortBy: intent.sortBy || 'ai_score',
    }).slice(0, limit);

    res.json({
      success: true,
      intent,
      count: ranked.length,
      providers: ranked,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/faq
const faqBot = async (req, res) => {
  try {
    const question = (req.body?.text || req.body?.question || req.body?.message || '')
      .toString()
      .trim();
    if (!question) {
      return res.status(400).json({ success: false, message: 'question is required' });
    }

    const result = await answerFaq(question);
    res.json({
      success: true,
      question,
      answer: result.answer,
      confidence: result.confidence,
      source: result.source,
      engine: result.engine,
      model: result.engine,
      suggestions: [
        'How do I book a service?',
        'How does payment work?',
        'How do I cancel a booking?',
        'Find a plumber near me',
      ],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ai/health
const aiHealth = async (_req, res) => {
  const pythonAiUrl = process.env.PYTHON_AI_URL || 'http://localhost:8000';
  let pythonAiStatus = 'unavailable';
  let pythonAiError = null;

  try {
    const response = await fetch(`${pythonAiUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      pythonAiStatus = 'available';
    } else {
      pythonAiError = `Health check returned HTTP ${response.status}`;
    }
  } catch (error) {
    pythonAiError = error.message;
  }

  res.json({
    status: pythonAiStatus === 'available' ? 'ok' : 'degraded',
    mode: 'local_ml',
    python_ai: pythonAiUrl,
    python_ai_status: pythonAiStatus,
    python_ai_error: pythonAiError,
    features: ['match', 'search', 'faq', 'recommend', 'sentiment'],
    external_apis: 'none - purely local ML',
  });
};

// POST /api/ai/recommend
const recommendProviders = async (req, res) => {
  try {
    const body = req.body || {};
    const category = String(body.category || '').trim();

    if (!category) {
      return res.status(400).json({ success: false, message: 'category is required' });
    }

    const parseOptionalNumber = (value) => {
      if (value == null || value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : NaN;
    };
    const parsedLatitude = parseOptionalNumber(body.latitude);
    const parsedLongitude = parseOptionalNumber(body.longitude);
    const maxPrice = parseOptionalNumber(body.budget_max);
    const minRating = parseOptionalNumber(body.min_rating);
    const parsedLimit = Number.parseInt(body.limit || 10, 10);

    if (
      Number.isNaN(parsedLatitude) ||
      Number.isNaN(parsedLongitude) ||
      Number.isNaN(maxPrice) ||
      Number.isNaN(minRating) ||
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      (parsedLatitude != null && (parsedLatitude < -90 || parsedLatitude > 90)) ||
      (parsedLongitude != null && (parsedLongitude < -180 || parsedLongitude > 180)) ||
      (maxPrice != null && maxPrice < 0) ||
      (minRating != null && (minRating < 0 || minRating > 5))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recommendation filters.',
      });
    }

    const providers = await loadProviders({
      category,
      isAvailable: true,
      maxPrice,
      minRating,
    });
    const recommendations = rankProviders(providers, {
      category,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      maxPrice,
      sortBy: 'ai_score',
    }).slice(0, Math.min(parsedLimit, 50));

    res.json({
      success: true,
      recommendations,
      category,
      count: recommendations.length,
      engine: 'live_provider_ranking',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/sentiment
const analyzeTextSentiment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'text is required' });
    }

    const result = await analyzeSentiment(text);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  matchProviders,
  smartSearch,
  faqBot,
  aiHealth,
  recommendProviders,
  analyzeTextSentiment,
};
