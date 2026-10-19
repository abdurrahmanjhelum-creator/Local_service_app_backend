const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const { parseSearchIntent } = require('../src/services/aiService');
const {
  aiHealth,
  faqBot,
  recommendProviders,
} = require('../src/controllers/aiController');

test('FAQ accepts the Flutter text payload and returns compatible model metadata', async () => {
  const originalFetch = global.fetch;
  let pythonRequest;
  global.fetch = async (url, options) => {
    pythonRequest = { url, options };
    return new Response(
      JSON.stringify({
        answer: 'Services kholein aur Book Now dabayein.',
        model: 'test-knowledge-model',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  try {
    await faqBot({ body: { text: 'How do I book a service?' } }, response);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.answer, 'Services kholein aur Book Now dabayein.');
  assert.equal(response.body.engine, 'python_ai');
  assert.equal(response.body.model, 'python_ai');
  assert.equal(
    JSON.parse(pythonRequest.options.body).text,
    'How do I book a service?',
  );
  assert.ok(pythonRequest.options.signal instanceof AbortSignal);
});

test('AI health reports the Python service as degraded when it is unavailable', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('connection refused');
  };

  const response = {
    json(body) {
      this.body = body;
      return this;
    },
  };

  try {
    await aiHealth({}, response);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(response.body.status, 'degraded');
  assert.equal(response.body.python_ai_status, 'unavailable');
  assert.equal(response.body.python_ai_error, 'connection refused');
});

test('serverless search uses the local rules fallback without calling localhost Python', async () => {
  const originalVercel = process.env.VERCEL;
  const originalFetch = global.fetch;
  process.env.VERCEL = '1';
  global.fetch = async () => {
    throw new Error('Serverless search must not call a local Python service.');
  };

  try {
    const intent = await parseSearchIntent('plumber under 500');
    assert.equal(intent.engine, 'rules');
    assert.equal(intent.category, 'Plumber');
    assert.equal(intent.maxPrice, 500);
  } finally {
    global.fetch = originalFetch;
    if (originalVercel == null) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

test('recommendations rank live provider records without Python AI', async () => {
  const originalFind = User.find;
  let providerQuery;
  User.find = (query) => {
    providerQuery = query;
    return {
      select() {
        return this;
      },
      lean: async () => [
        {
          _id: 'plumber-1',
          name: 'Local Plumber',
          role: 'provider',
          category: 'Plumber',
          priceStarting: 250,
          experienceYears: 5,
          rating: 4.8,
          isAvailable: true,
          isVerified: true,
          latitude: 33.651,
          longitude: 73.081,
        },
      ],
    };
  };

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  try {
    await recommendProviders(
      {
        body: {
          category: 'Plumber',
          latitude: 33.65,
          longitude: 73.08,
          budget_max: 500,
          min_rating: 4,
          limit: 5,
        },
      },
      response,
    );
  } finally {
    User.find = originalFind;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(providerQuery.category.$regex, 'Plumber');
  assert.equal(providerQuery.priceStarting.$lte, 500);
  assert.equal(providerQuery.rating.$gte, 4);
  assert.equal(response.body.engine, 'live_provider_ranking');
  assert.equal(response.body.count, 1);
  assert.equal(response.body.recommendations[0].name, 'Local Plumber');
  assert.ok(response.body.recommendations[0].aiScore > 0);
});
