from typing import Any

from rest_framework import serializers


class MeUserSerializer(serializers.Serializer[Any]):
    email = serializers.EmailField()


class MeSerializer(serializers.Serializer[Any]):
    """Who the caller is, for the header."""

    user = MeUserSerializer(allow_null=True, help_text="The signed-in user, or null.")
    guest = serializers.BooleanField(help_text="A guest who has planned on this device.")
    recent_trip_count = serializers.IntegerField(
        help_text="Trips the caller owns: a guest's on this device, or a user's in total."
    )


class DeleteAccountSerializer(serializers.Serializer[Any]):
    password = serializers.CharField(
        write_only=True, trim_whitespace=False, help_text="The account's current password."
    )
