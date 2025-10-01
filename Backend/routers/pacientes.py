"""Este archivo contiene los endpoints relacionados a PACIENTES y ENTIDADES AUXILIARES (Coberturas, Nacionalidades, Localidades, Sexo)."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from database import get_db
from models import Sexo, Paciente, Cobertura, Nacionalidad, Localidad, Turno
from schemas import TurnoCreateSchema, TurnoSchema
from schemas import (
    PacienteConCobertura,
    PacienteCreate,
    PacientePaginatedResponse,
    CoberturaSchema, NacionalidadSchema, LocalidadSchema,
    CoberturaCreateSchema, NacionalidadCreateSchema, LocalidadCreateSchema,SexoSchema
)
from typing import List


router = APIRouter()

# ----------------------------------
# PACIENTES
# ----------------------------------

@router.post("/pacientes/", summary="Crear un nuevo paciente")
def crear_paciente(paciente: PacienteCreate, db: Session = Depends(get_db)):
    nuevo = Paciente(**paciente.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {
        "id_paciente": nuevo.id_paciente,
        "nombre": nuevo.nombre,
        "dni": nuevo.dni,
        "fecha_nacimiento": nuevo.fecha_nacimiento,
        "sexo": nuevo.sexo,
        "cobertura": nuevo.cobertura,
        "beneficio": nuevo.beneficio,
        "nacionalidad": nuevo.nacionalidad,
        "localidad": nuevo.localidad,
        "telefono": nuevo.telefono,
        "email": nuevo.email,
        "anexo": nuevo.anexo,
        "nombre_cobertura": nuevo.cobertura_rel.nombre_cobertura if nuevo.cobertura_rel else None,
        "nombre_nacionalidad": nuevo.nacionalidad_rel.nombre_nacionalidad if nuevo.nacionalidad_rel else None,
        "nombre_localidad": nuevo.localidad_rel.nombre_localidad if nuevo.localidad_rel else None,
    }

def _mapear_paciente(paciente: Paciente) -> PacienteConCobertura:
    return PacienteConCobertura(
        id_paciente=paciente.id_paciente,
        nombre=paciente.nombre,
        dni=paciente.dni,
        fecha_nacimiento=paciente.fecha_nacimiento,
        sexo=paciente.sexo,
        cobertura=paciente.cobertura,
        beneficio=paciente.beneficio,
        nacionalidad=paciente.nacionalidad,
        localidad=paciente.localidad,
        telefono=paciente.telefono,
        email=paciente.email,
        anexo=paciente.anexo,
        nombre_cobertura=paciente.cobertura_rel.nombre_cobertura if paciente.cobertura_rel else None,
        nombre_nacionalidad=paciente.nacionalidad_rel.nombre_nacionalidad if paciente.nacionalidad_rel else None,
        nombre_localidad=paciente.localidad_rel.nombre_localidad if paciente.localidad_rel else None,
    )


@router.get("/pacientes/", response_model=PacientePaginatedResponse)
def obtener_pacientes(
    include_inactivos: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str = Query("", min_length=0),
    db: Session = Depends(get_db),
):
    query = db.query(Paciente)
    if not include_inactivos:
        query = query.filter(Paciente.activo.is_(True))

    termino = search.strip().lower()
    if termino:
        like_term = f"%{termino}%"
        query = query.filter(
            or_(
                func.lower(Paciente.nombre).ilike(like_term),
                Paciente.dni.ilike(f"%{search.strip()}%"),
            )
        )

    total = query.count()

    offset = (page - 1) * page_size
    pacientes = (
        query
        .order_by(func.lower(Paciente.nombre))
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [_mapear_paciente(p) for p in pacientes]

    return PacientePaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# PUT paciente
@router.put("/pacientes/{id_paciente}", summary="Editar paciente")
def editar_paciente(id_paciente: int, paciente: PacienteCreate, db: Session = Depends(get_db)):
    existente = db.query(Paciente).filter(Paciente.id_paciente == id_paciente).first()
    if not existente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")

    # Verifica si hay otro paciente con el mismo DNI
    paciente_con_dni = db.query(Paciente).filter(Paciente.dni == paciente.dni, Paciente.id_paciente != id_paciente).first()
    if paciente_con_dni:
        raise HTTPException(
            status_code=400,
    detail={
        "error": "DNI duplicado",
        "pacienteExistente": paciente_con_dni.nombre
        }
    )

    for key, value in paciente.dict().items():
        setattr(existente, key, value)

    db.commit()
    db.refresh(existente)

    return {
        "id_paciente": existente.id_paciente,
        "nombre": existente.nombre,
        "dni": existente.dni,
        "fecha_nacimiento": existente.fecha_nacimiento,
        "sexo": existente.sexo,
        "cobertura": existente.cobertura,
        "beneficio": existente.beneficio,
        "nacionalidad": existente.nacionalidad,
        "localidad": existente.localidad,
        "telefono": existente.telefono,
        "email": existente.email,
        "anexo": existente.anexo,
        "nombre_cobertura": existente.cobertura_rel.nombre_cobertura if existente.cobertura_rel else None,
        "nombre_nacionalidad": existente.nacionalidad_rel.nombre_nacionalidad if existente.nacionalidad_rel else None,
        "nombre_localidad": existente.localidad_rel.nombre_localidad if existente.localidad_rel else None,
    }


@router.get("/pacientes/historia", summary="Obtener pacientes con todos los datos legibles", response_model=List[PacienteConCobertura])
def obtener_pacientes_historia(db: Session = Depends(get_db)):
    pacientes = db.query(Paciente).all()
    resultado = []
    for p in pacientes:
        resultado.append(PacienteConCobertura(
            id_paciente=p.id_paciente,
            nombre=p.nombre,
            dni=p.dni,
            fecha_nacimiento=p.fecha_nacimiento,
            sexo=p.sexo,

            cobertura=p.cobertura,
            beneficio=p.beneficio,
            nacionalidad=p.nacionalidad,
            localidad=p.localidad,
            telefono=p.telefono,
            email=p.email,
            anexo=p.anexo,
            nombre_cobertura=p.cobertura_rel.nombre_cobertura if p.cobertura_rel else None,
            nombre_nacionalidad=p.nacionalidad_rel.nombre_nacionalidad if p.nacionalidad_rel else None,
            nombre_localidad=p.localidad_rel.nombre_localidad if p.localidad_rel else None
        ))
    return resultado

# GET para mostrar el paciente segun el ID: Muestra los Id por si tenemos que modificar y los datos que le corresponden:
@router.get("/pacientes/historia/{id_paciente}", response_model=PacienteConCobertura)
def obtener_paciente_historia(id_paciente: int, db: Session = Depends(get_db)):
    p = db.query(Paciente).filter(Paciente.id_paciente == id_paciente).first()
    if not p:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    return PacienteConCobertura(
        id_paciente=p.id_paciente,
        nombre=p.nombre,
        dni=p.dni,
        fecha_nacimiento=p.fecha_nacimiento,
        sexo=p.sexo,
        cobertura=p.cobertura,
        beneficio=p.beneficio,
        nacionalidad=p.nacionalidad,
        localidad=p.localidad,
        telefono=p.telefono,
        email=p.email,
        anexo=p.anexo,
        nombre_cobertura=p.cobertura_rel.nombre_cobertura if p.cobertura_rel else None,
        nombre_nacionalidad=p.nacionalidad_rel.nombre_nacionalidad if p.nacionalidad_rel else None,
        nombre_localidad=p.localidad_rel.nombre_localidad if p.localidad_rel else None
    )


@router.delete("/pacientes/{id_paciente}")
def eliminar_paciente(id_paciente: int, db: Session = Depends(get_db)):
    paciente = db.query(Paciente).filter(Paciente.id_paciente == id_paciente).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    if not paciente.activo:
        return {"success": True, "msg": "El paciente ya estaba inactivo"}

    paciente.activo = False
    db.commit()
    return {"success": True}


@router.post("/pacientes/{id_paciente}/restaurar")
def restaurar_paciente(id_paciente: int, db: Session = Depends(get_db)):
    paciente = db.query(Paciente).filter(Paciente.id_paciente == id_paciente).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    if paciente.activo:
        return {"success": True, "msg": "El paciente ya estaba activo"}

    paciente.activo = True
    db.commit()
    return {"success": True}


# ----------------------------------
# COBERTURAS
# ----------------------------------

@router.get("/coberturas/", response_model=List[CoberturaSchema])
def obtener_coberturas(db: Session = Depends(get_db)):
    return db.query(Cobertura).order_by(Cobertura.nombre_cobertura).all()

@router.post("/coberturas/", response_model=CoberturaSchema)
def crear_cobertura(cobertura: CoberturaCreateSchema, db: Session = Depends(get_db)):
    existente = db.query(Cobertura).filter(
        func.lower(Cobertura.nombre_cobertura) == cobertura.nombre_cobertura.lower()
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="La cobertura ya existe.")
    nueva = Cobertura(**cobertura.dict())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

@router.put("/coberturas/{cobertura_id}", response_model=CoberturaSchema)
def actualizar_cobertura(cobertura_id: int, cobertura: CoberturaCreateSchema, db: Session = Depends(get_db)):
    cobertura_db = db.query(Cobertura).filter(Cobertura.id_cobertura == cobertura_id).first()
    if not cobertura_db:
        raise HTTPException(status_code=404, detail="Cobertura no encontrada")

    duplicado = db.query(Cobertura).filter(
        func.lower(Cobertura.nombre_cobertura) == cobertura.nombre_cobertura.lower(),
        Cobertura.id_cobertura != cobertura_id
    ).first()
    if duplicado:
        raise HTTPException(status_code=400, detail="Ya existe otra cobertura con ese nombre.")

    cobertura_db.nombre_cobertura = cobertura.nombre_cobertura
    db.commit()
    db.refresh(cobertura_db)
    return cobertura_db

@router.delete("/coberturas/{cobertura_id}")
def eliminar_cobertura(cobertura_id: int, db: Session = Depends(get_db)):
    cobertura_db = db.query(Cobertura).filter(Cobertura.id_cobertura == cobertura_id).first()
    if not cobertura_db:
        raise HTTPException(status_code=404, detail="Cobertura no encontrada")

    pacientes_con_cobertura = db.query(Paciente).filter(Paciente.cobertura == cobertura_id).first()
    if pacientes_con_cobertura:
        raise HTTPException(status_code=400, detail="No se puede eliminar, hay pacientes usando esta cobertura")

    db.delete(cobertura_db)
    db.commit()
    return {"ok": True}


# ----------------------------------
# NACIONALIDADES
# ----------------------------------

@router.get("/nacionalidades/", response_model=List[NacionalidadSchema])
def obtener_nacionalidades(db: Session = Depends(get_db)):
    return db.query(Nacionalidad).order_by(Nacionalidad.nombre_nacionalidad).all()

@router.post("/nacionalidades/", response_model=NacionalidadSchema)
def crear_nacionalidad(nacionalidad: NacionalidadCreateSchema, db: Session = Depends(get_db)):
    existente = db.query(Nacionalidad).filter(
        func.lower(Nacionalidad.nombre_nacionalidad) == nacionalidad.nombre_nacionalidad.lower()
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="La nacionalidad ya existe.")
    nueva = Nacionalidad(**nacionalidad.dict())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

@router.put("/nacionalidades/{id}", response_model=NacionalidadSchema)
def editar_nacionalidad(id: int, nacionalidad: NacionalidadCreateSchema, db: Session = Depends(get_db)):
    actual = db.query(Nacionalidad).filter(Nacionalidad.id_nacionalidad == id).first()
    if not actual:
        raise HTTPException(status_code=404, detail="Nacionalidad no encontrada.")
    
    duplicado = db.query(Nacionalidad).filter(
        func.lower(Nacionalidad.nombre_nacionalidad) == nacionalidad.nombre_nacionalidad.lower(),
        Nacionalidad.id_nacionalidad != id
    ).first()
    if duplicado:
        raise HTTPException(status_code=400, detail="Ya existe una nacionalidad con ese nombre.")
    
    actual.nombre_nacionalidad = nacionalidad.nombre_nacionalidad
    db.commit()
    db.refresh(actual)
    return actual

@router.delete("/nacionalidades/{id}")
def eliminar_nacionalidad(id: int, db: Session = Depends(get_db)):
    nacionalidad = db.query(Nacionalidad).filter(Nacionalidad.id_nacionalidad == id).first()
    if not nacionalidad:
        raise HTTPException(status_code=404, detail="Nacionalidad no encontrada.")
    
    relacionada = db.query(Paciente).filter(Paciente.nacionalidad == id).first()
    if relacionada:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay pacientes usando esta nacionalidad.")
    
    db.delete(nacionalidad)
    db.commit()
    return {"ok": True}


# ----------------------------------
# LOCALIDADES
# ----------------------------------

@router.get("/localidades/", response_model=List[LocalidadSchema])
def obtener_localidades(db: Session = Depends(get_db)):
    return db.query(Localidad).order_by(Localidad.nombre_localidad).all()

@router.post("/localidades/", response_model=LocalidadSchema)
def crear_localidad(localidad: LocalidadCreateSchema, db: Session = Depends(get_db)):
    nombre_limpio = localidad.nombre_localidad.strip()

    localidades = db.query(Localidad).all()
    for loc in localidades:
        if loc.nombre_localidad.strip().lower() == nombre_limpio.lower():
            raise HTTPException(status_code=400, detail="La localidad ya existe.")

    nueva = Localidad(nombre_localidad=nombre_limpio)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

@router.put("/localidades/{id}", response_model=LocalidadSchema)
def editar_localidad(id: int, localidad: LocalidadCreateSchema, db: Session = Depends(get_db)):
    loc = db.query(Localidad).filter(Localidad.id_localidad == id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Localidad no encontrada.")
    
    duplicado = db.query(Localidad).filter(
        func.lower(Localidad.nombre_localidad) == localidad.nombre_localidad.lower(),
        Localidad.id_localidad != id
    ).first()
    if duplicado:
        raise HTTPException(status_code=400, detail="Ya existe una localidad con ese nombre.")
    
    loc.nombre_localidad = localidad.nombre_localidad.strip()
    db.commit()
    db.refresh(loc)
    return loc

@router.delete("/localidades/{id}")
def eliminar_localidad(id: int, db: Session = Depends(get_db)):
    loc = db.query(Localidad).filter(Localidad.id_localidad == id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Localidad no encontrada.")
    
    relacionada = db.query(Paciente).filter(Paciente.localidad == id).first()
    if relacionada:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay pacientes usando esta localidad.")
    
    db.delete(loc)
    db.commit()
    return {"ok": True}


# ----------------------------------
# SEXO
# ----------------------------------

@router.get("/sexo", response_model=List[SexoSchema])
def get_sexos(db: Session = Depends(get_db)):
    return db.query(Sexo).all()

# ---------------------------------- # TURNOS # ----------------------------------

@router.get("/turnos/", response_model=List[TurnoSchema])
def obtener_turnos(db: Session = Depends(get_db)):
    return db.query(Turno).order_by(Turno.fecha).all()

@router.post("/turnos/", response_model=TurnoSchema)
def crear_turno(turno: TurnoCreateSchema, db: Session = Depends(get_db)):
    nuevo_turno = Turno(**turno.dict())
    db.add(nuevo_turno)
    db.commit()
    db.refresh(nuevo_turno)
    return nuevo_turno

@router.delete("/turnos/{id_turno}")
def eliminar_turno(id_turno: int, db: Session = Depends(get_db)):
    turno = db.query(Turno).filter(Turno.id_turno == id_turno).first()
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado.")
    db.delete(turno)
    db.commit()
    return {"ok": True}
