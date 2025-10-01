from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/antecedentes", tags=["Antecedentes"])

@router.post("/", response_model=schemas.AntecedenteOut)
def crear_antecedente(antecedente: schemas.AntecedenteCreate, db: Session = Depends(get_db)):
    existente = db.query(models.Antecedente).filter(models.Antecedente.id_paciente == antecedente.id_paciente).first()
    if existente:
        raise HTTPException(status_code=400, detail="El paciente ya tiene antecedentes cargados.")
    
    db_antecedente = models.Antecedente(**antecedente.dict())
    db.add(db_antecedente)
    db.commit()
    db.refresh(db_antecedente)
    return db_antecedente

@router.get("/{id_paciente}", response_model=schemas.AntecedenteOut)
def obtener_antecedente(id_paciente: int, db: Session = Depends(get_db)):
    antecedente = db.query(models.Antecedente).filter_by(id_paciente=id_paciente).first()
    if not antecedente:
        return schemas.AntecedenteOut(
            id=0,
            id_paciente=id_paciente,
            medicos="",
            quirurgicos="",
            alergicos="",
            toxicos="",
            familiares="",
            ginecoobstetricos=""
        )
    return antecedente

@router.put("/{id_paciente}", response_model=schemas.AntecedenteOut)
def actualizar_antecedentes(id_paciente: int, antecedentes: schemas.AntecedenteCreate, db: Session = Depends(get_db)):
    antecedentes_existentes = db.query(models.Antecedente).filter(models.Antecedente.id_paciente == id_paciente).first()
    if not antecedentes_existentes:
        data = antecedentes.dict(exclude={"id_paciente"})
        nuevo_antecedente = models.Antecedente(id_paciente=id_paciente, **data)
        db.add(nuevo_antecedente)
        db.commit()
        db.refresh(nuevo_antecedente)
        return nuevo_antecedente

    for key, value in antecedentes.dict().items():
        if key == "id_paciente":
            continue
        setattr(antecedentes_existentes, key, value)

    db.commit()
    db.refresh(antecedentes_existentes)
    return antecedentes_existentes
