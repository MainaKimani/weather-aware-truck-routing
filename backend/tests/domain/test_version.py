import re

from planner.domain.version import RULES_VERSION


def test_rules_version_is_semver() -> None:
    assert re.fullmatch(r"\d+\.\d+\.\d+", RULES_VERSION)
