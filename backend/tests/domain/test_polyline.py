import pytest
from hypothesis import given
from hypothesis import strategies as st

from planner.domain.polyline import decode, decode_flexible, encode
from planner.domain.types import LatLon

# Google's documented example (Encoded Polyline Algorithm Format).
GOOGLE_POINTS = [LatLon(38.5, -120.2), LatLon(40.7, -120.95), LatLon(43.252, -126.453)]
GOOGLE_ENCODED = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"


class TestEncodedPolyline:
    def test_encodes_reference_example(self) -> None:
        assert encode(GOOGLE_POINTS) == GOOGLE_ENCODED

    def test_decodes_reference_example(self) -> None:
        assert decode(GOOGLE_ENCODED) == GOOGLE_POINTS

    def test_empty(self) -> None:
        assert encode([]) == ""
        assert decode("") == []

    def test_rounds_half_up_like_the_reference(self) -> None:
        # 0.000005 * 1e5 = 0.5 -> 1 (half up), not 0 (Python's half-to-even).
        assert decode(encode([LatLon(0.000005, 0.0)])) == [LatLon(0.00001, 0.0)]

    @pytest.mark.parametrize("bad", ["_p~iF~ps|U_ulL", "_", " ", "\x7f\x7f"])
    def test_rejects_malformed_input(self, bad: str) -> None:
        with pytest.raises(ValueError, match="polyline"):
            decode(bad)

    @given(
        st.lists(
            st.builds(
                LatLon,
                st.floats(min_value=-90, max_value=90),
                st.floats(min_value=-180, max_value=180),
            ),
            max_size=50,
        )
    )
    def test_round_trip_within_precision(self, points: list[LatLon]) -> None:
        decoded = decode(encode(points))

        assert len(decoded) == len(points)
        for got, want in zip(decoded, points, strict=True):
            assert got.lat == pytest.approx(want.lat, abs=0.5e-5 + 1e-12)
            assert got.lon == pytest.approx(want.lon, abs=0.5e-5 + 1e-12)


class TestFlexiblePolyline:
    def test_decodes_here_reference_example(self) -> None:
        # From HERE's flexible-polyline README.
        assert decode_flexible("BFoz5xJ67i1B1B7PzIhaxL7Y") == [
            LatLon(50.10228, 8.69821),
            LatLon(50.10201, 8.69567),
            LatLon(50.10063, 8.6915),
            LatLon(50.09878, 8.68752),
        ]

    def test_drops_third_dimension(self) -> None:
        # Encoded with altitude as the third dimension (flexpolyline.encode).
        assert decode_flexible("BlBoz5xJ67i1BU1B7PUzIhaU") == [
            LatLon(50.10228, 8.69821),
            LatLon(50.10201, 8.69567),
            LatLon(50.10063, 8.6915),
        ]

    @pytest.mark.parametrize("bad", ["", "B", "BFoz5xJ67i1B1", "!!!!", "AFoz5x"])
    def test_rejects_malformed_input(self, bad: str) -> None:
        with pytest.raises(ValueError, match="flexible polyline"):
            decode_flexible(bad)
