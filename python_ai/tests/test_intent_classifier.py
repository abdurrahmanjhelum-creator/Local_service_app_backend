import json
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from localserve_ai.application.use_cases.classify_message import ClassifyMessage  # noqa: E402
from localserve_ai.application.use_cases.answer_question import AnswerQuestion  # noqa: E402
from localserve_ai.domain.entities.chat_answer import ChatAnswer  # noqa: E402
from localserve_ai.infrastructure.ml.naive_bayes_classifier import (  # noqa: E402
    SklearnIntentClassifier,
)
from localserve_ai.infrastructure.ml.knowledge_base_chat_model import (  # noqa: E402
    KnowledgeBaseChatModel,
)
from localserve_ai.presentation.api import (  # noqa: E402
    PredictRequest,
    create_app,
)


class FakeChatModel:
    model_name = "test-local-model"

    def answer(self, question: str) -> ChatAnswer:
        return ChatAnswer(answer=f"Reply to: {question}", model=self.model_name)


class IntentClassifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.classifier = SklearnIntentClassifier.from_json(
            PROJECT_ROOT / "data" / "intents.json"
        )
        cls.use_case = ClassifyMessage(cls.classifier)
        cls.knowledge_model = KnowledgeBaseChatModel.from_json(
            PROJECT_ROOT / "data" / "knowledge_base.json", cls.classifier
        )

    def test_classifies_unseen_localserve_questions(self) -> None:
        cases = {
            "mujhe plumber chahiye": "find_provider",
            "Can I use a credit card?": "payment",
            "please cancel tomorrow's service": "cancel_booking",
            "where can I get a receipt": "invoice",
            "mera provider kab free hai": "availability",
            "I want to chat with the electrician": "messaging",
            "LocalServe kya hai": "app_info",
        }
        for message, expected_intent in cases.items():
            with self.subTest(message=message):
                prediction = self.classifier.predict(message)
                self.assertEqual(prediction[0], expected_intent)

    def test_training_dataset_has_multiple_labels_and_examples(self) -> None:
        with (PROJECT_ROOT / "data" / "intents.json").open(encoding="utf-8") as data_file:
            dataset = json.load(data_file)

        self.assertGreaterEqual(len(dataset["intents"]), 11)
        self.assertTrue(all(len(intent["examples"]) >= 8 for intent in dataset["intents"]))

    def test_use_case_returns_model_metadata_and_response(self) -> None:
        result = self.use_case.execute("How do I book a plumber?")

        self.assertEqual(result.intent, "book_service")
        self.assertGreater(result.confidence, 0)
        self.assertIn("Book Now", result.response)
        self.assertIn("Naive Bayes", result.model)

    def test_use_case_rejects_empty_input(self) -> None:
        with self.assertRaises(ValueError):
            self.use_case.execute("  ")

    def test_chat_use_case_returns_model_answer(self) -> None:
        use_case = AnswerQuestion(FakeChatModel())

        result = use_case.execute("  Explain AI simply  ")

        self.assertEqual(result.answer, "Reply to: Explain AI simply")
        self.assertEqual(result.model, "test-local-model")

    def test_chat_use_case_rejects_empty_question(self) -> None:
        use_case = AnswerQuestion(FakeChatModel())

        with self.assertRaises(ValueError):
            use_case.execute(" ")

    def test_chat_endpoint_returns_answer_and_model(self) -> None:
        app = create_app(self.classifier, self.knowledge_model)
        chat_endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/chat"
        )

        response = chat_endpoint(PredictRequest(text="how do I book a service"))

        self.assertIn("Book Now", response.answer)
        self.assertIn("TF-IDF", response.model)

    def test_knowledge_retrieval_returns_best_app_answer(self) -> None:
        result = self.knowledge_model.answer("mujhe booking kaise karni hai")

        self.assertEqual(
            result.answer,
            "Services kholein, category aur provider chunein, Book Now dabayein, phir date, time aur service address select karke booking confirm karein.",
        )
        self.assertIn("TF-IDF", result.model)

    def test_knowledge_retrieval_rejects_unrelated_questions(self) -> None:
        result = self.knowledge_model.answer("what is the weather tomorrow")

        self.assertEqual(
            result.answer,
            "Please ask a question about the LocalServe app, its services, providers, bookings, payments, messages, or invoices.",
        )

    def test_knowledge_retrieval_has_roman_urdu_fallback(self) -> None:
        result = self.knowledge_model.answer("aaj ka mausam kaisa hai")

        self.assertIn("Meherbani", result.answer)

    def test_knowledge_retrieval_answers_app_access_limits(self) -> None:
        result = self.knowledge_model.answer("can you access my account")

        self.assertIn("cannot access your account", result.answer)
        self.assertNotIn("Meherbani", result.answer)

    def test_knowledge_base_has_searchable_examples(self) -> None:
        with (PROJECT_ROOT / "data" / "knowledge_base.json").open(
            encoding="utf-8"
        ) as data_file:
            dataset = json.load(data_file)

        self.assertGreaterEqual(len(dataset["entries"]), 10)
        self.assertTrue(
            all(
                entry["questions"] and entry["answer"]
                for entry in dataset["entries"]
            )
        )


if __name__ == "__main__":
    unittest.main()
