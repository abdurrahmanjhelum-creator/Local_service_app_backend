from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from localserve_ai.application.use_cases.answer_question import AnswerQuestion
from localserve_ai.application.use_cases.classify_message import ClassifyMessage
from localserve_ai.domain.repositories.chat_model import ChatModel
from localserve_ai.domain.repositories.intent_classifier import IntentClassifier


class PredictRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class PredictResponse(BaseModel):
    intent: str
    confidence: float
    response: str
    model: str


class ChatResponse(BaseModel):
    answer: str
    model: str


def create_app(
    classifier: IntentClassifier, chat_model: ChatModel | None = None
) -> FastAPI:
    app = FastAPI(title="LocalServe Local Retrieval API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    classify_message = ClassifyMessage(classifier)
    answer_question = AnswerQuestion(chat_model) if chat_model is not None else None

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "model": (
                chat_model.model_name
                if chat_model is not None
                else classifier.model_name
            ),
            "classifier": classifier.model_name,
            "answer_model": (
                chat_model.model_name if chat_model is not None else "disabled"
            ),
        }

    @app.post("/predict", response_model=PredictResponse)
    def predict(request: PredictRequest) -> PredictResponse:
        try:
            prediction = classify_message.execute(request.text)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

        return PredictResponse(
            intent=prediction.intent,
            confidence=prediction.confidence,
            response=prediction.response,
            model=prediction.model,
        )

    @app.post("/chat", response_model=ChatResponse)
    def chat(request: PredictRequest) -> ChatResponse:
        if answer_question is None:
            raise HTTPException(
                status_code=503,
                detail="The local knowledge-base assistant is not configured.",
            )
        try:
            answer = answer_question.execute(request.text)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        return ChatResponse(answer=answer.answer, model=answer.model)

    app.add_api_route(
        "/api/ai/faq",
        chat,
        methods=["POST"],
        response_model=ChatResponse,
    )

    return app
