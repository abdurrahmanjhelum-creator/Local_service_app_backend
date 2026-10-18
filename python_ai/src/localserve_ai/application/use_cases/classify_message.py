from localserve_ai.domain.entities.intent_prediction import IntentPrediction
from localserve_ai.domain.repositories.intent_classifier import IntentClassifier


RESPONSES = {
    "greeting": "Hi! I can help you book a service, find a provider, or answer questions about payments and bookings.",
    "app_info": "LocalServe is a demo app for finding local service providers and managing service bookings, messages, and invoices.",
    "find_provider": "Open Services, choose a category, and browse available local providers. Try Plumber, Electrician, Cleaner, or Painter.",
    "book_service": "Open Services, choose a provider, tap Book Now, then select a date, time, and service address.",
    "cancel_booking": "Open Bookings, select the booking, and use the cancel option. Cancellation may depend on its current status.",
    "payment": "LocalServe demo payments are cash after the service. In-app card payment is not available.",
    "messaging": "Open Messages, or open a provider profile and tap Message to chat about the service.",
    "invoice": "Open a completed booking and choose Download Invoice to get its receipt.",
    "availability": "Providers can manage open time slots from their Availability calendar.",
    "registration": "Choose Customer or Provider, verify your email, and complete the profile. Providers also add their category, price, and service area.",
    "booking_status": "Open Bookings to check the latest status and details of your service request.",
    "unknown": "I did not understand that yet. Try asking about bookings, finding providers, payment, chat, invoices, or availability.",
}


class ClassifyMessage:
    def __init__(self, classifier: IntentClassifier) -> None:
        self._classifier = classifier

    def execute(self, text: str) -> IntentPrediction:
        normalized_text = text.strip()
        if not normalized_text:
            raise ValueError("Message must not be empty.")

        intent, confidence = self._classifier.predict(normalized_text)
        response = RESPONSES.get(intent, RESPONSES["unknown"])
        return IntentPrediction(
            intent=intent,
            confidence=round(confidence, 4),
            response=response,
            model=self._classifier.model_name,
        )
