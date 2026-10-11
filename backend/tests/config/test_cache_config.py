from config.settings.base import cache_config


def test_uses_redis_when_url_set() -> None:
    caches = cache_config("redis://localhost:6379/0")

    assert caches["default"]["BACKEND"] == "django_redis.cache.RedisCache"
    assert caches["default"]["LOCATION"] == "redis://localhost:6379/0"


def test_falls_back_to_local_memory() -> None:
    assert cache_config("")["default"]["BACKEND"] == (
        "django.core.cache.backends.locmem.LocMemCache"
    )
