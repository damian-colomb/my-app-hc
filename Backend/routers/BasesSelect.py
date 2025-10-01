from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import (
    Laboratorio, Imagen, Especialidad, MotivoConsulta, OtrosEstudios, Consulta, Interconsulta,
    Cirujano, Anestesiologo, Instrumentador, ProcedimientoBase, TipoAnestesia, Tecnica, Diagnosticos
)
from schemas import (
    LaboratorioCreate, LaboratorioOut,
    ImagenCreate, ImagenOut,
    EspecialidadCreate, EspecialidadOut,MotivoConsultaCreate, MotivoConsultaOut, MotivoConsultaBase,OtroEstudio,OtroEstudioUpdate,OtroEstudioCreate, OtroEstudioBase
)
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import traceback

router = APIRouter(prefix="/bases", tags=["BasesSelect"])

# Helper to normalize rows for selects
def normalize_list(items, mapper):
    out = []
    for it in items:
        out.append(mapper(it))
    return out

# Normalización de texto: trim, colapsar espacios internos y a minúsculas
def _norm_text(s: str) -> str:
    if not s:
        return ""
    return " ".join(s.split()).lower()

##########Endpoint laboratorio:
@router.get("/laboratorio/", response_model=List[LaboratorioOut])
def listar_laboratorios(db: Session = Depends(get_db)):
    try:
        return db.query(Laboratorio).order_by(Laboratorio.laboratorio).all()
    except Exception as e:
        print("[laboratorio] ERROR:", e)
        return []

