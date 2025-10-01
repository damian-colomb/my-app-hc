# ----------------------------------
# DERIVADORES
# ----------------------------------

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Derivador
from schemas import DerivadorSchema, DerivadorCreateSchema
from typing import List

router = APIRouter()

@router.get("/derivadores/", response_model=List[DerivadorSchema])
def obtener_derivadores(db: Session = Depends(get_db)):
    return db.query(Derivador).order_by(Derivador.nombre_derivador).all()

@router.post("/derivadores/", response_model=DerivadorSchema)
def crear_derivador(derivador: DerivadorCreateSchema, db: Session = Depends(get_db)):
    nuevo = Derivador(**derivador.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.delete("/derivadores/{id_derivador}")
def eliminar_derivador(id_derivador: int, db: Session = Depends(get_db)):
    derivador = db.query(Derivador).filter(Derivador.id_derivador == id_derivador).first()
    if not derivador:
        raise HTTPException(status_code=404, detail="Derivador no encontrado.")
    db.delete(derivador)
    db.commit()
    return {"ok": True}

@router.put("/derivadores/{id_derivador}")
def actualizar_derivador(id_derivador: int, derivador: DerivadorCreateSchema, db: Session = Depends(get_db)):
    db_derivador = db.query(Derivador).filter(Derivador.id_derivador == id_derivador).first()
    if not db_derivador:
        raise HTTPException(status_code=404, detail="Derivador no encontrado")
    db_derivador.nombre_derivador = derivador.nombre_derivador
    db.commit()
    db.refresh(db_derivador)
    return db_derivador

