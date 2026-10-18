from pathlib import Path

from localserve_ai.infrastructure.ml.naive_bayes_classifier import (
    SklearnIntentClassifier,
)
from localserve_ai.infrastructure.ml.knowledge_base_chat_model import (
    KnowledgeBaseChatModel,
)
from localserve_ai.presentation.api import create_app


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = PROJECT_ROOT / "data" / "intents.json"
KNOWLEDGE_BASE_PATH = PROJECT_ROOT / "data" / "knowledge_base.json"

classifier = SklearnIntentClassifier.from_json(DATASET_PATH)
chat_model = KnowledgeBaseChatModel.from_json(KNOWLEDGE_BASE_PATH, classifier)
app = create_app(classifier, chat_model)
