from typing import Protocol


class IntentClassifier(Protocol):
    @property
    def model_name(self) -> str:
        ...

    def predict(self, text: str) -> tuple[str, float]:
        ...
