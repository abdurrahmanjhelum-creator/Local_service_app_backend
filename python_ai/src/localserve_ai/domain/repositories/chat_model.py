from typing import Protocol

from localserve_ai.domain.entities.chat_answer import ChatAnswer


class ChatModel(Protocol):
    @property
    def model_name(self) -> str:
        ...

    def answer(self, question: str) -> ChatAnswer:
        ...
