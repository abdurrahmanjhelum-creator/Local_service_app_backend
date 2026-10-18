from dataclasses import dataclass


@dataclass(frozen=True)
class ChatAnswer:
    answer: str
    model: str
