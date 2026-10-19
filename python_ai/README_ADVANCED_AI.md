# LocalServe Advanced AI System

## Overview

LocalServe AI uses local ML and rules without external APIs. The intent
classifier can include generated intent examples; provider recommendations
use an exported provider snapshot; sentiment uses synthetic examples from a
fixed word list, not live reviews.

## Key Features

### 1. **Ensemble Intent Classifier**
- **Multiple ML Algorithms**: SVM, Random Forest, and Naive Bayes
- **Voting Mechanism**: Combines predictions from all models for better accuracy
- **Enhanced Features**: Word n-grams, character n-grams, TF-IDF vectors
- **Trained On**: Base intents + App data from bookings and messages

### 2. **Custom Recommendation Engine**
- **Provider Ranking**: Exported provider features (rating, experience, price)
- **Location-Based**: Proximity scoring using Haversine distance
- **Current Scope**: Category, budget, rating, and location; no signed-in user
  history is passed to this API

### 3. **Sentiment Analyzer**
- **Review Analysis**: Detects positive/negative/neutral sentiment
- **Multi-Language**: Supports English and Roman Urdu
- **Training Source**: Logistic regression fitted to synthetic examples
  generated from a fixed sentiment-word list

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Flutter App                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js Backend API                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  aiService.js                                        │   │
│  │  - parseSearchIntent (→ Python AI)                  │   │
│  │  - answerFaq (→ Python AI)                          │   │
│  │  - getRecommendations (→ Python AI)                 │   │
│  │  - analyzeSentiment (→ Python AI)                   │   │
│  │  - Rule-based fallback                              │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Python AI Service (FastAPI)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  EnsembleIntentClassifier                            │   │
│  │  - SVM + RF + NB                                     │   │
│  │  - Trained on app data                               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  RecommendationEngine                                │   │
│  │  - Ranking exported provider features                │   │
│  │  - Location-based scoring                            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SentimentAnalyzer                                   │   │
│  │  - English + Roman Urdu                              │   │
│  │  - Synthetic rule-derived examples                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 MongoDB Database                            │
│  - Users (customers, providers)                            │
│  - Bookings                                                 │
│  - Reviews                                                  │
│  - Messages/Conversations                                   │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Prerequisites

1. **Python 3.8+** installed
2. **Node.js 22+** installed
3. **MongoDB** running locally or MongoDB Atlas connection
4. App data in MongoDB (users, bookings, reviews, messages)

### Step 1: Install Python Dependencies

```bash
cd local_service_backend/python_ai
pip install -r requirements.txt
```

Dependencies:
- `fastapi==0.109.0` - Web framework
- `scikit-learn==1.4.0` - ML library
- `uvicorn==0.27.0` - ASGI server
- `numpy==1.26.3` - Numerical computing
- `pymongo==4.6.1` - MongoDB driver

### Step 2: Export Training Data from MongoDB

Run the data export script to extract real app data:

```bash
cd local_service_backend/python_ai/scripts
python export_training_data.py [mongodb_uri]
```

Default MongoDB URI: `mongodb://localhost:27017/local_services`

This will create:
- `data/exported/providers.json` - Provider features
- `data/exported/customers.json` - Customer data
- `data/exported/bookings.json` - Booking history
- `data/exported/reviews.json` - Review data
- `data/exported/messages.json` - Chat messages
- `data/exported/generated_intents.json` - Auto-generated intent examples

### Step 3: Train Advanced ML Models

```bash
cd local_service_backend/python_ai/scripts
python train_advanced_models.py
```

This will:
1. Train ensemble intent classifier with app data
2. Initialize recommendation engine
3. Fit sentiment analyzer to its built-in synthetic examples
4. Compare performance with original Naive Bayes
5. Save model information

The exact data counts and evaluation scores depend on the exported data and
training split. Do not treat sample output or a single held-out score as a
production accuracy guarantee.

