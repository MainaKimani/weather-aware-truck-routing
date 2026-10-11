from typing import Any, ClassVar

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower


class EmailUserManager(BaseUserManager["User"]):
    """Users are identified by email; it is stored lower-cased."""

    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email: str | None) -> str:
        return (email or "").strip().lower()

    def _create_user(self, email: str, password: str | None, **extra: Any) -> "User":
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra: Any) -> "User":
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra: Any) -> "User":
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if not (extra["is_staff"] and extra["is_superuser"]):
            raise ValueError("A superuser must have is_staff and is_superuser set.")
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Email-login user. Exists from the first migration: swapping later is painful."""

    username = None  # type: ignore[assignment]
    email = models.EmailField("email address", unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    objects: ClassVar[EmailUserManager] = EmailUserManager()  # type: ignore[assignment]

    class Meta:
        constraints: ClassVar = [
            # The manager lower-cases emails; this also covers writes that bypass it.
            models.UniqueConstraint(Lower("email"), name="user_email_ci_unique"),
        ]

    def clean(self) -> None:
        super().clean()
        self.email = type(self).objects.normalize_email(self.email)

    def __str__(self) -> str:
        return self.email
