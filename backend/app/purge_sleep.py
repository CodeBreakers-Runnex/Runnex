"""Expurgo diário: python -m app.purge_sleep (usar no agendamento do deploy)."""

from app.database import SessionLocal
from app.services.sleep import purge_old_data


def main() -> None:
    with SessionLocal() as db:
        purge_old_data(db)
        db.commit()


if __name__ == "__main__":
    main()
