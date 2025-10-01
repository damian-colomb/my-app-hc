from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from models import Evolucion
from schemas import EvolucionCreate  # or use EvolucionBase if preferred

router = APIRouter(prefix="/evoluciones", tags=["Evoluciones"])


# ✅ 1. Crear una evolución
@router.post("/", response_model=schemas.EvolucionOut)
def crear_evolucion(evolucion: schemas.EvolucionCreate, db: Session = Depends(get_db)):
    nueva_evolucion = models.Evolucion(**evolucion.dict())
    db.add(nueva_evolucion)
    db.commit()
    db.refresh(nueva_evolucion)
    return nueva_evolucion


# ✅ 2. Obtener todas las evoluciones de una consulta específica
@router.get("/consulta/{id_consulta}", response_model=list[schemas.EvolucionOut])
def obtener_evoluciones_por_consulta(id_consulta: int, db: Session = Depends(get_db)):
    evoluciones = (
        db.query(models.Evolucion)
        .filter_by(id_consulta=id_consulta)
        .order_by(models.Evolucion.fecha_evolucion.desc())
        .all()
    )
    return evoluciones

@router.delete("/{id_evolucion}")
def eliminar_evolucion(id_evolucion: int, db: Session = Depends(get_db)):
    evolucion = db.query(Evolucion).filter(Evolucion.id_evolucion == id_evolucion).first()
    if not evolucion:
        raise HTTPException(status_code=404, detail="Evolución no encontrada")
    db.delete(evolucion)
    db.commit()
    return {"mensaje": "Evolución eliminada correctamente"}


# PUT endpoint para actualizar una evolución existente
@router.put("/{id_evolucion}", response_model=schemas.EvolucionOut)
def actualizar_evolucion(id_evolucion: int, evolucion_in: schemas.EvolucionCreate, db: Session = Depends(get_db)):
    # Buscar la evolución existente
    evolucion = db.query(models.Evolucion).filter(models.Evolucion.id_evolucion == id_evolucion).first()
    if not evolucion:
        raise HTTPException(status_code=404, detail="Evolución no encontrada")
    # Actualizar campos
    evolucion.id_consulta = evolucion_in.id_consulta
    evolucion.fecha_evolucion = evolucion_in.fecha_evolucion
    evolucion.contenido = evolucion_in.contenido
    db.commit()
    db.refresh(evolucion)
    return evolucion


