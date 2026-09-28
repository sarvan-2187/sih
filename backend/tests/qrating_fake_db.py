"""A small in-memory stand-in for a Motor database.

Follows the _FakeDB / _Collection convention already used by
test_lms_security_fixes.py, extended with the writes Q-Rating needs: upserts,
$set / $setOnInsert, sorting, async cursors and - the important one - unique
indexes, so DuplicateKeyError behaves the way finalize_round() relies on.

Deliberately not a Mongo emulator. It supports exactly the query and update
operators this feature uses; anything else raises so a silent wrong answer is
impossible.
"""

import copy
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

_COMPARATORS = {
    "$in": lambda value, expected: value in expected,
    "$nin": lambda value, expected: value not in expected,
    "$ne": lambda value, expected: value != expected,
    "$gt": lambda value, expected: value is not None and value > expected,
    "$gte": lambda value, expected: value is not None and value >= expected,
    "$lt": lambda value, expected: value is not None and value < expected,
    "$lte": lambda value, expected: value is not None and value <= expected,
}


def _matches(doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
    for field, expected in query.items():
        value = doc.get(field)
        if isinstance(expected, dict):
            for operator, operand in expected.items():
                compare = _COMPARATORS.get(operator)
                if compare is None:
                    raise NotImplementedError("fake db: operator %s" % operator)
                if not compare(value, operand):
                    return False
        elif value != expected:
            return False
    return True


class _Cursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    def sort(self, key, direction=1):
        if isinstance(key, list):
            for field, field_direction in reversed(key):
                self._docs.sort(key=lambda d: d.get(field) or 0,
                                reverse=field_direction < 0)
        else:
            self._docs.sort(key=lambda d: d.get(key) or 0, reverse=direction < 0)
        return self

    def limit(self, count):
        self._docs = self._docs[:count]
        return self

    async def to_list(self, length=None):
        return self._docs if length is None else self._docs[:length]

    def __aiter__(self):
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class _UpdateResult:
    def __init__(self, matched_count: int, upserted_id: Optional[Any]):
        self.matched_count = matched_count
        self.modified_count = matched_count
        self.upserted_id = upserted_id


class _InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class Collection:
    def __init__(self, name: str):
        self.name = name
        self.docs: List[Dict[str, Any]] = []
        self.unique_keys: List[tuple] = []

    # --- index support ---
    def create_unique_index(self, *fields):
        self.unique_keys.append(tuple(fields))
        return self

    def _check_unique(self, candidate: Dict[str, Any], ignore: Optional[Dict] = None):
        for key in self.unique_keys:
            if any(candidate.get(field) is None for field in key):
                continue
            for doc in self.docs:
                if doc is ignore:
                    continue
                if all(doc.get(field) == candidate.get(field) for field in key):
                    raise DuplicateKeyError("duplicate %s on %s" % (key, self.name))

    # --- reads ---
    def _find(self, query):
        return [d for d in self.docs if _matches(d, query or {})]

    async def find_one(self, query=None, sort=None, *args, **kwargs):
        found = self._find(query)
        if sort:
            for field, direction in reversed(sort):
                found.sort(key=lambda d: d.get(field) or 0, reverse=direction < 0)
        return found[0] if found else None

    def find(self, query=None, projection=None):
        return _Cursor(self._find(query))

    async def count_documents(self, query=None):
        return len(self._find(query))

    # --- writes ---
    async def insert_one(self, doc):
        doc = copy.deepcopy(doc)
        doc.setdefault("_id", ObjectId())
        self._check_unique(doc)
        self.docs.append(doc)
        return _InsertResult(doc["_id"])

    async def update_one(self, query, update, upsert=False, array_filters=None):
        unsupported = set(update) - {"$set", "$setOnInsert", "$inc", "$push", "$addToSet"}
        if unsupported:
            raise NotImplementedError("fake db: update operators %s" % unsupported)

        existing = self._find(query)
        if existing:
            doc = existing[0]
            candidate = {**doc, **update.get("$set", {})}
            self._check_unique(candidate, ignore=doc)
            doc.update(copy.deepcopy(update.get("$set", {})))
            for field, amount in update.get("$inc", {}).items():
                doc[field] = (doc.get(field) or 0) + amount
            for field, value in update.get("$push", {}).items():
                doc.setdefault(field, []).append(value)
            for field, value in update.get("$addToSet", {}).items():
                if value not in doc.setdefault(field, []):
                    doc[field].append(value)
            return _UpdateResult(1, None)

        if not upsert:
            return _UpdateResult(0, None)

        doc = {key: value for key, value in (query or {}).items()
               if not isinstance(value, dict)}
        doc.update(copy.deepcopy(update.get("$setOnInsert", {})))
        doc.update(copy.deepcopy(update.get("$set", {})))
        for field, amount in update.get("$inc", {}).items():
            doc[field] = amount
        doc.setdefault("_id", ObjectId())
        self._check_unique(doc)
        self.docs.append(doc)
        return _UpdateResult(0, doc["_id"])

    async def update_many(self, query, update):
        count = 0
        for doc in self._find(query):
            if isinstance(update, list):
                continue  # aggregation-pipeline updates: not needed here
            doc.update(copy.deepcopy(update.get("$set", {})))
            count += 1
        return _UpdateResult(count, None)

    async def delete_many(self, query):
        keep = [d for d in self.docs if not _matches(d, query or {})]
        removed = len(self.docs) - len(keep)
        self.docs = keep
        return _UpdateResult(removed, None)

    async def create_index(self, *args, **kwargs):
        return None

    def aggregate(self, pipeline):
        raise NotImplementedError("fake db: aggregate")


class FakeDB:
    """Collections spring into existence on first access, like a real database."""

    def __init__(self):
        self._collections: Dict[str, Collection] = {}
        # The indexes Q-Rating actually depends on for correctness.
        self.qrating_history.create_unique_index("idempotent_key")
        self.qrating_profiles.create_unique_index("firebase_uid")
        self.qrating_standings.create_unique_index("round_id", "firebase_uid")
        self.qrating_registrations.create_unique_index("round_id", "firebase_uid")
        self.qrating_tasks.create_unique_index("slug")
        self.qrating_rounds.create_unique_index("round_number")
        self.xp_history.create_unique_index("firebase_uid", "idempotent_key")

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return self._collections.setdefault(name, Collection(name))

    def __getitem__(self, name):
        return getattr(self, name)
