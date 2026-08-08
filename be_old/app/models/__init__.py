# SQLAlchemy models — import all so create_all() sees every table.

from app.models.alert import Alert
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.user import User

__all__ = ["Alert", "MealPlan", "Notification", "Profile", "User"]
