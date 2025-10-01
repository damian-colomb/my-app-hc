# routers/procedimientos.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session  
from typing import List
from database import get_db
import models, schemas
from sqlalchemy import text



router = APIRouter(
    prefix="/procedimientos",
    tags=["Procedimientos"]
)

# ----------------------------------------
# 1) Procedimientos base (CRUD mínimo)
# ----------------------------------------

@router.get(
    "/bases",
    response_model=list[schemas.ProcedimientoBaseOut],
    summary="Listar tipos de procedimiento"
)
def listar_procedimientos_base(db: Session = Depends(get_db)):
    return db.query(models.ProcedimientoBase).order_by(models.ProcedimientoBase.procedimiento).all()

@router.post(
    "/bases",
    response_model=schemas.ProcedimientoBaseOut,
    summary="Crear un tipo de procedimiento"
)
def crear_procedimiento_base(item: schemas.ProcedimientoBaseCreate, db: Session = Depends(get_db)):
    # Validar duplicados
    exists = db.query(models.ProcedimientoBase).filter_by(procedimiento=item.procedimiento).first()
    if exists:
        raise HTTPException(status_code=400, detail="Ya existe ese tipo de procedimiento")
    nuevo = models.ProcedimientoBase(**item.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


# ----------------------------------------
# 2) Instituciones (CRUD mínimo)
# ----------------------------------------

@router.get(
    "/instituciones",
    response_model=list[schemas.InstitucionBaseOut],
    summary="Listar instituciones"
)
def listar_instituciones(db: Session = Depends(get_db)):
    return db.query(models.InstitucionBase).order_by(models.InstitucionBase.institucion).all()

@router.post(
    "/instituciones",
    response_model=schemas.InstitucionBaseOut,
    summary="Crear una institución"
)
def crear_institucion(item: schemas.InstitucionBaseCreate, db: Session = Depends(get_db)):
    exists = db.query(models.InstitucionBase).filter_by(institucion=item.institucion).first()
    if exists:
        raise HTTPException(status_code=400, detail="Ya existe esa institución")
    nueva = models.InstitucionBase(**item.dict())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


# --------------------------------------------------
# 3) Procedimientos de Paciente (CRUD completo)
# --------------------------------------------------

@router.post(
    "/pacientes",
    response_model=schemas.ProcedimientoPacienteOut,
    summary="Asignar un procedimiento a un paciente"
)
def crear_procedimiento_paciente(
    item: schemas.ProcedimientoPacienteCreate,
    db: Session = Depends(get_db)
):
    # Validar paciente
    if not db.get(models.Paciente, item.id_paciente):
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    # Validar tipo base
    if not db.get(models.ProcedimientoBase, item.id_procedimiento_base):
        raise HTTPException(status_code=404, detail="Tipo de procedimiento no existe")
    # Validar institución
    if not db.get(models.InstitucionBase, item.id_institucion):
        raise HTTPException(status_code=404, detail="Institución no encontrada")

    nuevo = models.ProcedimientoPaciente(**item.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.get(
    "/pacientes/{id_paciente}",
    summary="Listar procedimientos de un paciente (flatten)"
)
def listar_procedimientos_paciente(id_paciente: int, db: Session = Depends(get_db)):
    """
    Devuelve filas listas para el front:
    - id_procedimiento_paciente, fecha, tipo_cirugia, id_procedimiento_base, procedimiento_base_nombre
    - id_parte, hora_inicio, hora_fin
    - id_procedimiento (técnica), nombre_tecnica
    """
    rows = db.execute(text("""
        SELECT 
            pp.id_procedimiento_paciente,
            pp.fecha,
            pp.tipo_cirugia,
            pp.id_procedimiento_base,
            pb.procedimiento    AS procedimiento_base_nombre,
            pq.id_parte,
            pq.hora_inicio,
            pq.hora_fin,
            pq.id_procedimiento,            -- id técnica si lo guardás ahí
            t.nombre_tecnica    AS nombre_tecnica,
            pp.patologia        AS patologia,
            pp.cultivo          AS cultivo
        FROM procedimientos_pacientes pp
        LEFT JOIN procedimientos_base pb 
            
            ON pb.id_procedimiento = pp.id_procedimiento_base
        LEFT JOIN partes_quirurgicos pq
            ON pq.id_procedimiento_paciente = pp.id_procedimiento_paciente
        LEFT JOIN tecnicas t
            ON t.id_tecnica = pq.id_procedimiento  -- ojo: si aún no lo guardás, podría venir NULL
        WHERE pp.id_paciente = :id_paciente
        ORDER BY pp.fecha DESC, pp.id_procedimiento_paciente DESC
    """), {"id_paciente": id_paciente}).mappings().all()

    return [dict(r) for r in rows]

@router.get(
    "/{id}",
    response_model=schemas.ProcedimientoPacienteOut,
    summary="Obtener un procedimiento asignado por ID"
)
def obtener_procedimiento_paciente(id: int, db: Session = Depends(get_db)):
    rec = db.get(models.ProcedimientoPaciente, id)
    if not rec:
        raise HTTPException(status_code=404, detail="Procedimiento de paciente no encontrado")
    return rec

@router.put(
    "/{id}",
    response_model=schemas.ProcedimientoPacienteOut,
    summary="Actualizar un procedimiento asignado"
)
def actualizar_procedimiento_paciente(
    id: int,
    item: schemas.ProcedimientoPacienteUpdate,
    db: Session = Depends(get_db)
):
    rec = db.get(models.ProcedimientoPaciente, id)
    if not rec:
        raise HTTPException(status_code=404, detail="Procedimiento de paciente no encontrado")

    # Validaciones similares si cambian llaves foráneas
    if item.id_procedimiento_base and not db.get(models.ProcedimientoBase, item.id_procedimiento_base):
        raise HTTPException(status_code=404, detail="Tipo de procedimiento no existe")
    if item.id_institucion and not db.get(models.InstitucionBase, item.id_institucion):
        raise HTTPException(status_code=404, detail="Institución no encontrada")

    # Aplicar cambios
    for k, v in item.dict(exclude_unset=True).items():
        setattr(rec, k, v)
    db.commit()
    db.refresh(rec)
    return rec

@router.delete(
    "/{id}",
    response_model=dict,
    summary="Eliminar un procedimiento asignado"
)
def eliminar_procedimiento_paciente(id: int, db: Session = Depends(get_db)):
    rec = db.get(models.ProcedimientoPaciente, id)
    if not rec:
        raise HTTPException(status_code=404, detail="Procedimiento de paciente no encontrado")
    db.delete(rec)
    db.commit()
    return {"detail": "Procedimiento eliminado correctamente"}
