"""add chatbot_profiles

Revision ID: d48faef56a35
Revises: 68827ca895b0
Create Date: 2026-09-29 16:36:46.445350

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd48faef56a35'
down_revision: Union[str, None] = '68827ca895b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tabela nova, sem linhas existentes: os defaults ficam so no model
    # (Python), sem server_default.
    op.create_table('chatbot_profiles',
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('pace_informado', sa.Float(), nullable=True),
    sa.Column('distancia_frequente', sa.Float(), nullable=True),
    sa.Column('objetivo_principal', sa.String(), nullable=True),
    sa.Column('nivel', sa.String(), nullable=True),
    sa.Column('aguardando_aprofundamento', sa.Boolean(), nullable=False),
    sa.Column('ultimo_topico_explicado', sa.String(), nullable=True),
    sa.Column('respostas_aprendidas', sa.JSON(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.uid'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )


def downgrade() -> None:
    op.drop_table('chatbot_profiles')
