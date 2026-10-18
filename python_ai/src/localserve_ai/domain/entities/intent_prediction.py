from dataclasses import dataclass


@dataclass(frozen=True)
class IntentPrediction:
    intent: str
    confidence: float
    response: str
    model: str
