from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/categories", tags=["Categories"])

@router.get("", response_model=List[schemas.CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)

@router.post("", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(cat_in: schemas.CategoryCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_category(db, cat_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{category_id}", response_model=schemas.CategoryResponse)
def update_category(category_id: int, cat_in: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    updated = crud.update_category(db, category_id, cat_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found.")
    return updated

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    reassign_to_id: Optional[int] = Query(None, description="Optional category ID to reassign linked transactions to"),
    db: Session = Depends(get_db)
):
    try:
        success = crud.delete_category(db, category_id, reassign_to_id)
        if not success:
            raise HTTPException(status_code=404, detail="Category not found.")
        return {"message": "Category deleted successfully.", "category_id": category_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
