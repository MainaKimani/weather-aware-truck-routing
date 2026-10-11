import pytest

from planner.domain import units


@pytest.mark.parametrize(
    ("convert", "value", "expected"),
    [
        (units.kmh_to_mph, 100.0, 62.137119),
        (units.kmh_to_mph, 1.609344, 1.0),
        (units.mm_to_in, 25.4, 1.0),
        (units.mm_to_in, 7.62, 0.3),
        (units.cm_to_in, 2.54, 1.0),
        (units.cm_to_in, 1.27, 0.5),
        (units.lb_to_kg, 80_000.0, 36_287.3896),
        (units.lb_to_kg, 1.0, 0.45359237),
        (units.km_to_mi, 1.609344, 1.0),
        (units.km_to_mi, 100.0, 62.137119),
        (units.m_to_mi, 1609.344, 1.0),
        (units.m_to_mi, 0.0, 0.0),
    ],
)
def test_conversion(convert: object, value: float, expected: float) -> None:
    assert callable(convert)
    assert convert(value) == pytest.approx(expected, rel=1e-6)
