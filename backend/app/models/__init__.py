# SQLAlchemy models — import all so create_all() sees every table.

from app.models.alert import Alert
from app.models.body_metrics import BodyMetricsEntry
from app.models.catalog import Allergy, Diagnosis, Medicine
from app.models.food_log import FoodLog
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.models.nutrition_catalog import DrugProduct, DrugRule, FoodComposition, Recipe
from app.models.profile import Profile
from app.models.user import User

__all__ = [
    "Alert",
    "Allergy",
    "BodyMetricsEntry",
    "Diagnosis",
    "DrugProduct",
    "DrugRule",
    "FoodComposition",
    "FoodLog",
    "MealPlan",
    "Medicine",
    "Notification",
    "Profile",
    "Recipe",
    "User",
]
