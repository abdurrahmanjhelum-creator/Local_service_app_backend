const app = require('../src/server');

module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error('Vercel serverless execution error:', error);
    res.status(500).json({ error: error.message || 'Serverless Execution Error' });
  }
};
