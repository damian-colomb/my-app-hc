# ----------------------------------
# TURNOS
# ----------------------------------

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Turno, Derivador
from schemas import TurnoSchema, TurnoCreateSchema
from typing import List, Optional
from datetime import date

router = APIRouter()

@router.post("/turnos/", response_model=TurnoSchema)
def crear_turno(turno: TurnoCreateSchema, db: Session = Depends(get_db)):
    nuevo_turno = Turno(**turno.dict())
    db.add(nuevo_turno)
    db.commit()
    db.refresh(nuevo_turno)

    # Traemos el nombre del derivador si existe
    nombre_derivador = None
    if nuevo_turno.derivador:
        derivador = db.query(Derivador).filter(Derivador.id_derivador == nuevo_turno.derivador).first()
        if derivador:
            nombre_derivador = derivador.nombre_derivador

    return TurnoSchema(
        **nuevo_turno.__dict__,
        nombre_derivador=nombre_derivador
    )

@router.get("/turnos/", response_model=List[TurnoSchema])
def obtener_turnos(fecha: Optional[date] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Turno)
    if fecha:
        query = query.filter(Turno.fecha == fecha)
    turnos = query.order_by(Turno.fecha).all()

    resultados = []
    for turno in turnos:
        nombre_derivador = None
        if turno.derivador:
            derivador = db.query(Derivador).filter(Derivador.id_derivador == turno.derivador).first()
            if derivador:
                nombre_derivador = derivador.nombre_derivador
        resultados.append(TurnoSchema(**turno.__dict__, nombre_derivador=nombre_derivador))
    return resultados



# Actualizar un turno existente
@router.put("/turnos/{id_turno}", response_model=TurnoSchema)
def actualizar_turno(id_turno: int, turno: TurnoCreateSchema, db: Session = Depends(get_db)):
    db_turno = db.query(Turno).filter(Turno.id_turno == id_turno).first()
    if not db_turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado.")

    datos_actualizados = turno.dict()
    for attr, value in datos_actualizados.items():
        setattr(db_turno, attr, value)

    db.commit()
    db.refresh(db_turno)

    nombre_derivador = None
    if db_turno.derivador:
        derivador = db.query(Derivador).filter(Derivador.id_derivador == db_turno.derivador).first()
        if derivador:
            nombre_derivador = derivador.nombre_derivador

    return TurnoSchema(
        **db_turno.__dict__,
        nombre_derivador=nombre_derivador
    )


@router.delete("/turnos/{id_turno}")
def eliminar_turno(id_turno: int, db: Session = Depends(get_db)):
    """
    Elimina un turno por su ID.
    """
    turno = db.query(Turno).filter(Turno.id_turno == id_turno).first()
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado.")
    
    db.delete(turno)
    db.commit()
    return {"ok": True}