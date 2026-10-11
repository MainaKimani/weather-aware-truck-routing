from django.test import Client


def test_healthz_returns_ok(client: Client) -> None:
    response = client.get("/api/v1/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
