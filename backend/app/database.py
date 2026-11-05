from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# O Neon (plano gratuito) suspende o banco depois de alguns minutos parado e
# derruba as conexões abertas. pool_pre_ping testa a conexão antes de usar e
# reabre se ela tiver caído, em vez de devolver erro 500 na primeira chamada.
engine = create_engine(settings.database_url, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
