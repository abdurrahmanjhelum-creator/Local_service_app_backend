import json
import re
from pathlib import Path
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import FeatureUnion

from localserve_ai.domain.entities.chat_answer import ChatAnswer
from localserve_ai.domain.repositories.intent_classifier import IntentClassifier


MODEL_NAME = "LocalServe Complement Naive Bayes + TF-IDF knowledge retrieval"
ROMAN_URDU_WORDS = {
    "aap",
    "apni",
    "assalam",
    "assalamualaikum",
    "alaikum",
    "aoa",
    "banaun",
    "banao",
    "banani",
    "chahiye",
    "hai",
    "hain",
    "kaise",
    "kar",
    "karna",
    "karni",
    "karein",
    "karo",
    "kahan",
    "ka",
    "ki",
    "ko",
    "kya",
    "konsi",
    "konsa",
    "mera",
    "mujhey",
    "mujhe",
    "meri",
    "mein",
    "mila",
    "milta",
    "nahi",
    "par",
    "se",
    "service",
    "salam",
    "wala",
    "wali",
}
FALLBACK_INTENT = "unknown"


class KnowledgeBaseChatModel:
    def __init__(
        self,
        classifier: IntentClassifier,
        dataset: dict[str, Any],
        similarity_threshold: float = 0.16,
    ) -> None:
        entries = dataset.get("entries")
        if not isinstance(entries, list) or not entries:
            raise ValueError("Knowledge base must contain at least one entry.")

        self._classifier = classifier
        self._fallback = dataset["fallback"]
        self._fallback_roman_urdu = dataset.get(
            "fallback_roman_urdu", self._fallback
        )
        self._entries: list[dict[str, Any]] = []
        question_texts: list[str] = []
        question_entry_indices: list[int] = []
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError("Knowledge base entries must be JSON objects.")
            intent = entry.get("intent")
            questions = entry.get("questions")
            answer = entry.get("answer")
            if (
                not isinstance(intent, str)
                or not isinstance(questions, list)
                or not questions
                or not isinstance(answer, str)
                or not answer.strip()
            ):
                raise ValueError(
                    "Every knowledge entry needs intent, questions, and answer."
                )

            entry_index = len(self._entries)
            self._entries.append(entry)
            for question in questions:
                if isinstance(question, str) and question.strip():
                    question_texts.append(question.strip())
                    question_entry_indices.append(entry_index)

        if not question_texts:
            raise ValueError("Knowledge base must contain searchable questions.")

        self._question_entry_indices = question_entry_indices
        self._vectorizer = FeatureUnion(
            [
                (
                    "word",
                    TfidfVectorizer(
                        strip_accents="unicode",
                        ngram_range=(1, 2),
                        sublinear_tf=True,
                    ),
                ),
                (
                    "character",
                    TfidfVectorizer(
                        analyzer="char_wb",
                        strip_accents="unicode",
                        ngram_range=(2, 5),
                        sublinear_tf=True,
                    ),
                ),
            ]
        )
        self._question_vectors = self._vectorizer.fit_transform(question_texts)
        self._similarity_threshold = similarity_threshold

    @classmethod
    def from_json(
        cls,
        dataset_path: Path,
        classifier: IntentClassifier,
        similarity_threshold: float = 0.16,
    ) -> "KnowledgeBaseChatModel":
        with dataset_path.open(encoding="utf-8") as dataset_file:
            dataset = json.load(dataset_file)
        return cls(classifier, dataset, similarity_threshold)

    @property
    def model_name(self) -> str:
        return MODEL_NAME

    def answer(self, question: str) -> ChatAnswer:
        intent, _ = self._classifier.predict(question)
        if intent == FALLBACK_INTENT:
            return self._fallback_answer(question)

        matching_rows = [
            row
            for row, entry_index in enumerate(self._question_entry_indices)
            if self._entries[entry_index]["intent"] == intent
        ]
        if not matching_rows:
            return self._fallback_answer(question)

        question_vector = self._vectorizer.transform([question])
        similarities = cosine_similarity(
            question_vector, self._question_vectors[matching_rows]
        )[0]
        best_match = int(similarities.argmax())
        if float(similarities[best_match]) < self._similarity_threshold:
            return self._fallback_answer(question)

        entry_index = self._question_entry_indices[matching_rows[best_match]]
        entry = self._entries[entry_index]
        answer_key = (
            "answer_roman_urdu" if self._is_roman_urdu(question) else "answer"
        )
        answer = entry.get(answer_key, entry["answer"])
        return ChatAnswer(answer=answer, model=self.model_name)

    def _fallback_answer(self, question: str) -> ChatAnswer:
        fallback = (
            self._fallback_roman_urdu
            if self._is_roman_urdu(question)
            else self._fallback
        )
        return ChatAnswer(answer=fallback, model=self.model_name)

    @staticmethod
    def _is_roman_urdu(text: str) -> bool:
        words = set(re.findall(r"[a-z]+", text.lower()))
        return len(words & ROMAN_URDU_WORDS) >= 2
