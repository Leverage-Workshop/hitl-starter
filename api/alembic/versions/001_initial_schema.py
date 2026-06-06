"""initial Halberd & Co domain schema

Applies the hand-written SQL in api/db/migrations/001_initial_schema.sql rather
than autogenerating — field names and constraints are explicit there and that
file is the source of truth for the schema.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-06-04
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SQL_FILE = (
    Path(__file__).resolve().parents[2] / "db" / "migrations" / "001_initial_schema.sql"
)


def _split_statements(sql: str) -> list[str]:
    """Split SQL into individual statements, respecting $$ dollar-quoted blocks.

    asyncpg cannot prepare a multi-statement string, so each statement must be
    executed separately. We stash $$ ... $$ blocks before splitting on ; to avoid
    treating semicolons inside function bodies as statement boundaries.
    """
    stash: dict[str, str] = {}

    def hide(m: re.Match) -> str:
        key = f"__BLOCK_{len(stash)}__"
        stash[key] = m.group(0)
        return key

    safe = re.sub(r"\$\$.*?\$\$", hide, sql, flags=re.DOTALL)
    # Strip line comments before splitting — comments can contain semicolons
    # that would otherwise produce bogus statement fragments.
    safe = re.sub(r"--[^\n]*", "", safe)

    statements = []
    for raw in safe.split(";"):
        stmt = raw.strip()
        if stmt:
            for key, val in stash.items():
                stmt = stmt.replace(key, val)
            statements.append(stmt)
    return statements


def upgrade() -> None:
    for stmt in _split_statements(_SQL_FILE.read_text()):
        op.execute(text(stmt))


def downgrade() -> None:
    drops = """
        DROP TABLE IF EXISTS rate_snapshots CASCADE;
        DROP TABLE IF EXISTS loads CASCADE;
        DROP TABLE IF EXISTS lanes CASCADE;
        DROP TABLE IF EXISTS carriers CASCADE;
        DROP TABLE IF EXISTS shippers CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
    """
    for stmt in _split_statements(drops):
        op.execute(text(stmt))