Example output:
```
🎯 Training Ensemble Intent Classifier
📊 Total training examples: 500+
📈 Evaluation Results:
Training examples: 400
Test examples: 100
Accuracy: varies by dataset

🎯 Training Recommendation Engine
✅ Recommendation engine initialized
   - Provider and category counts depend on the exported dataset

🎯 Training Sentiment Analyzer
✅ Sentiment analyzer fitted to synthetic examples

📈 Comparison Results:
Naive Bayes Accuracy: varies by dataset
Ensemble Accuracy: varies by dataset
```

### Step 4: Start Python AI Service

```bash
cd C:\Users\nn\Local-app\local_service_backend\python_ai
$env:PYTHONPATH = 'src'
python -m uvicorn localserve_ai.main_advanced:app --host 0.0.0.0 --port 8000
```

The service will start on `http://localhost:8000`. This is the service the
Node.js AI integration expects by default. It includes `/predict`, `/chat`,
`/recommend`, and `/sentiment`; the lightweight `main` service on port 8001
does not include the last two endpoints.

### Step 5: Configure Node.js Backend

Set environment variable for Python AI service URL:

```bash
# In .env file
PYTHON_AI_URL=http://localhost:8000
```

Or set it in your environment:
In PowerShell, use `$env:PYTHON_AI_URL = 'http://localhost:8000'`.

### Step 6: Start Node.js Backend

```bash
cd local_service_backend
npm start
```

The Node.js backend will now use the Python AI service for advanced ML predictions.

## API Endpoints

### Python AI Service (Port 8000)

#### Intent Classification
```http
POST /predict
Content-Type: application/json

{
  "text": "mujhe plumber chahiye"
}

Response:
{
  "intent": "find_provider",
  "confidence": 0.72,
  "response": "Open Services, choose a category...",
  "model": "LocalServe Ensemble..."
}
```

#### FAQ Chat
```http
POST /chat
Content-Type: application/json

{
  "text": "how do I book a service?"
}

Response:
{
  "answer": "Open Services → choose a provider...",
  "model": "LocalServe Complement Naive Bayes + TF-IDF..."
}
```

#### Provider Recommendations
```http
POST /recommend
Content-Type: application/json

{
  "category": "Plumber",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "budget_max": 1000,
  "min_rating": 4.0,
  "limit": 10
}

Response:
{
  "recommendations": [
    {
      "provider_id": "...",
      "category": "Plumber",
      "rating": 4.8,
      "recommendation_score": 92.5,
      ...
    }
  ],
  "category": "Plumber",
  "count": 5
}
```

#### Sentiment Analysis
```http
POST /sentiment
Content-Type: application/json

{
  "text": "Great service, very professional"
}

Response:
{
  "sentiment": "positive",
  "confidence": 0.92,
  "probabilities": {
    "positive": 0.92,
    "neutral": 0.05,
    "negative": 0.03
  }
}
```

#### Health Check
```http
GET /health

Response:
{
  "status": "ok",
  "model": "LocalServe Ensemble...",
  "classifier": "LocalServe Ensemble...",
  "answer_model": "LocalServe Complement Naive Bayes + TF-IDF..."
}
```

Use `GET /models` to check recommendation and sentiment model availability.

### Node.js Backend API (Port 5000)

The Node.js API uses live provider records from MongoDB for matching and
recommendations. Search intent and sentiment use Python locally when available
and fall back to Node.js rules. FAQ uses the app-specific Python knowledge
service. On Vercel, the FAQ has its own Python function; search and sentiment
use the Node.js rules fallback, while matching and recommendations use live
MongoDB provider records.

- `POST /api/ai/match` - Rank live providers
- `POST /api/ai/search` - Parse search intent and rank live providers
- `POST /api/ai/faq` - Answer from the LocalServe knowledge base
- `POST /api/ai/recommend` - Filter and rank live providers
- `POST /api/ai/sentiment` - Sentiment analysis, using local rules on Vercel
- `GET /api/ai/health` - Report Python AI availability

## Performance Comparison

### Intent Classification

| Model | Accuracy | Features |
|-------|----------|----------|
| Original Naive Bayes | Not certified | Word + char n-grams |
| **Ensemble Classifier** | Not certified | SVM + RF + NB + LR + TF-IDF |

### Recommendation Engine

- **Factors Considered**: Rating, experience, verification, availability, completion rate, location
- **Ranking**: Uses the exported provider features; it does not query live
  bookings or personalize from a signed-in user's history.
