"""initial Halberd & Co domain schema

Applies the hand-written SQL in api/db/migrations/001_initial_schema.sql rather
than autogenerating — field names and constraints are explicit there and that
file is the source of truth for the schema.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-06-04
"""

from pathlib import Path
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SQL_FILE = (
    Path(__file__).resolve().parents[2] / "db" / "migrations" / "001_initial_schema.sql"
)


def upgrade() -> None:
    sql = _SQL_FILE.read_text()
    op.execute(sql)


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS rate_snapshots CASCADE;
        DROP TABLE IF EXISTS loads CASCADE;
        DROP TABLE IF EXISTS lanes CASCADE;
        DROP TABLE IF EXISTS carriers CASCADE;
        DROP TABLE IF EXISTS shippers CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
        """
    )
