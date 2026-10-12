"""Golden files: compare a value with a JSON file under tests/golden/.

`to_jsonable` turns domain objects (frozen dataclasses, enums, datetimes,
LatLon tuples) into plain JSON, rounding floats so a last-bit change in the
maths doesn't churn the file. Regenerate after an intended change with
`UPDATE_GOLDEN=1 uv run pytest <test>` and review the diff like code.
"""

import dataclasses
import json
import os
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

GOLDEN_DIR = Path(__file__).parent / "golden"


def to_jsonable(value: Any, skip: frozenset[str] = frozenset(), digits: int = 4) -> Any:
    def conv(v: Any) -> Any:
        if dataclasses.is_dataclass(v) and not isinstance(v, type):
            return {
                f.name: conv(getattr(v, f.name))
                for f in dataclasses.fields(v)
                if f.name not in skip
            }
        if isinstance(v, Enum):
            return v.name
        if isinstance(v, datetime):
            return v.isoformat()
        if isinstance(v, bool) or v is None or isinstance(v, (int, str)):
            return v
        if isinstance(v, float):
            return round(v, digits)
        if isinstance(v, dict):
            return {str(conv(k)): conv(x) for k, x in v.items()}
        if isinstance(v, (list, tuple)):
            return [conv(x) for x in v]
        raise TypeError(f"no JSON form for {type(v).__name__}")

    return conv(value)


def assert_golden(name: str, value: Any) -> None:
    path = GOLDEN_DIR / name
    text = json.dumps(value, indent=1, sort_keys=True) + "\n"
    if os.environ.get("UPDATE_GOLDEN"):
        path.parent.mkdir(exist_ok=True)
        path.write_text(text)
    assert path.exists(), f"{path} is missing; run with UPDATE_GOLDEN=1 to create it"
    assert json.loads(path.read_text()) == json.loads(text), (
        f"{name} differs from the golden file; if the change is intended, "
        "rerun with UPDATE_GOLDEN=1 and review the diff"
    )
