from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(
    prefix="/profesionales",
    tags=["Profesionales"]
)

# CIRUJANOS
@router.get("/cirujanos", response_model=list[schemas.CirujanoOut])
def listar_cirujanos(db: Session = Depends(get_db)):
    return db.query(models.Cirujano).order_by(models.Cirujano.nombre).all()

@router.post("/cirujanos", response_model=schemas.CirujanoOut)
def crear_cirujano(cirujano: schemas.CirujanoCreate, db: Session = Depends(get_db)):
    existente = db.query(models.Cirujano).filter(models.Cirujano.nombre == cirujano.nombre).first()
    if existente:
        existente.activo = True
        db.commit()
        db.refresh(existente)
        return existente
    nuevo = models.Cirujano(nombre=cirujano.nombre)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.patch("/cirujanos/{id}", response_model=schemas.CirujanoOut)
def actualizar_estado_cirujano(id: str, activo: bool, db: Session = Depends(get_db)):
    cirujano = db.query(models.Cirujano).filter(models.Cirujano.id == id).first()
    if not cirujano:
        raise HTTPException(status_code=404, detail="Cirujano no encontrado")
    cirujano.activo = activo
    db.commit()
    db.refresh(cirujano)
    return cirujano


# ANESTESIOLOGOS
@router.get("/anestesiologos", response_model=list[schemas.AnestesiologoOut])
def listar_anestesiologos(db: Session = Depends(get_db)):
    return db.query(models.Anestesiologo).order_by(models.Anestesiologo.nombre).all()

@router.post("/anestesiologos", response_model=schemas.AnestesiologoOut)
def crear_anestesiologo(anest: schemas.AnestesiologoCreate, db: Session = Depends(get_db)):
    existente = db.query(models.Anestesiologo).filter(models.Anestesiologo.nombre == anest.nombre).first()
    if existente:
        existente.activo = True
        db.commit()
        db.refresh(existente)
        return existente
    nuevo = models.Anestesiologo(nombre=anest.nombre)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.patch("/anestesiologos/{id}", response_model=schemas.AnestesiologoOut)
def actualizar_estado_anestesiologo(id: str, activo: bool, db: Session = Depends(get_db)):
    anest = db.query(models.Anestesiologo).filter(models.Anestesiologo.id == id).first()
    if not anest:
        raise HTTPException(status_code=404, detail="Anestesiólogo no encontrado")
    anest.activo = activo
    db.commit()
    db.refresh(anest)
    return anest


# INSTRUMENTADORES
@router.get("/instrumentadores", response_model=list[schemas.InstrumentadorOut])
def listar_instrumentadores(db: Session = Depends(get_db)):
    return db.query(models.Instrumentador).order_by(models.Instrumentador.nombre).all()

@router.post("/instrumentadores", response_model=schemas.InstrumentadorOut)
def crear_instrumentador(instr: schemas.InstrumentadorCreate, db: Session = Depends(get_db)):
    existente = db.query(models.Instrumentador).filter(models.Instrumentador.nombre == instr.nombre).first()
    if existente:
        return existente
    nuevo = models.Instrumentador(nombre=instr.nombre)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo