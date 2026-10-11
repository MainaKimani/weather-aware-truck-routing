"""Version of the risk and ranking rules.

Returned with every plan (provenance) and prefixed to every cache key, so
results computed under old rules are never served as current. Bump it
whenever a threshold, load rule, sampling rule or ranking rule changes:
major for a change in meaning, minor for new outputs, patch for fixes.
"""

from typing import Final

RULES_VERSION: Final = "1.0.0"
