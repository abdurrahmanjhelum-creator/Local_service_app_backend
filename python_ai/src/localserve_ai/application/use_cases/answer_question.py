from localserve_ai.domain.entities.chat_answer import ChatAnswer
from localserve_ai.domain.repositories.chat_model import ChatModel


class AnswerQuestion:
    def __init__(self, model: ChatModel) -> None:
        self._model = model

    def execute(self, question: str) -> ChatAnswer:
        normalized_question = question.strip()
        if not normalized_question:
            raise ValueError("Question must not be empty.")

        return self._model.answer(normalized_question)
