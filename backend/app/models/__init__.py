# SQLAlchemy models — import all so create_all() sees every table.

from app.models.alert import Alert
from app.models.body_metrics import BodyMetricsEntry
from app.models.catalog import Allergy, Diagnosis, Medicine
from app.models.chat_session import ChatMessage, ChatSession
from app.models.food_log import FoodLog
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.models.nutrition_catalog import DrugProduct, DrugRule, FoodComposition, Recipe
from app.models.password_reset import PasswordResetToken
from app.models.patient_transfer import PatientTransfer
from app.models.profile import Profile
from app.models.user import User

__all__ = [
    "Alert",
    "Allergy",
    "BodyMetricsEntry",
    "ChatMessage",
    "ChatSession",
    "Diagnosis",
    "DrugProduct",
    "DrugRule",
    "FoodComposition",
    "FoodLog",
    "MealPlan",
    "Medicine",
    "Notification",
    "PasswordResetToken",
    "PatientTransfer",
    "Profile",
    "Recipe",
    "User",
]
