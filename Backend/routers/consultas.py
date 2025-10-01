from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Consulta, Evolucion, MotivoConsulta
from schemas import ConsultaCreate, ConsultaOut, ConsultaUpdate, EvolucionCreate, EvolucionOut, EvolucionUpdate

router = APIRouter()


# ------------------------------------------
# CONSULTAS
# ------------------------------------------

@router.post("/", response_model=ConsultaOut)
def crear_consulta(consulta: ConsultaCreate, db: Session = Depends(get_db)):
    nueva = Consulta(**consulta.dict())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.get("/{id_paciente}")
def obtener_consultas(id_paciente: int, db: Session = Depends(get_db)):
    consultas = db.query(Consulta).filter(Consulta.id_paciente == id_paciente).order_by(Consulta.fecha_consulta.desc()).all()

    motivos_dict = {
        m.id_motivo: m.motivo_consulta for m in db.query(MotivoConsulta).all()
    }

    resultado = []
    for c in consultas:
        consulta_dict = c.__dict__.copy()
        consulta_dict["nombre_motivo"] = motivos_dict.get(c.motivo)
        if hasattr(c, "fecha_consulta") and c.fecha_consulta:
            consulta_dict["fecha"] = c.fecha_consulta.isoformat()
        resultado.append(consulta_dict)

    return resultado


@router.put("/consultas/{id_consulta}", response_model=ConsultaOut)
def actualizar_consulta(id_consulta: int, datos: ConsultaUpdate, db: Session = Depends(get_db)):
    consulta = db.query(Consulta).filter(Consulta.id == id_consulta).first()
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    for key, value in datos.dict(exclude_unset=True).items():
        setattr(consulta, key, value)
    db.commit()
    db.refresh(consulta)
    return consulta


@router.delete("/{id_consulta}")
def eliminar_consulta(id_consulta: int, db: Session = Depends(get_db)):
    consulta = db.query(Consulta).filter(Consulta.id_consulta == id_consulta).first()
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")

    # Borrar evoluciones asociadas
    db.query(Evolucion).filter(Evolucion.id_consulta == id_consulta).delete()

    # Borrar la consulta
    db.delete(consulta)
    db.commit()
    return {"mensaje": "Consulta y evoluciones eliminadas"}


# ------------------------------------------
# EVOLUCIONES
# ------------------------------------------

@router.post("/evoluciones/", response_model=EvolucionOut)
def crear_evolucion(evolucion: EvolucionCreate, db: Session = Depends(get_db)):
    nueva = Evolucion(**evolucion.dict())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.get("/evoluciones/{id_consulta}", response_model=list[EvolucionOut])
def obtener_evoluciones(id_consulta: int, db: Session = Depends(get_db)):
    return db.query(Evolucion).filter(Evolucion.id_consulta == id_consulta).order_by(Evolucion.fecha.desc()).all()


@router.put("/evoluciones/{id_evolucion}", response_model=EvolucionOut)
def actualizar_evolucion(id_evolucion: int, datos: EvolucionUpdate, db: Session = Depends(get_db)):
    evo = db.query(Evolucion).filter(Evolucion.id == id_evolucion).first()
    if not evo:
        raise HTTPException(status_code=404, detail="Evolución no encontrada")
    for key, value in datos.dict(exclude_unset=True).items():
        setattr(evo, key, value)
    db.commit()
    db.refresh(evo)
    return evo


