"""The only place in the codebase that converts units.

Providers are asked for metric values; everything the domain reasons about
is in US units (mph, inches, miles, pounds). Field names carry their unit.
The factors below are exact by definition.
"""

KM_PER_MI = 1.609344
M_PER_MI = 1609.344
MM_PER_IN = 25.4
CM_PER_IN = 2.54
KG_PER_LB = 0.45359237


def kmh_to_mph(kmh: float) -> float:
    return kmh / KM_PER_MI


def mm_to_in(mm: float) -> float:
    return mm / MM_PER_IN


def cm_to_in(cm: float) -> float:
    return cm / CM_PER_IN


def lb_to_kg(lb: float) -> float:
    return lb * KG_PER_LB


def km_to_mi(km: float) -> float:
    return km / KM_PER_MI


def m_to_mi(m: float) -> float:
    return m / M_PER_MI
