# LocalServe app-specific ML assistant

The assistant uses a lightweight, locally trained **Complement Naive Bayes**
classifier and **TF-IDF cosine-similarity retrieval**. It classifies each
question as a LocalServe topic, then finds the closest matching question in
`data/knowledge_base.json` and returns the app-authored answer. Questions that
are unrelated or do not match the stored knowledge receive an app-related
fallback message.

There is no Qwen/Ollama dependency, generative language model, paid API, or
large model download. This is a small classical-ML and information-retrieval
system, not a model that can invent answers or know facts absent from its data.
Answers should be verified and reviewed when app behavior changes.

## Clean Architecture

- `domain`: prediction and answer entities, classifier and chat-model ports.
- `application`: classify and answer-question use cases.
- `infrastructure/ml`: scikit-learn Complement Naive Bayes and TF-IDF retrieval.
- `presentation`: FastAPI `/health`, `/predict`, and `/chat` endpoints.
- `data/intents.json`: labeled examples used to train the intent classifier at
  startup.
- `data/knowledge_base.json`: app facts, alternate question phrasings, answers,
  and the unrelated-question fallback. TF-IDF is fitted on these questions at
  startup.

## Run locally

Use Python 3.10 or later:

```powershell
cd C:\Users\nn\Local-app\local_service_backend\python_ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:PYTHONPATH = 'src'
python -m uvicorn localserve_ai.main:app --host 0.0.0.0 --port 8001
```

For local development, check `GET /health` and try `POST /chat` with
`{"text":"mujhe booking kaise karni hai"}`. The response includes the closest
stored answer and the classifier/retrieval model name. No Ollama process or
model download is needed.

Deployed Flutter builds call the Vercel endpoint `POST /api/ai/faq`; the Python
function entrypoint is `../api/ai/assistant.py`. Configure and deploy the
backend to Vercel for the Flutter app to use the hosted assistant. The Python
development server above is only needed to test `/chat` locally.

## Add LocalServe knowledge

Edit `data/knowledge_base.json`:

- Add realistic alternate phrasings in `questions`; include the English and
  Roman Urdu phrases your users actually type.
- Keep `intent` consistent with one of the labels in `data/intents.json`.
- Put only verified app facts in `answer` and `answer_roman_urdu`.
- Update the fallback fields if the app-related topics change.

If the classifier does not recognize a new topic, add representative labeled
examples under that intent in `data/intents.json` and add that intent's fixed
answer to `application/use_cases/classify_message.py`. Restart the Python
service after editing either JSON file; both the classifier and retrieval
index are built at startup. Do not put passwords, API keys, or private user data
in these files.

## Verify

```powershell
$env:PYTHONPATH = 'src'
python -m unittest discover -s tests -v
python scripts\train_model.py
```

The held-out classifier score is only a small project-level check. Add
representative questions to the tests whenever expanding the knowledge base,
especially unrelated questions that should trigger the fallback.
