import json
from pathlib import Path
from typing import Sequence

from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import FeatureUnion, Pipeline


MODEL_NAME = "LocalServe word/character n-gram + Complement Naive Bayes intent classifier"


class SklearnIntentClassifier:
    def __init__(self, pipeline: Pipeline) -> None:
        self._pipeline = pipeline

    @property
    def model_name(self) -> str:
        return MODEL_NAME

    @classmethod
    def train(cls, examples: Sequence[tuple[str, str]]) -> "SklearnIntentClassifier":
        if not examples:
            raise ValueError("Training examples must not be empty.")

        texts, labels = zip(*examples)
        if len(set(labels)) < 2:
            raise ValueError("Training requires at least two intent labels.")

        pipeline = Pipeline(
            [
                (
                    "features",
                    FeatureUnion(
                        [
                            (
                                "word",
                                CountVectorizer(
                                    binary=True,
                                    strip_accents="unicode",
                                    ngram_range=(1, 2),
                                ),
                            ),
                            (
                                "character",
                                TfidfVectorizer(
                                    analyzer="char_wb",
                                    strip_accents="unicode",
                                    ngram_range=(2, 5),
                                ),
                            ),
                        ]
                    ),
                ),
                ("classifier", ComplementNB(alpha=0.1)),
            ]
        )
        pipeline.fit(list(texts), list(labels))
        return cls(pipeline)

    @classmethod
    def from_json(cls, dataset_path: Path) -> "SklearnIntentClassifier":
        with dataset_path.open(encoding="utf-8") as dataset_file:
            dataset = json.load(dataset_file)

        examples = [
            (example.strip(), intent["name"])
            for intent in dataset["intents"]
            for example in intent["examples"]
            if example.strip()
        ]
        return cls.train(examples)

    def predict(self, text: str) -> tuple[str, float]:
        probabilities = self._pipeline.predict_proba([text])[0]
        best_index = int(probabilities.argmax())
        classes = self._pipeline.named_steps["classifier"].classes_
        confidence = float(probabilities[best_index])
        intent = str(classes[best_index])

        if confidence < 0.32:
            return "unknown", confidence
        return intent, confidence
