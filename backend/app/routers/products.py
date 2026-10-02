from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, get_current_user
from app.database import get_db
from app.models import Product
from app.schemas_product import ProductOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), _: FirebaseUser = Depends(get_current_user)):
    """Somente leitura pela API — mesma regra do Firestore (`allow write: if false`).
    Catalogo e cadastrado fora do app (seed/admin), nao ha endpoint de escrita."""
    return db.query(Product).order_by(Product.category.asc()).all()
