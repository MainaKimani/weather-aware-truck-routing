"""How allauth creates and finds accounts here."""

from allauth.account.adapter import DefaultAccountAdapter

from accounts.models import User


class AccountAdapter(DefaultAccountAdapter):  # type: ignore[misc]  # allauth is untyped
    def clean_email(self, email: str) -> str:
        """Emails are stored lower-cased, as the user manager stores them, so
        "A@x.com" and "a@x.com" are one account."""
        return User.objects.normalize_email(super().clean_email(email))
