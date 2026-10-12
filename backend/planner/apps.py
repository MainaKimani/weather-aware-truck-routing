from django.apps import AppConfig


class PlannerConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "planner"

    def ready(self) -> None:
        from planner import signals  # noqa: F401  # connects the handlers
