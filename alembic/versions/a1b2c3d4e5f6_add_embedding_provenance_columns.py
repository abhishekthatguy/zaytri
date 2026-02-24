"""Add user plan and embedding provenance columns

Hybrid Architecture V2: tracks which provider (ollama/openai) and model
generated each embedding, enabling free/pro tier routing.

Revision ID: a1b2c3d4e5f6
Revises: 986f24928b1a
Create Date: 2026-02-24 01:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '986f24928b1a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add user plan column (controls free/pro embedding route)
    #    Create the enum type first
    userplan_enum = sa.Enum('free', 'pro', name='userplan')
    userplan_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'users',
        sa.Column('plan', userplan_enum, nullable=False, server_default='free')
    )

    # 2. Add embedding provenance columns
    op.add_column(
        'document_embeddings',
        sa.Column('embedding_provider', sa.String(50), nullable=True, server_default='ollama')
    )
    op.add_column(
        'document_embeddings',
        sa.Column('embedding_model', sa.String(100), nullable=True, server_default='nomic-embed-text')
    )


def downgrade() -> None:
    op.drop_column('document_embeddings', 'embedding_model')
    op.drop_column('document_embeddings', 'embedding_provider')
    op.drop_column('users', 'plan')
    # Drop the enum type
    sa.Enum(name='userplan').drop(op.get_bind(), checkfirst=True)