@router.post("/laboratorio/", response_model=LaboratorioOut)
def crear_laboratorio(item: LaboratorioCreate, db: Session = Depends(get_db)):
    existente = db.query(Laboratorio).filter(Laboratorio.laboratorio == item.laboratorio).first()
    if existente:
        raise HTTPException(status_code=400, detail="El laboratorio ya existe.")
    nuevo = Laboratorio(**item.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.delete("/laboratorio/{id}")
def borrar_laboratorio(id: int, db: Session = Depends(get_db)):
    item = db.query(Laboratorio).get(id)
    if not item:
        raise HTTPException(status_code=404, detail="No encontrado.")
    try:
        db.delete(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el laboratorio porque está siendo utilizado en estudios registrados."
        )
    return {"mensaje": "Laboratorio eliminado"}

@router.put("/laboratorio/{id}", response_model=LaboratorioOut)
def actualizar_laboratorio(id: int, item: LaboratorioCreate, db: Session = Depends(get_db)):
    existente = db.query(Laboratorio).get(id)
    if not existente:
        raise HTTPException(status_code=404, detail="No encontrado.")
    existente.laboratorio = item.laboratorio
    db.commit()
    db.refresh(existente)
    return existente


###########Endopoint Imagenes:
@router.get("/imagenes/", response_model=List[ImagenOut])
def listar_imagenes(db: Session = Depends(get_db)):
    return db.query(Imagen).order_by(Imagen.imagen).all()

@router.post("/imagenes/", response_model=ImagenOut)
def crear_imagen(item: ImagenCreate, db: Session = Depends(get_db)):
    existente = db.query(Imagen).filter(Imagen.imagen == item.imagen).first()
    if existente:
        raise HTTPException(status_code=400, detail="La imagen ya existe.")
    nuevo = Imagen(**item.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.put("/imagenes/{id}", response_model=ImagenOut)
def actualizar_imagen(id: int, item: ImagenCreate, db: Session = Depends(get_db)):
    existente = db.query(Imagen).get(id)
    if not existente:
        raise HTTPException(status_code=404, detail="No encontrado.")
    existente.imagen = item.imagen
    db.commit()
    db.refresh(existente)
    return existente

@router.delete("/imagenes/{id}")
def borrar_imagen(id: int, db: Session = Depends(get_db)):
    item = db.query(Imagen).get(id)
    if not item:
        raise HTTPException(status_code=404, detail="No encontrado.")
    try:
        db.delete(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar la imagen porque está asociada a estudios registrados."
        )
    return {"mensaje": "Imagen eliminada"}


########Endpoint otros estudios:
@router.get("/otros/", response_model=List[OtroEstudio])
def get_otros(db: Session = Depends(get_db)):
    return db.query(OtrosEstudios).all()

@router.post("/otros/", response_model=OtroEstudio)
def crear_otro(item: OtroEstudioCreate, db: Session = Depends(get_db)):
    nuevo = OtrosEstudios(**item.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/otros/{id}/", response_model=OtroEstudio)
def editar_otro(id: int, item: OtroEstudioUpdate, db: Session = Depends(get_db)):
    existente = db.query(OtrosEstudios).filter(OtrosEstudios.id == id).first()
    if not existente:
        raise HTTPException(status_code=404, detail="No encontrado")
    existente.estudio = item.estudio
    db.commit()
    db.refresh(existente)
    return existente

@router.delete("/otros/{id}/")
def borrar_otro(id: int, db: Session = Depends(get_db)):
    item = db.query(OtrosEstudios).get(id)
    if not item:
        raise HTTPException(status_code=404, detail="No encontrado")
    try:
        db.delete(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el estudio porque está asociado a registros de pacientes."
        )
    return {"mensaje": "Estudio eliminado"}

########Endpoint Especialidad:
@router.get("/especialidad/", response_model=List[EspecialidadOut])
def listar_especialidades(db: Session = Depends(get_db)):
    return db.query(Especialidad).order_by(Especialidad.especialidad).all()

@router.post("/especialidad/", response_model=EspecialidadOut)
def crear_especialidad(item: EspecialidadCreate, db: Session = Depends(get_db)):
    existing = db.query(Especialidad).filter(Especialidad.especialidad == item.especialidad).first()
    if existing:
        raise HTTPException(status_code=400, detail="La especialidad ya existe.")
    nuevo = Especialidad(**item.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.delete("/especialidad/{id}")
def borrar_especialidad(id: int, db: Session = Depends(get_db)):
    item = db.query(Especialidad).get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada.")

    # ahora comparamos el campo 'especialidad' de Interconsulta (que es un string con el id)
    existe_inter = db.query(Interconsulta)\
        .filter(Interconsulta.especialidad == str(id))\
        .first()
    if existe_inter:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar la especialidad: existen interconsultas asociadas."
        )

    db.delete(item)
    db.commit()
    return {"mensaje": "Especialidad eliminada correctamente"}

@router.put("/especialidad/{id}", response_model=EspecialidadOut)
def actualizar_especialidad(id: int, item: EspecialidadCreate, db: Session = Depends(get_db)):
    especialidad = db.query(Especialidad).get(id)
    if not especialidad:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    if db.query(Especialidad).filter(Especialidad.especialidad == item.especialidad, Especialidad.id != id).first():
        raise HTTPException(status_code=400, detail="Ya existe otra especialidad con ese nombre.")
    
    especialidad.especialidad = item.especialidad
    db.commit()
    db.refresh(especialidad)
    return especialidad

####### Endpoint Motivo consulta:
@router.get("/motivos_consulta/", response_model=List[MotivoConsultaOut])
def listar_motivos(db: Session = Depends(get_db)):
    print("✅ Entró al endpoint de motivos_consulta")
    return db.query(MotivoConsulta).order_by(MotivoConsulta.motivo_consulta).all()


@router.delete("/motivos_consulta/{id_motivo}")
def borrar_motivo(id_motivo: int, db: Session = Depends(get_db)):
    # Verificar si hay consultas asociadas a este motivo
    existe = db.query(Consulta).filter(Consulta.motivo == id_motivo).first()
    if existe:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el motivo: existen consultas asociadas."
        )
    motivo = db.query(MotivoConsulta).get(id_motivo)
    if not motivo:
        raise HTTPException(status_code=404, detail="Motivo no encontrado.")
    db.delete(motivo)
    db.commit()
    return {"mensaje": "Motivo eliminado"}

@router.post("/motivos_consulta/", response_model=MotivoConsultaOut)
def crear_motivo(motivo: MotivoConsultaCreate, db: Session = Depends(get_db)):
    nuevo_motivo = MotivoConsulta(motivo_consulta=motivo.motivo_consulta)
    db.add(nuevo_motivo)
    db.commit()
    db.refresh(nuevo_motivo)
    return nuevo_motivo

@router.put("/motivos_consulta/{id}")
def editar_motivo(id: int, motivo: MotivoConsultaBase, db: Session = Depends(get_db)):
    db_motivo = db.query(MotivoConsulta).filter(MotivoConsulta.id_motivo == id).first()
    if not db_motivo:
        raise HTTPException(status_code=404, detail="Motivo no encontrado")
    db_motivo.motivo_consulta = motivo.motivo_consulta
    db.commit()
    db.refresh(db_motivo)
    return db_motivo


# ======== Profesionales quirúrgicos y procedimientos (para selects) ========

@router.get("/cirujanos/")
def listar_cirujanos(db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text(
                """
                SELECT id, nombre
                FROM cirujanos
                WHERE activo IS TRUE
                ORDER BY nombre
                """
            )
        ).mappings().all()
        return [
            {"id": r["id"], "nombre": r["nombre"], "id_cirujano": r["id"]}
            for r in rows
        ]
    except Exception as e:
        print("[cirujanos] ERROR SQL:", e)
        return []

@router.post("/cirujanos/", status_code=201)
def crear_cirujano(payload: dict, db: Session = Depends(get_db)):
    """Crear cirujano.
    - Si existe uno inactivo con el mismo nombre, lo reactiva (activo = TRUE) y lo devuelve.
    - Si existe uno activo, devuelve 409.
    - Si no existe, lo inserta y devuelve 201.
    """
    try:
        nombre = (payload.get("nombre") or payload.get("nombre_cirujano") or "").strip()
        if not nombre:
            raise HTTPException(status_code=400, detail="Nombre requerido")

        # Buscar coincidencia por nombre (normalizado, case-insensitive, espacios colapsados)
        nombre_norm = _norm_text(nombre)
        sql_find = text(
            """
            SELECT id, nombre, activo
              FROM cirujanos
             WHERE lower(regexp_replace(nombre, '\\s+', ' ', 'g')) = :norm
             LIMIT 1
            """
        )
        row = db.execute(sql_find, {"norm": nombre_norm}).mappings().first()

        if row:
            if row["activo"] is True:
                # Ya existe activo → conflicto
                raise HTTPException(status_code=409, detail="El cirujano ya existe")
            # Existe pero inactivo → reactivar
            sql_reactivate = text(
                """
                UPDATE cirujanos
                   SET activo = TRUE
                 WHERE id = :cid
             RETURNING id, nombre
                """
            )
            r2 = db.execute(sql_reactivate, {"cid": row["id"]}).mappings().first()
            db.commit()
            return {"id": r2["id"], "nombre": r2["nombre"]}

        # No existe → insertar
        sql_insert = text(
            """
            INSERT INTO cirujanos (nombre, activo)
            VALUES (:nombre, TRUE)
        RETURNING id, nombre
            """
        )
        try:
            created = db.execute(sql_insert, {"nombre": nombre}).mappings().first()
            db.commit()
        except IntegrityError as ie:
            db.rollback()
            # En caso de carrera, si otro lo creó mientras tanto
            raise HTTPException(status_code=409, detail="El cirujano ya existe") from ie

        if not created:
            raise HTTPException(status_code=500, detail="No se pudo crear el cirujano")
        return {"id": created["id"], "nombre": created["nombre"]}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("[POST /bases/cirujanos] ERROR SQL:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error interno al crear cirujano")

@router.put("/cirujanos/{cid}")
def actualizar_cirujano(cid: str, payload: dict, db: Session = Depends(get_db)):
    """Actualizar nombre del cirujano por id (case-insensitive).
    - 400 si nombre vacío
    - 404 si no existe el id
    - 409 si ya existe otro activo con el mismo nombre
    """
    try:
        nombre = (payload.get("nombre") or payload.get("nombre_cirujano") or "").strip()
        if not nombre:
            raise HTTPException(status_code=400, detail="Nombre requerido")

        # Verificar que el cirujano exista
        row_current = db.execute(
            text("SELECT id, nombre, activo FROM cirujanos WHERE id = :cid"),
            {"cid": cid},
        ).mappings().first()
        if not row_current:
            raise HTTPException(status_code=404, detail="Cirujano no encontrado")

        # Chequear duplicado por nombre en OTRA fila (case-insensitive, normalizado)
        nombre_norm = _norm_text(nombre)
        row_dup = db.execute(
            text(
                """
                SELECT id, activo
                  FROM cirujanos
                 WHERE lower(regexp_replace(nombre, '\\s+', ' ', 'g')) = :norm
                   AND id <> :cid
                 LIMIT 1
                """
            ),
            {"norm": nombre_norm, "cid": cid},
        ).mappings().first()
        if row_dup and row_dup["activo"] is True:
            raise HTTPException(status_code=409, detail="El cirujano ya existe")

        # Si el duplicado existe pero está inactivo, podemos permitir renombrar
        # (manteniendo la fila inactiva como historial)

        row_upd = db.execute(
            text(
                """
                UPDATE cirujanos
                   SET nombre = :nombre
                 WHERE id = :cid
             RETURNING id, nombre
                """
            ),
            {"nombre": nombre, "cid": cid},
        ).mappings().first()
        db.commit()
        if not row_upd:
            raise HTTPException(status_code=404, detail="Cirujano no encontrado")
        return {"id": row_upd["id"], "nombre": row_upd["nombre"]}

    except HTTPException:
        raise
    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(status_code=409, detail="El cirujano ya existe") from ie
    except Exception as e:
        db.rollback()
        print("[PUT /bases/cirujanos/{cid}] ERROR SQL:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error interno al actualizar cirujano")

@router.delete("/cirujanos/{cid}")
def borrar_cirujano(cid: str, db: Session = Depends(get_db)):
    """Borrado lógico del cirujano: activo = FALSE.
    Evita violaciones de FK si el cirujano está referenciado en partes/protocolos.
    """
    try:
        res = db.execute(
            text(
                """
                UPDATE cirujanos
                    SET activo = FALSE
                    WHERE id = :cid
                RETURNING id
                """
            ),
            {"cid": cid},
        ).mappings().first()
        db.commit()
        if not res:
            raise HTTPException(status_code=404, detail="Cirujano no encontrado")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("[DELETE /bases/cirujanos/{cid}] ERROR SQL:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error interno al eliminar cirujano")

@router.get("/anestesiologos/")
def listar_anestesiologos(db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text(
                """
                SELECT id, nombre
                FROM anestesiologos
                WHERE activo IS TRUE
                ORDER BY nombre
                """
            )
        ).mappings().all()
        return [
            {"id": r["id"], "nombre": r["nombre"], "id_anestesiologo": r["id"]}
            for r in rows
        ]
    except Exception as e:
        print("[anestesiologos] ERROR SQL:", e)
        return []



# --- Anestesiologos endpoints ---
@router.post("/anestesiologos/", status_code=201)
def crear_anestesiologo(payload: dict, db: Session = Depends(get_db)):
    nombre = (payload.get("nombre") or payload.get("nombre_anestesiologo") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    # existe? (case-insensitive, normalizado)
    nombre_norm = _norm_text(nombre)
    row = db.execute(text("""
        SELECT id, activo
          FROM anestesiologos
         WHERE lower(regexp_replace(nombre, '\\s+', ' ', 'g')) = :norm
         LIMIT 1
    """), {"norm": nombre_norm}).mappings().first()

    if row and row["activo"] is True:
        raise HTTPException(status_code=409, detail="El anestesiólogo ya existe")
    if row and row["activo"] is False:
        r2 = db.execute(text("""
            UPDATE anestesiologos
               SET activo = TRUE
             WHERE id = :id
         RETURNING id, nombre
        """), {"id": row["id"]}).mappings().first()
        db.commit()
        return {"id": r2["id"], "nombre": r2["nombre"]}

    try:
        created = db.execute(text("""
            INSERT INTO anestesiologos (nombre, activo)
            VALUES (:n, TRUE)
        RETURNING id, nombre
        """), {"n": nombre}).mappings().first()
        db.commit()
        return {"id": created["id"], "nombre": created["nombre"]}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="El anestesiólogo ya existe")

@router.put("/anestesiologos/{aid}")
def actualizar_anestesiologo(aid: str, payload: dict, db: Session = Depends(get_db)):
    nombre = (payload.get("nombre") or payload.get("nombre_anestesiologo") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    cur = db.execute(text("SELECT id FROM anestesiologos WHERE id = :id"), {"id": aid}).mappings().first()
    if not cur:
        raise HTTPException(status_code=404, detail="Anestesiólogo no encontrado")

    nombre_norm = _norm_text(nombre)
    dup = db.execute(text("""
        SELECT 1
          FROM anestesiologos
         WHERE lower(regexp_replace(nombre, '\\s+', ' ', 'g')) = :norm
           AND id <> :id
           AND activo = TRUE
         LIMIT 1
    """), {"norm": nombre_norm, "id": aid}).mappings().first()
    if dup:
        raise HTTPException(status_code=409, detail="El anestesiólogo ya existe")

    r = db.execute(text("""
        UPDATE anestesiologos
           SET nombre = :n
         WHERE id = :id
     RETURNING id, nombre
    """), {"n": nombre, "id": aid}).mappings().first()
    db.commit()
    return {"id": r["id"], "nombre": r["nombre"]}

@router.delete("/anestesiologos/{aid}")
def borrar_anestesiologo(aid: str, db: Session = Depends(get_db)):
    r = db.execute(text("""
        UPDATE anestesiologos
           SET activo = FALSE
         WHERE id = :id
     RETURNING id
    """), {"id": aid}).mappings().first()
    db.commit()
    if not r:
        raise HTTPException(status_code=404, detail="Anestesiólogo no encontrado")
    return {"ok": True}

@router.get("/instrumentadores/")
def listar_instrumentadores(db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    id_instrumentador AS id,
                    nombre
                FROM instrumentadores
                WHERE activo = TRUE
                ORDER BY nombre
                """
            )
        ).mappings().all()

        return [
            {"id": r["id"], "nombre": r["nombre"], "id_instrumentador": r["id"]}
            for r in rows
        ]
    except Exception as e:
        print("[instrumentadores] ERROR SQL:", e)
        return []



# --- Instrumentadores endpoints ---
@router.post("/instrumentadores/", status_code=201)
def crear_instrumentador(payload: dict, db: Session = Depends(get_db)):
    nombre = (payload.get("nombre") or payload.get("nombre_instrumentador") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    nombre_norm = _norm_text(nombre)
    row = db.execute(text("""
        SELECT id_instrumentador, activo
          FROM instrumentadores
         WHERE lower(regexp_replace(nombre, '\\s+', ' ', 'g')) = :norm
         LIMIT 1
    """), {"norm": nombre_norm}).mappings().first()

    if row and row["activo"] is True:
        raise HTTPException(status_code=409, detail="El instrumentador ya existe")
    if row and row["activo"] is False:
        r2 = db.execute(text("""
            UPDATE instrumentadores
               SET activo = TRUE
             WHERE id_instrumentador = :id
         RETURNING id_instrumentador AS id, nombre
        """), {"id": row["id_instrumentador"]}).mappings().first()
        db.commit()
        return {"id": r2["id"], "nombre": r2["nombre"]}

    try:
        created = db.execute(text("""
            INSERT INTO instrumentadores (nombre, activo)
            VALUES (:n, TRUE)
        RETURNING id_instrumentador AS id, nombre
        """), {"n": nombre}).mappings().first()
        db.commit()
        return {"id": created["id"], "nombre": created["nombre"]}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="El instrumentador ya existe")

@router.put("/instrumentadores/{iid}")
def actualizar_instrumentador(iid: int, payload: dict, db: Session = Depends(get_db)):
    nombre = (payload.get("nombre") or payload.get("nombre_instrumentador") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    cur = db.execute(text("""
        SELECT id_instrumentador
          FROM instrumentadores
         WHERE id_instrumentador = :id
    """), {"id": iid}).mappings().first()
    if not cur:
        raise HTTPException(status_code=404, detail="Instrumentador no encontrado")

    nombre_norm = _norm_text(nombre)
    dup = db.execute(text("""
        SELECT 1
          FROM instrumentadores
         WHERE lower(regexp_replace(nombre, '\\s+', ' ', 'g')) = :norm
           AND id_instrumentador <> :id
           AND activo = TRUE
         LIMIT 1
    """), {"norm": nombre_norm, "id": iid}).mappings().first()
    if dup:
        raise HTTPException(status_code=409, detail="El instrumentador ya existe")

    r = db.execute(text("""
        UPDATE instrumentadores
           SET nombre = :n
         WHERE id_instrumentador = :id
     RETURNING id_instrumentador AS id, nombre
    """), {"n": nombre, "id": iid}).mappings().first()
    db.commit()
    return {"id": r["id"], "nombre": r["nombre"]}

@router.delete("/instrumentadores/{iid}")
def borrar_instrumentador(iid: int, db: Session = Depends(get_db)):
    r = db.execute(text("""
        UPDATE instrumentadores
           SET activo = FALSE
         WHERE id_instrumentador = :id
     RETURNING id_instrumentador
    """), {"id": iid}).mappings().first()
    db.commit()
    if not r:
        raise HTTPException(status_code=404, detail="Instrumentador no encontrado")
    return {"ok": True}



# --- Procedimientos/tecnicas CRUD endpoints (SQL, soft-delete/reactivación) ---

@router.get("/procedimientos/")
def listar_procedimientos(db: Session = Depends(get_db)):
    """
    Lista técnicas activas (tabla: tecnicas) ordenadas por nombre.
    Devuelve [{id, nombre, id_tecnica, nombre_tecnica}]
    """
    try:
        rows = db.execute(
            text("""
                SELECT id_tecnica AS id,
                       nombre_tecnica AS nombre,
                       id_tecnica,
                       nombre_tecnica
                  FROM tecnicas
                 ORDER BY nombre_tecnica
            """)
        ).mappings().all()
        result = [dict(r) for r in rows]
        print(f"[procedimientos][GET] Devolviendo {len(result)} técnicas:", result)
        return result
    except Exception as e:
        print("[procedimientos][GET] ERROR SQL:", e)
        import traceback
        traceback.print_exc()
        return []


@router.get("/tecnicas/", include_in_schema=False)
@router.get("/tecnicas", include_in_schema=False)
def listar_tecnicas_alias(db: Session = Depends(get_db)):
    """Alias de compatibilidad para el frontend que pide /bases/tecnicas/.
    Reutiliza la salida de listar_procedimientos (técnicas activas).
    """
    return listar_procedimientos(db)

@router.post("/procedimientos/", status_code=201)
def crear_procedimiento(payload: dict, db: Session = Depends(get_db)):
    """
    Crea una técnica. Si existe misma (case-insensitive) inactiva → reactiva.
    Si existe activa → 409. Caso contrario inserta.
    Acepta {"nombre": "..."} o {"nombre_tecnica": "..."}.
    """
    nombre = (payload.get("nombre") or payload.get("nombre_tecnica") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    nombre_norm = _norm_text(nombre)

    try:
        dup = db.execute(
            text("""
                SELECT id_tecnica, activo
                  FROM tecnicas
                 WHERE lower(regexp_replace(nombre_tecnica, '\\s+', ' ', 'g')) = :norm
                 LIMIT 1
            """),
            {"norm": nombre_norm}
        ).mappings().first()

        if dup:
            if dup["activo"] is True:
                raise HTTPException(status_code=409, detail="La técnica ya existe")
            # Reactivar si estaba inactivo
            r2 = db.execute(
                text("""
                    UPDATE tecnicas
                       SET activo = TRUE, nombre_tecnica = :n
                     WHERE id_tecnica = :id
                 RETURNING id_tecnica AS id, nombre_tecnica AS nombre
                """),
                {"id": dup["id_tecnica"], "n": nombre}
            ).mappings().first()
            db.commit()
            return r2

        created = db.execute(
            text("""
                INSERT INTO tecnicas (nombre_tecnica, activo)
                VALUES (:n, TRUE)
            RETURNING id_tecnica AS id, nombre_tecnica AS nombre
            """),
            {"n": nombre}
        ).mappings().first()
        db.commit()
        return created
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="La técnica ya existe")
    except Exception as e:
        db.rollback()
        print("[procedimientos][POST] ERROR SQL:", e)
        raise HTTPException(status_code=500, detail="Error interno al crear procedimiento")

@router.put("/procedimientos/{pid}")
def actualizar_procedimiento(pid: int, payload: dict, db: Session = Depends(get_db)):
    """
    Actualiza nombre de técnica por id_tecnica. Valida duplicados case-insensitive.
    """
    nombre = (payload.get("nombre") or payload.get("nombre_tecnica") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    nombre_norm = _norm_text(nombre)

    try:
        cur = db.execute(
            text("SELECT id_tecnica FROM tecnicas WHERE id_tecnica = :id"),
            {"id": pid}
        ).mappings().first()
        if not cur:
            raise HTTPException(status_code=404, detail="Procedimiento no encontrado")

        # Buscar cualquier duplicado (activo o inactivo)
        dup_any = db.execute(
            text(
                """
                SELECT id_tecnica, activo
                  FROM tecnicas
                 WHERE lower(regexp_replace(nombre_tecnica, '\\s+', ' ', 'g')) = :norm
                   AND id_tecnica <> :id
                 LIMIT 1
                """
            ),
            {"norm": nombre_norm, "id": pid}
        ).mappings().first()

        if dup_any:
            if dup_any["activo"] is True:
                # Ya existe activa con ese nombre → conflicto estándar
                raise HTTPException(status_code=409, detail="La técnica ya existe")
            else:
                # Existe una técnica inactiva con ese nombre → política: no permitir renombrar
                # Sugerimos recuperarla creando una nueva (POST reactivará la fila)
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Esa técnica ya existió con ese nombre. Si querés volver a usarla, "
                        "cargala como una nueva técnica desde 'Nuevo'."
                    ),
                )

        r = db.execute(
            text("""
                UPDATE tecnicas
                   SET nombre_tecnica = :n
                 WHERE id_tecnica = :id
             RETURNING id_tecnica AS id, nombre_tecnica AS nombre
            """),
            {"n": nombre, "id": pid}
        ).mappings().first()
        db.commit()
        return r
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="La técnica ya existe")
    except Exception as e:
        db.rollback()
        print("[procedimientos][PUT] ERROR SQL:", e)
        raise HTTPException(status_code=500, detail="Error interno al actualizar procedimiento")


@router.delete("/procedimientos/{pid}")
def borrar_procedimiento(pid: int, db: Session = Depends(get_db)):
    """
    Borrado lógico: activo = FALSE
    """
    try:
        r = db.execute(
            text("""
                UPDATE tecnicas
                   SET activo = FALSE
                 WHERE id_tecnica = :id
             RETURNING id_tecnica
            """),
            {"id": pid}
        ).mappings().first()
        db.commit()
        if not r:
            raise HTTPException(status_code=404, detail="Procedimiento no encontrado")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("[procedimientos][DELETE] ERROR SQL:", e)
        raise HTTPException(status_code=500, detail="Error interno al borrar procedimiento")


# --- Técnicas (wrappers sobre procedimientos, para compatibilidad de rutas del frontend) ---
@router.post("/tecnicas/", status_code=201)
@router.post("/tecnicas", status_code=201)
def crear_tecnica(payload: dict, db: Session = Depends(get_db)):
    # Delegamos en el creador de procedimientos (misma tabla y lógica)
    return crear_procedimiento(payload, db)

@router.put("/tecnicas/{tid}")
def actualizar_tecnica(tid: int, payload: dict, db: Session = Depends(get_db)):
    # Delegamos en el actualizador de procedimientos
    return actualizar_procedimiento(tid, payload, db)

@router.delete("/tecnicas/{tid}")
def borrar_tecnica(tid: int, db: Session = Depends(get_db)):
    # Delegamos en el borrador (lógico) de procedimientos
    return borrar_procedimiento(tid, db)

@router.get("/tipos_anestesia/")
def listar_tipos_anestesia(db: Session = Depends(get_db)):
    rows = db.query(TipoAnestesia).all()
    return normalize_list(rows, lambda r: {
        "id": getattr(r, "id_tipo_anestesia", None),
        "id_tipo_anestesia": getattr(r, "id_tipo_anestesia", None),
        "nombre": getattr(r, "nombre", None),
    })

@router.get("/diagnosticos/")
def listar_diagnosticos(db: Session = Depends(get_db)):
    """
    Lista diagnósticos ACTIVOS ordenados por nombre.
    Devuelve [{id, nombre, id_diagnostico, nombre_diagnostico}]
    """
    rows = db.execute(text(
        """
        SELECT id_diagnostico AS id,
               nombre_diagnostico AS nombre,
               id_diagnostico,
               nombre_diagnostico
          FROM diagnosticos
         WHERE activo = TRUE
         ORDER BY LOWER(nombre_diagnostico)
        """
    )).mappings().all()
    return [dict(r) for r in rows]

@router.get("/diagnosticos/search")
def buscar_diagnosticos(q: str = "", db: Session = Depends(get_db)):
    """Búsqueda rápida por nombre (solo activos)."""
    q = (q or "").strip()
    rows = db.execute(text(
        """
        SELECT id_diagnostico AS id,
               nombre_diagnostico AS nombre,
               id_diagnostico,
               nombre_diagnostico
          FROM diagnosticos
         WHERE activo = TRUE
           AND (:q = '' OR nombre_diagnostico ILIKE '%' || :q || '%')
         ORDER BY LOWER(nombre_diagnostico)
         LIMIT 50
        """
    ), {"q": q}).mappings().all()
    return [dict(r) for r in rows]

@router.post("/diagnosticos/", status_code=201)
def crear_diagnostico(payload: dict, db: Session = Depends(get_db)):
    """
    Crea o re-activa un diagnóstico.
    Acepta: { "nombre": "..." } o { "nombre_diagnostico": "..." }
    - Si existe activo → 409
    - Si existe inactivo → se reactiva
    """
    nombre = (payload.get("nombre") or payload.get("nombre_diagnostico") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    # ¿existe?
    nombre_norm = _norm_text(nombre)
    cur = db.execute(text(
        """
        SELECT id_diagnostico, activo
          FROM diagnosticos
         WHERE lower(regexp_replace(nombre_diagnostico, '\\s+', ' ', 'g')) = :norm
         LIMIT 1
        """
    ), {"norm": nombre_norm}).mappings().first()

    if cur and cur["activo"] is True:
        raise HTTPException(status_code=409, detail="Ya existe un diagnóstico con ese nombre")

    if cur and cur["activo"] is False:
        r = db.execute(text(
            """
            UPDATE diagnosticos
               SET activo = TRUE, updated_at = now()
             WHERE id_diagnostico = :id
         RETURNING id_diagnostico AS id, nombre_diagnostico AS nombre
            """
        ), {"id": cur["id_diagnostico"]}).mappings().first()
        db.commit()
        return r

    r = db.execute(text(
        """
        INSERT INTO diagnosticos (nombre_diagnostico, activo)
        VALUES (:n, TRUE)
     RETURNING id_diagnostico AS id, nombre_diagnostico AS nombre
        """
    ), {"n": nombre}).mappings().first()
    db.commit()
    return r

@router.put("/diagnosticos/{did}")
def actualizar_diagnostico(did: int, payload: dict, db: Session = Depends(get_db)):
    """
    Renombra un diagnóstico activo. Valida unicidad case-insensitive.
    """
    nombre = (payload.get("nombre") or payload.get("nombre_diagnostico") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    nombre_norm = _norm_text(nombre)

    exists = db.execute(text("SELECT 1 FROM diagnosticos WHERE id_diagnostico = :id AND activo = TRUE"), {"id": did}).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Diagnóstico no encontrado")

    dup = db.execute(text(
        """
        SELECT 1
          FROM diagnosticos
         WHERE lower(regexp_replace(nombre_diagnostico, '\\s+', ' ', 'g')) = :norm
           AND id_diagnostico <> :id
           AND activo = TRUE
         LIMIT 1
        """
    ), {"norm": nombre_norm, "id": did}).scalar()
    if dup:
        raise HTTPException(status_code=409, detail="Ya existe otro diagnóstico con ese nombre")

    r = db.execute(text(
        """
        UPDATE diagnosticos
           SET nombre_diagnostico = :n, updated_at = now()
         WHERE id_diagnostico = :id
     RETURNING id_diagnostico AS id, nombre_diagnostico AS nombre
        """
    ), {"n": nombre, "id": did}).mappings().first()
    db.commit()
    return r

@router.delete("/diagnosticos/{did}")
def borrar_diagnostico(did: int, db: Session = Depends(get_db)):
    """Borrado lógico: activo = FALSE."""
    r = db.execute(text(
        """
        UPDATE diagnosticos
           SET activo = FALSE, updated_at = now()
         WHERE id_diagnostico = :id AND activo = TRUE
     RETURNING id_diagnostico
        """
    ), {"id": did}).mappings().first()
    db.commit()
    if not r:
        raise HTTPException(status_code=404, detail="Diagnóstico not found o ya inactivo")
    return {"ok": True}