- **Performance**: Not benchmarked

### Sentiment Analysis

- **Languages**: English + Roman Urdu
- **Accuracy**: Not certified; current model is fitted to synthetic examples.
- **Fallback**: Rule-based for unknown inputs

## Troubleshooting

### Python AI Service Not Starting

**Problem**: Port 8000 already in use
```bash
# Check what's using port 8000
netstat -ano | findstr :8000

# Kill the process
taskkill /PID <PID> /F
```

### MongoDB Connection Failed

**Problem**: Cannot connect to MongoDB
```bash
# Check MongoDB is running
# For local MongoDB:
mongod

# For MongoDB Atlas, check your connection string
```

### No Training Data

**Problem**: Export script returns empty data
```bash
# Ensure MongoDB has data
# Check collections:
# - users
# - bookings
# - reviews
# - messages
```

### Node.js Cannot Connect to Python AI

**Problem**: Connection refused
```bash
# Check Python AI service is running
curl http://localhost:8000/health

# Check PYTHON_AI_URL in .env
echo $PYTHON_AI_URL
```

## Maintenance

### Retraining Models

As your app grows and more data accumulates, retrain models:

```bash
# 1. Export new data
python export_training_data.py

# 2. Retrain models
python train_advanced_models.py

# 3. Restart Python AI service
# (Ctrl+C to stop, then start again)
```

### Adding New Intents

1. Update `data/intents.json` with new intent and examples
2. Run training script
3. Restart Python AI service

### Updating Categories

1. Update `CATEGORIES` in both:
   - `src/services/aiService.js`
   - Python AI training scripts
2. Retrain models

## Benefits Over Original System

✅ **No External APIs** - No Gemini/OpenAI keys needed
✅ **Local inference** - No external AI API dependency
✅ **App-Aware** - Intent examples may be generated from exported app data
✅ **Local ML** - All processing happens on your servers
✅ **Cost-Free** - No API usage costs
✅ **Privacy** - Data never leaves your infrastructure
✅ **Faster** - No network latency to external APIs
✅ **Fallbacks** - Node has rule-based fallbacks for FAQ, search intent, and
sentiment when Python is unavailable

## File Structure

```
local_service_backend/
├── python_ai/
│   ├── src/localserve_ai/
│   │   ├── infrastructure/ml/
│   │   │   ├── ensemble_classifier.py      # NEW: Ensemble classifier
│   │   │   ├── recommendation_engine.py    # NEW: Recommendation system
│   │   │   ├── sentiment_analyzer.py       # NEW: Sentiment analysis
│   │   │   ├── naive_bayes_classifier.py   # Original (still used)
│   │   │   └── knowledge_base_chat_model.py
│   │   ├── main_advanced.py                # NEW: Advanced entry point
│   │   └── main.py                         # Original entry point
│   ├── scripts/
│   │   ├── export_training_data.py         # NEW: Data export
│   │   ├── train_advanced_models.py        # NEW: Model training
│   │   └── train_model.py                  # Original training
│   ├── data/
│   │   ├── intents.json                    # Base intents
│   │   ├── knowledge_base.json            # FAQ knowledge base
│   │   └── exported/                       # App data exports
│   └── requirements.txt                    # Updated with new deps
├── src/
│   ├── services/
│   │   └── aiService.js                    # Updated: Uses Python AI
│   ├── controllers/
│   │   └── aiController.js                  # Updated: New endpoints
│   └── routes/
│       └── aiRoutes.js                     # Updated: New routes
└── package.json
```

## Next Steps

1. **Export Data**: Run `export_training_data.py` with your MongoDB
2. **Train Models**: Run `train_advanced_models.py`
3. **Start Services**: Start Python AI and Node.js backend
4. **Test**: Use API endpoints to verify functionality
5. **Monitor**: Check logs for performance and accuracy
6. **Retrain**: Periodically retrain as data grows

## Support

For issues or questions:
- Check logs in both Python AI and Node.js services
- Verify MongoDB connection and data
- Ensure all dependencies are installed
- Check port availability (8000 for Python AI, 5000 for Node.js)
