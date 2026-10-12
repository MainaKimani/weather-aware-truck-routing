"""Cursor pages for trip lists (RFC §7.4).

A cursor rather than page numbers: new trips arrive at the top all the time,
and a cursor neither repeats nor skips a trip when that happens. It also
needs no count query.
"""

from rest_framework.pagination import CursorPagination


class TripCursorPagination(CursorPagination):
    page_size = 20
    ordering = ("-created_at", "-id")
