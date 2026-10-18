import json
import sys
from pathlib import Path

from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "src"
sys.path.insert(0, str(SOURCE_ROOT))

from localserve_ai.infrastructure.ml.naive_bayes_classifier import (  # noqa: E402
    SklearnIntentClassifier,
)


def main() -> None:
    dataset_path = PROJECT_ROOT / "data" / "intents.json"
    with dataset_path.open(encoding="utf-8") as dataset_file:
        dataset = json.load(dataset_file)

    examples = [
        (example.strip(), intent["name"])
        for intent in dataset["intents"]
        for example in intent["examples"]
        if example.strip()
    ]
    texts, labels = zip(*examples)
    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )

    model = SklearnIntentClassifier.train(list(zip(train_texts, train_labels)))
    predictions = [model.predict(text)[0] for text in test_texts]
    print(f"Examples: {len(examples)}")
    print(f"Training examples: {len(train_texts)}")
    print(f"Test examples: {len(test_texts)}")
    print(f"Accuracy: {accuracy_score(test_labels, predictions):.2%}")
    print(classification_report(test_labels, predictions, zero_division=0))


if __name__ == "__main__":
    main()
