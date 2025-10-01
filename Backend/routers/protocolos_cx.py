from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

# Usamos el get_db del módulo database (igual que en otros routers)
from database import get_db
from schemas import ParteUpdate

router = APIRouter(prefix="/partes", tags=["PartesQuirurgicos"])

def _norm_institucion(val):
    """
    Normaliza institución:
    - 1 => HZB (Hospital Zonal Bariloche)
    - 2 => INTECNUS
    Acepta enteros o strings: "HZB", "Hospital Zonal", "Intecnus".
    Devuelve None si no puede inferir.
    """
    if val is None:
        return None
    try:
        n = int(val)
        if n in (1, 2):
            return n
    except Exception:
        pass
    s = str(val).strip().lower()
    if "hzb" in s or "hospital zonal" in s:
        return 1
    if "intecnus" in s:
        return 2
    return None

@router.post("/", status_code=201)
def crear_parte(payload: dict, db: Session = Depends(get_db)):
    """
    Crea un parte quirúrgico vinculado a procedimientos_pacientes (padre).
    - Acepta 2 formatos:
      A) Nuevo: { procedimientos_pacientes: {...}, partes_quirurgicos: {...} }
      B) Anterior: campos en root y/o en "detalle"
    - Reglas:
      * Se crea SIEMPRE el encabezado (procedimientos_pacientes) => id_pp.
      * En partes_quirurgicos:
            - NO se setea id_parte (lo genera Postgres).
            - id_procedimiento_paciente = id_pp.
            - id_procedimiento (técnica) se toma del payload; si no viene, usa id_procedimiento_base.
    """
    # ---------- Forma A (objetos anidados) ----------
    is_A = isinstance(payload, dict) and ("procedimientos_pacientes" in payload or "partes_quirurgicos" in payload)
    if is_A:
        proc_in  = payload.get("procedimientos_pacientes") or {}
        parte_in = payload.get("partes_quirurgicos") or {}

        # Validaciones mínimas
        faltan = [k for k in ("id_paciente", "id_procedimiento_base", "fecha") if k not in proc_in]
        if faltan:
            raise HTTPException(status_code=400, detail=f"Faltan en procedimientos_pacientes: {', '.join(faltan)}")
        if "hora_inicio" not in parte_in or "hora_fin" not in parte_in:
            raise HTTPException(status_code=400, detail="Faltan 'hora_inicio' y/o 'hora_fin' en partes_quirurgicos")

        # Encabezado
        id_paciente   = int(proc_in["id_paciente"])
        id_proc_base  = int(proc_in["id_procedimiento_base"])
        fecha         = str(proc_in["fecha"])
        patologia     = bool(proc_in.get("patologia", False))
        cultivo       = bool(proc_in.get("cultivo", False))
        raw_inst      = proc_in.get("id_institucion", proc_in.get("institucion"))
        id_institucion = _norm_institucion(raw_inst)
        tipo_cirugia  = int(proc_in.get("tipo_cirugia") or 1)

        # Detalle
        hora_inicio_str = str(parte_in.get("hora_inicio")) if parte_in.get("hora_inicio") is not None else None
        hora_fin_str    = str(parte_in.get("hora_fin"))    if parte_in.get("hora_fin")    is not None else None

        id_diag_pre     = parte_in.get("id_diagnostico_pre")
        anexo_diag      = parte_in.get("anexo_diagnostico")
        tecnica_detalle = parte_in.get("tecnica_detalle")
        anexo_proc      = parte_in.get("anexo_procedimiento")

        id_cirujano       = parte_in.get("id_cirujano")
        id_anestesiologo  = parte_in.get("id_anestesiologo")
        id_instrumentador = parte_in.get("id_instrumentador")
        id_tipo_anestesia = parte_in.get("id_tipo_anestesia")
        id_ayudante1      = parte_in.get("id_ayudante1")
        id_ayudante2      = parte_in.get("id_ayudante2")
        id_ayudante3      = parte_in.get("id_ayudante3")
        # Circulante (mismo catálogo que instrumentadores)
        id_circulante    = parte_in.get("id_circulante")

        # Técnica (prioriza la que viene en el parte; si no, la base)
        id_procedimiento = parte_in.get("id_procedimiento")
        if id_procedimiento is None:
            id_procedimiento = id_proc_base
        id_procedimiento = int(id_procedimiento) if id_procedimiento is not None else None

        try:
            # 1) Encabezado
            row_pp = db.execute(
                text("""
                    INSERT INTO procedimientos_pacientes
                        (id_paciente, id_procedimiento_base, fecha, patologia, cultivo, id_institucion, tipo_cirugia)
                    VALUES (:id_paciente, :id_proc_base, :fecha, :patologia, :cultivo, :id_institucion, :tipo_cirugia)
                    RETURNING id_procedimiento_paciente
                """),
                {
                    "id_paciente": id_paciente,
                    "id_proc_base": id_proc_base,
                    "fecha": fecha,
                    "patologia": patologia,
                    "cultivo": cultivo,
                    "id_institucion": id_institucion,
                    "tipo_cirugia": tipo_cirugia,
                },
            ).mappings().first()
            if not row_pp:
                db.rollback()
                raise HTTPException(status_code=500, detail="No se pudo crear procedimientos_pacientes")
            id_pp = row_pp["id_procedimiento_paciente"]

            # 2) Parte (NO id_parte; SÍ FK al padre + técnica)
            row_parte = db.execute(
                text("""
                    INSERT INTO partes_quirurgicos (
                        id_procedimiento_paciente,
                        id_procedimiento,
                        hora_inicio, hora_fin,
                        id_diagnostico_pre, anexo_diagnostico,
                        tecnica_detalle, anexo_procedimiento,
                        id_cirujano, id_anestesiologo, id_instrumentador, id_circulante, id_tipo_anestesia,
                        id_ayudante1, id_ayudante2, id_ayudante3
                    )
                    VALUES (
                        :id_pp,
                        :id_procedimiento,
                        :hora_inicio, :hora_fin,
                        :id_diagnostico_pre, :anexo_diagnostico,
                        :tecnica_detalle, :anexo_procedimiento,
                        CAST(NULLIF(:id_cirujano,'') AS uuid),
                        CAST(NULLIF(:id_anestesiologo,'') AS uuid),
                        :id_instrumentador, :id_circulante, :id_tipo_anestesia,
                        CAST(NULLIF(:id_ayudante1,'') AS uuid),
                        CAST(NULLIF(:id_ayudante2,'') AS uuid),
                        CAST(NULLIF(:id_ayudante3,'') AS uuid)
                    )
                    RETURNING id_parte
                """),
                {
                    "id_pp": id_pp,
                    "id_procedimiento": id_procedimiento,
                    "hora_inicio": hora_inicio_str,
                    "hora_fin": hora_fin_str,
                    "id_diagnostico_pre": id_diag_pre,
                    "anexo_diagnostico": anexo_diag,
                    "tecnica_detalle": tecnica_detalle,
                    "anexo_procedimiento": anexo_proc,
                    "id_cirujano": str(id_cirujano or ""),
                    "id_anestesiologo": str(id_anestesiologo or ""),
                    "id_instrumentador": id_instrumentador,
                    "id_circulante": id_circulante,
                    "id_tipo_anestesia": id_tipo_anestesia,
                    "id_ayudante1": str(id_ayudante1 or ""),
                    "id_ayudante2": str(id_ayudante2 or ""),
                    "id_ayudante3": str(id_ayudante3 or ""),
                },
            ).mappings().first()

            db.commit()

            # Intentar devolver desde la vista; si no, IDs
            try:
                created = db.execute(
                    text("""
                        SELECT *
                        FROM v_partes_quirurgicos_full
                        WHERE id_procedimiento_paciente = :id_pp
                        ORDER BY created_at DESC
                        LIMIT 1
                    """),
                    {"id_pp": id_pp},
                ).mappings().first()
            except Exception:
                created = None
            return created or {"ok": True, "id_procedimiento_paciente": id_pp, "id_parte": row_parte["id_parte"]}

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            print("[POST /partes] ERROR (A):", e)
            raise HTTPException(status_code=500, detail="Error interno al crear el parte")

    # ---------- Forma B (compatibilidad) ----------
    p = payload if isinstance(payload, dict) else {}
    d = p.get("detalle") or {}

    # Encabezado mínimo
    try:
        id_paciente   = int(p["id_paciente"])
        id_proc_base  = int(p["id_procedimiento_base"])
        fecha         = str(p["fecha"])
    except Exception:
        raise HTTPException(status_code=400, detail="Faltan id_paciente, id_procedimiento_base o fecha")

    patologia      = bool(p.get("patologia", d.get("patologia", False)))
    cultivo        = bool(p.get("cultivo", d.get("cultivo", False)))
    raw_inst       = p.get("id_institucion", p.get("institucion", d.get("institucion")))
    id_institucion = _norm_institucion(raw_inst)
    tipo_cirugia   = int(p.get("tipo_cirugia") or d.get("tipo_cirugia") or 1)

    # Detalle
    hora_inicio = d.get("hora_inicio", p.get("hora_inicio"))
    hora_fin    = d.get("hora_fin",    p.get("hora_fin"))
    hora_inicio_str = str(hora_inicio) if hora_inicio is not None else None
    hora_fin_str    = str(hora_fin)    if hora_fin    is not None else None

    id_diag_pre     = d.get("id_diagnostico_pre", p.get("id_diagnostico_pre"))
    anexo_diag      = d.get("anexo_diagnostico",  p.get("anexo_diagnostico", d.get("dx_post")))
    anexo_proc      = d.get("anexo_procedimiento", p.get("anexo_procedimiento", d.get("tecnica_anexo")))
    tecnica_detalle = d.get("tecnica_detalle", p.get("tecnica_detalle"))

    id_cirujano       = d.get("id_cirujano",       p.get("id_cirujano"))
    id_anestesiologo  = d.get("id_anestesiologo",  p.get("id_anestesiologo"))
    id_instrumentador = d.get("id_instrumentador", p.get("id_instrumentador"))
    id_tipo_anestesia = d.get("id_tipo_anestesia", p.get("id_tipo_anestesia"))
    id_ayudante1      = d.get("id_ayudante1",      p.get("id_ayudante1"))
    id_ayudante2      = d.get("id_ayudante2",      p.get("id_ayudante2"))
    id_ayudante3      = d.get("id_ayudante3",      p.get("id_ayudante3"))
    # Circulante
    id_circulante     = d.get("id_circulante",     p.get("id_circulante"))

    # Técnica (prioriza id_procedimiento si viene; si no, base)
    _id_proc = d.get("id_procedimiento") or d.get("id_procedimiento_base") or p.get("id_procedimiento") or id_proc_base
    _id_proc = int(_id_proc) if _id_proc is not None else None

    # Best-effort por nombre
    try:
        if not id_cirujano and d.get("cirujano"):
            row = db.execute(text("SELECT id FROM cirujanos WHERE nombre = :n AND activo = true LIMIT 1"), {"n": d["cirujano"]}).mappings().first()
            if row: id_cirujano = row["id"]
        if not id_anestesiologo and d.get("anestesiologo"):
            row = db.execute(text("SELECT id FROM anestesiologos WHERE nombre = :n AND activo = true LIMIT 1"), {"n": d["anestesiologo"]}).mappings().first()
            if row: id_anestesiologo = row["id"]
        if not id_instrumentador and d.get("instrumentador"):
            row = db.execute(text("SELECT id_instrumentador FROM instrumentadores WHERE nombre = :n AND activo = true LIMIT 1"), {"n": d["instrumentador"]}).mappings().first()
            if row: id_instrumentador = row["id_instrumentador"]
        if not id_ayudante1 and d.get("ayudante1"):
            row = db.execute(text("SELECT id FROM cirujanos WHERE nombre = :n AND activo = true LIMIT 1"), {"n": d["ayudante1"]}).mappings().first()
            if row: id_ayudante1 = row["id"]
        if not id_ayudante2 and d.get("ayudante2"):
            row = db.execute(text("SELECT id FROM cirujanos WHERE nombre = :n AND activo = true LIMIT 1"), {"n": d["ayudante2"]}).mappings().first()
            if row: id_ayudante2 = row["id"]
        if not id_ayudante3 and d.get("ayudante3"):
            row = db.execute(text("SELECT id FROM cirujanos WHERE nombre = :n AND activo = true LIMIT 1"), {"n": d["ayudante3"]}).mappings().first()
            if row: id_ayudante3 = row["id"]
    except Exception:
        pass

    try:
        # 1) Encabezado
        row_pp = db.execute(
            text("""
                INSERT INTO procedimientos_pacientes
                    (id_paciente, id_procedimiento_base, fecha, patologia, cultivo, id_institucion, tipo_cirugia)
                VALUES (:id_paciente, :id_proc_base, :fecha, :patologia, :cultivo, :id_institucion, :tipo_cirugia)
                RETURNING id_procedimiento_paciente
            """),
            {
                "id_paciente": id_paciente,
                "id_proc_base": id_proc_base,
                "fecha": fecha,
                "patologia": patologia,
                "cultivo": cultivo,
                "id_institucion": id_institucion,
                "tipo_cirugia": tipo_cirugia,
            },
        ).mappings().first()
        if not row_pp:
            db.rollback()
            raise HTTPException(status_code=500, detail="No se pudo crear procedimientos_pacientes")
        id_pp = row_pp["id_procedimiento_paciente"]

        # 2) Parte (FK + técnica)
        row_parte = db.execute(
            text("""
                INSERT INTO partes_quirurgicos (
                    id_procedimiento_paciente,
                    id_procedimiento,
                    hora_inicio, hora_fin,
                    id_diagnostico_pre, anexo_diagnostico,
                    tecnica_detalle, anexo_procedimiento,
                    id_cirujano, id_anestesiologo, id_instrumentador, id_circulante, id_tipo_anestesia,
                    id_ayudante1, id_ayudante2, id_ayudante3
                )
                VALUES (
                    :id_pp,
                    :id_procedimiento,
                    :hora_inicio, :hora_fin,
                    :id_diagnostico_pre, :anexo_diagnostico,
                    :tecnica_detalle, :anexo_procedimiento,
                    CAST(NULLIF(:id_cirujano,'') AS uuid),
                    CAST(NULLIF(:id_anestesiologo,'') AS uuid),
                    :id_instrumentador, :id_circulante, :id_tipo_anestesia,
                    CAST(NULLIF(:id_ayudante1,'') AS uuid),
                    CAST(NULLIF(:id_ayudante2,'') AS uuid),
                    CAST(NULLIF(:id_ayudante3,'') AS uuid)
                )
                RETURNING id_parte
            """),
            {
                "id_pp": id_pp,
                "id_procedimiento": _id_proc,
                "hora_inicio": hora_inicio_str,
                "hora_fin": hora_fin_str,
                "id_diagnostico_pre": id_diag_pre,
                "anexo_diagnostico": anexo_diag,
                "tecnica_detalle": tecnica_detalle,
                "anexo_procedimiento": anexo_proc,
                "id_cirujano": str(id_cirujano or ""),
                "id_anestesiologo": str(id_anestesiologo or ""),
                "id_instrumentador": id_instrumentador,
                "id_circulante": id_circulante,
                "id_tipo_anestesia": id_tipo_anestesia,
                "id_ayudante1": str(id_ayudante1 or ""),
                "id_ayudante2": str(id_ayudante2 or ""),
                "id_ayudante3": str(id_ayudante3 or ""),
            },
        ).mappings().first()

        db.commit()

        # Vista si está
        try:
            created = db.execute(
                text("""
                    SELECT *
                    FROM v_partes_quirurgicos_full
                    WHERE id_procedimiento_paciente = :id_pp
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {"id_pp": id_pp},
            ).mappings().first()
        except Exception:
            created = None

        return created or {"ok": True, "id_procedimiento_paciente": id_pp, "id_parte": row_parte["id_parte"]}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("[POST /partes] ERROR (B):", e)
        raise HTTPException(status_code=500, detail="Error interno al crear el parte")

# Alias de compatibilidad para el front que llama a /protocolos_cx/partes
router_cx = APIRouter(prefix="/protocolos_cx", tags=["PartesQuirurgicos"])

@router_cx.post("/partes", status_code=201)
def crear_parte_alias(payload: dict, db: Session = Depends(get_db)):
    # Reutiliza la misma lógica de crear_parte
    return crear_parte(payload, db)

@router.get("/by-id/{id_pp}")
def obtener_parte(id_pp: int, db: Session = Depends(get_db)):
    try:
        row = db.execute(
            text(
                """
                SELECT * FROM v_partes_quirurgicos_full
                WHERE id_procedimiento_paciente = :id_pp
                """
            ),
            {"id_pp": id_pp},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Parte no encontrado")
        return row
    except Exception:
        # Fallback mínimo si la vista no existe
        base = db.execute(
            text("SELECT * FROM procedimientos_pacientes WHERE id_procedimiento_paciente = :id_pp"),
            {"id_pp": id_pp},
        ).mappings().first()
        detalle = db.execute(
            text("SELECT * FROM partes_quirurgicos WHERE id_procedimiento_paciente = :id_pp"),
            {"id_pp": id_pp},
        ).mappings().first()
        if not base and not detalle:
            raise HTTPException(status_code=404, detail="Parte no encontrado")
        out = {}
        if base: out.update(dict(base))
        if detalle: out.update({k: v for k, v in dict(detalle).items() if k not in out})
        return out

# --- NUEVO ENDPOINT: parte completo (cabecera + detalle + fotos) ---
@router.get("/completo/{id_pp}")
def obtener_parte_completo(id_pp: int, db: Session = Depends(get_db)):
    """
    GET /api/partes/completo/{id_pp}
    Devuelve un objeto consolidado con:
    - procedimientos_pacientes (encabezado)
    - paciente (datos básicos)
    - parte_quirurgico (detalle con nombres legibles de catálogos)
    - fotos (tabla real: fotos_partes_cx)
    """
    # 1) Encabezado + paciente + procedimiento base
    q_pp = text(
        """
        SELECT 
            pp.id_procedimiento_paciente,
            pp.id_paciente,
            p.nombre               AS paciente_nombre,
            p.dni                  AS paciente_dni,
            p.fecha_nacimiento     AS paciente_fnac,
            pp.fecha,
            pp.id_institucion,
            pp.tipo_cirugia,
            pp.patologia,
            pp.cultivo,
            pp.id_procedimiento_base,
            pb.procedimiento       AS procedimiento_base
        FROM procedimientos_pacientes pp
        JOIN pacientes p                   ON p.id_paciente = pp.id_paciente
        LEFT JOIN procedimientos_base pb   ON pb.id_procedimiento = pp.id_procedimiento_base
        WHERE pp.id_procedimiento_paciente = :id
        """
    )
    row_pp = db.execute(q_pp, {"id": id_pp}).mappings().first()
    if not row_pp:
        raise HTTPException(status_code=404, detail="procedimiento_paciente no encontrado")

    # 2) Parte quirúrgico (detalle) con nombres legibles
    q_pq = text(
        """
        SELECT 
            pq.id_parte,
            pq.hora_inicio,
            pq.hora_fin,
            pq.id_diagnostico_pre,
            d.nombre_diagnostico           AS diagnostico_pre_nombre,
            pq.anexo_diagnostico,
            pq.id_procedimiento,
            t.nombre_tecnica               AS procedimiento_nombre,
            pq.tecnica_detalle,
            pq.anexo_procedimiento,
            pq.id_cirujano,
            c.nombre                       AS cirujano_nombre,
            pq.id_anestesiologo,
            a.nombre                       AS anestesiologo_nombre,
            pq.id_instrumentador,
            i.nombre                       AS instrumentador_nombre,
            pq.id_circulante,
            ic.nombre                      AS circulante_nombre,
            pq.id_tipo_anestesia,
            ta.nombre                      AS tipo_anestesia_nombre,
            pq.id_ayudante1, c1.nombre     AS ayudante1_nombre,
            pq.id_ayudante2, c2.nombre     AS ayudante2_nombre,
            pq.id_ayudante3, c3.nombre     AS ayudante3_nombre
        FROM partes_quirurgicos pq
        LEFT JOIN diagnosticos d      ON d.id_diagnostico     = pq.id_diagnostico_pre
        LEFT JOIN tecnicas t          ON t.id_tecnica         = pq.id_procedimiento
        LEFT JOIN cirujanos c         ON c.id                 = pq.id_cirujano
        LEFT JOIN anestesiologos a    ON a.id                 = pq.id_anestesiologo
        LEFT JOIN instrumentadores i  ON i.id_instrumentador  = pq.id_instrumentador
        LEFT JOIN instrumentadores ic ON ic.id_instrumentador = pq.id_circulante
        LEFT JOIN tipos_anestesia ta  ON ta.id_tipo_anestesia = pq.id_tipo_anestesia
        LEFT JOIN cirujanos c1        ON c1.id                = pq.id_ayudante1
        LEFT JOIN cirujanos c2        ON c2.id                = pq.id_ayudante2
        LEFT JOIN cirujanos c3        ON c3.id                = pq.id_ayudante3
        WHERE pq.id_procedimiento_paciente = :id
        """
    )
    row_pq = db.execute(q_pq, {"id": id_pp}).mappings().first()

    # 3) Fotos (tabla real: fotos_partes_cx)
    q_fotos = text(
        """
        SELECT
            f.id_foto,
            f.id_procedimiento_paciente,
            f.storage_key,
            f.url,
            f.filename,
            f.content_type,
            f.size_bytes,
            f.created_at
        FROM fotos_partes_cx f
        WHERE f.id_procedimiento_paciente = :id
        ORDER BY f.created_at DESC, f.id_foto DESC
        """
    )
    fotos = [dict(r) for r in db.execute(q_fotos, {"id": id_pp}).mappings().all()]

    # 4) Respuesta consolidada (estructura estable para el front)
    resp = {
        "procedimientos_pacientes": {
            "id_procedimiento_paciente": row_pp["id_procedimiento_paciente"],
            "id_paciente": row_pp["id_paciente"],
            "fecha": row_pp["fecha"],
            "id_institucion": row_pp["id_institucion"],
            "tipo_cirugia": row_pp["tipo_cirugia"],
            "patologia": bool(row_pp["patologia"]),
            "cultivo": bool(row_pp["cultivo"]),
            "id_procedimiento_base": row_pp["id_procedimiento_base"],
            "procedimiento_base": row_pp["procedimiento_base"],
        },
        "paciente": {
            "id_paciente": row_pp["id_paciente"],
            "nombre": row_pp["paciente_nombre"],
            "dni": row_pp["paciente_dni"],
            "fecha_nacimiento": row_pp["paciente_fnac"],
        },
        "partes_quirurgicos": None,
        "fotos": fotos,
    }

    if row_pq:
        resp["partes_quirurgicos"] = {
            "id_parte": row_pq["id_parte"],
            "hora_inicio": row_pq["hora_inicio"],
            "hora_fin": row_pq["hora_fin"],
            "id_diagnostico_pre": row_pq["id_diagnostico_pre"],
            "diagnostico_pre_nombre": row_pq["diagnostico_pre_nombre"],
            "anexo_diagnostico": row_pq["anexo_diagnostico"],
            "id_procedimiento": row_pq["id_procedimiento"],
            "procedimiento_nombre": row_pq["procedimiento_nombre"],
            "tecnica_detalle": row_pq["tecnica_detalle"],
            "anexo_procedimiento": row_pq["anexo_procedimiento"],
            "id_cirujano": row_pq["id_cirujano"],
            "cirujano_nombre": row_pq["cirujano_nombre"],
            "id_anestesiologo": row_pq["id_anestesiologo"],
            "anestesiologo_nombre": row_pq["anestesiologo_nombre"],
            "id_instrumentador": row_pq["id_instrumentador"],
            "instrumentador_nombre": row_pq["instrumentador_nombre"],
            "id_circulante": row_pq["id_circulante"],
            "circulante_nombre": row_pq["circulante_nombre"],
            "id_tipo_anestesia": row_pq["id_tipo_anestesia"],
            "tipo_anestesia_nombre": row_pq["tipo_anestesia_nombre"],
            "id_ayudante1": row_pq["id_ayudante1"],
            "ayudante1_nombre": row_pq["ayudante1_nombre"],
            "id_ayudante2": row_pq["id_ayudante2"],
            "ayudante2_nombre": row_pq["ayudante2_nombre"],
            "id_ayudante3": row_pq["id_ayudante3"],
            "ayudante3_nombre": row_pq["ayudante3_nombre"],
        }

    return resp

# Alias de compatibilidad (mismo handler) bajo /api/protocolos_cx/partes/{id_pp}
router_cx = APIRouter(prefix="/protocolos_cx", tags=["PartesQuirurgicos"])

@router_cx.get("/partes/{id_pp}")
def obtener_parte_completo_alias(id_pp: int, db: Session = Depends(get_db)):
    return obtener_parte_completo(id_pp, db)

# NUEVO: alias PUT/DELETE para que el front use /protocolos_cx/partes/{id_pp}
@router_cx.put("/partes/{id_pp}")
def actualizar_parte_alias(id_pp: int, payload: dict, db: Session = Depends(get_db)):
    return actualizar_parte(id_pp, payload, db)

@router_cx.delete("/partes/{id_pp}")
def borrar_parte_alias(id_pp: int, db: Session = Depends(get_db)):
    return borrar_parte(id_pp, db)

# --- NUEVO ENDPOINT: listar resumen de partes por paciente ---
@router.get("/resumen")
def listar_resumen(
    id_paciente: int = Query(..., description="ID del paciente"),
    db: Session = Depends(get_db),
):
    """
    GET /api/partes/resumen?id_paciente=8
    Devuelve una lista compacta de procedimientos del paciente con:
    - id_procedimiento_paciente (padre)
    - fecha
    - procedimiento_base (nombre)
    - id_procedimiento (técnica seleccionada) y nombre_tecnica
    - tipo_cirugia (1 programado, 2 urgencia) y su etiqueta
    - institucion_nombre (HZB / INTECNUS si corresponde)
    - hora_inicio / hora_fin
    - id_parte (detalle)
    """
    try:
        rows = db.execute(text(
            """
            SELECT
                pp.id_procedimiento_paciente,
                pp.fecha,
                pb.procedimiento      AS procedimiento_base,
                pq.id_parte,
                pq.hora_inicio,
                pq.hora_fin,
                pq.id_procedimiento,
                t.nombre_tecnica      AS nombre_tecnica,
                pp.tipo_cirugia,
                pp.patologia          AS patologia,
                pp.cultivo            AS cultivo,
                pp.id_institucion     AS institucion_id,
                CAST(NULL AS BOOLEAN) AS enviar_muestra_ap,
                CAST(NULL AS BOOLEAN) AS enviar_muestra_cultivo,
                CASE
                    WHEN pp.tipo_cirugia = 2 THEN 'Urgencia'
                    WHEN pp.tipo_cirugia = 1 THEN 'Programado'
                    ELSE ''
                END                    AS tipo_label,
                CASE
                    WHEN pp.id_institucion = 1 THEN 'HZB'
                    WHEN pp.id_institucion = 2 THEN 'INTECNUS'
                    ELSE NULL
                END                    AS institucion_nombre
            FROM procedimientos_pacientes pp
            LEFT JOIN partes_quirurgicos pq
                ON pq.id_procedimiento_paciente = pp.id_procedimiento_paciente
            LEFT JOIN tecnicas t
                ON t.id_tecnica = pq.id_procedimiento
            LEFT JOIN procedimientos_base pb
                ON pb.id_procedimiento = pp.id_procedimiento_base
            WHERE pp.id_paciente = :id_paciente
            ORDER BY pp.fecha DESC, pp.id_procedimiento_paciente DESC
            """
        ), {"id_paciente": id_paciente}).mappings().all()

        # Normalización mínima hacia lo que espera el front
        out = []
        for r in rows:
            d = dict(r)
            # Aliases usados por el front actual
            d["procedimiento_base_nombre"] = d.get("procedimiento_base")
            d["tecnica"] = d.get("nombre_tecnica")
            out.append(d)
        return out
    except Exception as e:
        print("[/partes/resumen] ERROR:", e)
        raise HTTPException(status_code=500, detail="Error al listar resumen")

@router.put("/{id_pp}")
def actualizar_parte(id_pp: int, payload: dict, db: Session = Depends(get_db)):
    """
    Actualiza parcialmente un parte quirúrgico y/o su encabezado.
    - Encabezado (procedimientos_pacientes): id_paciente, id_procedimiento_base, fecha, patologia, id_institucion, cultivo, tipo_cirugia
    - Detalle (partes_quirurgicos): fecha, hora_inicio, hora_fin, id_diagnostico_pre, anexo_diagnostico,
      anexo_procedimiento, tecnica_detalle, id_cirujano, id_anestesiologo, id_instrumentador, id_circulante, id_tipo_anestesia,
      id_ayudante1, id_ayudante2, id_ayudante3, enviar_muestra_ap, enviar_muestra_cultivo
    """
    # payload ya es dict; clonamos para no mutar referencia
    data = dict(payload or {})

    # Si viene en formato anidado (como el POST), aplanamos
    if isinstance(data, dict) and ("procedimientos_pacientes" in data or "partes_quirurgicos" in data):
        pp = data.pop("procedimientos_pacientes", {}) or {}
        pq = data.pop("partes_quirurgicos", {}) or {}
        flat = {}
        flat.update(pp)
        flat.update(pq)
        # lo que quede en el root (excepto las claves ya usadas)
        for k, v in list(data.items()):
            if k not in ("procedimientos_pacientes", "partes_quirurgicos"):
                flat[k] = v
        # Mantener valores None para campos UUID que pueden ser NULL
        data = {}
        for k, v in flat.items():
            if v is not None:
                data[k] = v
            elif k in ("id_cirujano", "id_anestesiologo", "id_instrumentador", "id_circulante", 
                      "id_ayudante1", "id_ayudante2", "id_ayudante3", "id_diagnostico_pre", "id_procedimiento"):
                data[k] = None  # Permitir NULL para campos UUID

    if not data:
        raise HTTPException(status_code=400, detail="Payload vacío o inválido")

    # Normalizar institucion si viene como string o alias
    if "institucion" in data and "id_institucion" not in data:
        data["id_institucion"] = _norm_institucion(data.pop("institucion"))
    elif "id_institucion" in data:
        data["id_institucion"] = _norm_institucion(data["id_institucion"])  # puede venir "HZB"/"Intecnus" o 1/2

    # Vaciar strings vacíos en campos de texto/horarios
    for _k in ("hora_inicio", "hora_fin", "anexo_diagnostico", "anexo_procedimiento", "tecnica_detalle"):
        if isinstance(data.get(_k), str) and data[_k].strip() == "":
            data[_k] = None

    # Normalizar booleanos si llegan como strings
    for _b in ("patologia", "cultivo"):
        if _b in data:
            if isinstance(data[_b], str):
                data[_b] = data[_b].strip().lower() in ("1", "true", "t", "s", "si", "sí", "yes")
            else:
                data[_b] = bool(data[_b])

    # Verificar existencia de encabezado
    exists = db.execute(
        text("SELECT 1 FROM procedimientos_pacientes WHERE id_procedimiento_paciente = :id_pp"),
        {"id_pp": id_pp},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="procedimiento_paciente no encontrado")

    campos_pp = {
        "id_procedimiento_base", "fecha", "patologia", "cultivo", "tipo_cirugia"
    }
    campos_pq = {
        "hora_inicio", "hora_fin",
        "id_cirujano", "id_anestesiologo", "id_instrumentador", "id_tipo_anestesia",
        "id_diagnostico_pre", "anexo_diagnostico", "anexo_procedimiento",
        "id_procedimiento",
        "id_ayudante1", "id_ayudante2", "id_ayudante3",
        "tecnica_detalle", "id_circulante"
    }

    set_pp = []
    vals_pp = {"id_pp": id_pp}
    for k in campos_pp:
        if k in data:
            set_pp.append(f"{k} = :{k}")
            vals_pp[k] = data[k]

    set_pq = []
    vals_pq = {"id_pp": id_pp}
    for k in campos_pq:
        if k in data:
            set_pq.append(f"{k} = :{k}")
            # Convertir cadenas vacías a NULL para campos UUID
            if k in ("id_cirujano", "id_anestesiologo", "id_instrumentador", "id_circulante", 
                     "id_ayudante1", "id_ayudante2", "id_ayudante3", "id_diagnostico_pre", "id_procedimiento"):
                vals_pq[k] = None if (data[k] == "" or data[k] is None) else data[k]
            else:
                vals_pq[k] = data[k]

    if not set_pp and not set_pq:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    # Normalizar tipos fecha/hora para el driver
    if "fecha" in vals_pp and vals_pp["fecha"] is not None:
        vals_pp["fecha"] = str(vals_pp["fecha"])
    if "hora_inicio" in vals_pq and vals_pq["hora_inicio"] is not None:
        vals_pq["hora_inicio"] = str(vals_pq["hora_inicio"])
    if "hora_fin" in vals_pq and vals_pq["hora_fin"] is not None:
        vals_pq["hora_fin"] = str(vals_pq["hora_fin"])

    try:
        # Transacción
        if set_pp:
            db.execute(
                text(f"""
                    UPDATE procedimientos_pacientes
                    SET {', '.join(set_pp)}
                    WHERE id_procedimiento_paciente = :id_pp
                """),
                vals_pp,
            )

        if set_pq:
            # Asegurar existencia de fila en partes_quirurgicos
            has_pq = db.execute(
                text("SELECT 1 FROM partes_quirurgicos WHERE id_procedimiento_paciente = :id_pp"),
                {"id_pp": id_pp},
            ).first()
            if not has_pq:
                db.execute(
                    text("""
                        INSERT INTO partes_quirurgicos (id_procedimiento_paciente)
                        VALUES (:id_pp)
                    """),
                    {"id_pp": id_pp},
                )

            db.execute(
                text(f"""
                    UPDATE partes_quirurgicos
                    SET {', '.join(set_pq)}
                    WHERE id_procedimiento_paciente = :id_pp
                """),
                vals_pq,
            )

        db.commit()
        # Devolver vista actualizada
        data = db.execute(
            text("""
                SELECT * FROM v_partes_quirurgicos_full
                WHERE id_procedimiento_paciente = :id_pp
            """),
            {"id_pp": id_pp},
        ).mappings().first()
        return data or {"ok": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar parte: {e}")

@router.delete("/{id_pp}")
def borrar_parte(id_pp: int, db: Session = Depends(get_db)):
    """
    Borra el parte (detalle) y su encabezado, en ese orden.
    """
    try:
        # Verificar existencia
        exists = db.execute(
            text("SELECT 1 FROM procedimientos_pacientes WHERE id_procedimiento_paciente = :id_pp"),
            {"id_pp": id_pp},
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="procedimiento_paciente no encontrado")

        # Borrar detalle si existe
        db.execute(
            text("DELETE FROM partes_quirurgicos WHERE id_procedimiento_paciente = :id_pp"),
            {"id_pp": id_pp},
        )
        # Borrar encabezado
        db.execute(
            text("DELETE FROM procedimientos_pacientes WHERE id_procedimiento_paciente = :id_pp"),
            {"id_pp": id_pp},
        )
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al borrar parte: {e}")

# --- NUEVO: router para catálogos ---
router_catalogos = APIRouter(prefix="/catalogos", tags=["catalogos"])

@router_catalogos.get("/plantillas_tecnicas")
def listar_plantillas(db: Session = Depends(get_db)):
    """
    GET /api/catalogos/plantillas_tecnicas
    Devuelve [{id, tecnica, desarrollo}] sólo activos, ordenados por técnica.
    """
    try:
        rows = db.execute(text("""
            SELECT id_plantilla AS id,
                    tecnica,
                    desarrollo
                FROM plantillas_tecnicas_cx
                WHERE activo IS TRUE
                ORDER BY tecnica
        """)).mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        print("[plantillas_tecnicas][GET] ERROR:", e)
        # Para que el front no explote, devolvemos lista vacía si algo sale mal
        return []

@router_catalogos.post("/plantillas_tecnicas")
def crear_plantilla(payload: dict, db: Session = Depends(get_db)):
    """
    POST /api/catalogos/plantillas_tecnicas
    Body: { tecnica: string, desarrollo: string }
    """
    tecnica = (payload.get("tecnica") or payload.get("nombre") or "").strip()
    desarrollo = (payload.get("desarrollo") or "").strip()
    if not tecnica or not desarrollo:
        raise HTTPException(status_code=400, detail="tecnica y desarrollo son obligatorios")
    try:
        row = db.execute(text("""
            INSERT INTO plantillas_tecnicas_cx (tecnica, desarrollo)
            VALUES (:tecnica, :desarrollo)
            RETURNING id_plantilla AS id, tecnica, desarrollo
        """), {"tecnica": tecnica, "desarrollo": desarrollo}).mappings().first()
        db.commit()
        return dict(row)
    except Exception as e:
        db.rollback()
        # Si es violación de unique, devolvemos 409
        msg = str(e)
        print("[plantillas_tecnicas][POST] ERROR:", msg)
        if "unique" in msg.lower() or "duplicate key" in msg.lower():
            raise HTTPException(status_code=409, detail="La técnica ya existe")
        raise HTTPException(status_code=500, detail="Error al crear la plantilla")

@router_catalogos.put("/plantillas_tecnicas/{id_plantilla}")
def actualizar_plantilla(id_plantilla: int, payload: dict, db: Session = Depends(get_db)):
    """
    PUT /api/catalogos/plantillas_tecnicas/{id}
    Body: { tecnica?: string, desarrollo?: string }
    """
    tecnica = (payload.get("tecnica") or payload.get("nombre") or "").strip()
    desarrollo = (payload.get("desarrollo") or "").strip()
    if not tecnica and not desarrollo:
        raise HTTPException(status_code=400, detail="nada para actualizar")
    try:
        db.execute(text("""
            UPDATE plantillas_tecnicas_cx
            SET tecnica     = COALESCE(NULLIF(:tecnica, ''), tecnica),
                desarrollo  = COALESCE(NULLIF(:desarrollo, ''), desarrollo)
            WHERE id_plantilla = :id
        """), {"tecnica": tecnica, "desarrollo": desarrollo, "id": id_plantilla})
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        msg = str(e)
        print("[plantillas_tecnicas][PUT] ERROR:", msg)
        if "unique" in msg.lower() or "duplicate key" in msg.lower():
            raise HTTPException(status_code=409, detail="La técnica ya existe")
        raise HTTPException(status_code=500, detail="Error al actualizar la plantilla")

@router_catalogos.delete("/plantillas_tecnicas/{id_plantilla}")
def borrar_plantilla(id_plantilla: int, db: Session = Depends(get_db)):
    """
    DELETE /api/catalogos/plantillas_tecnicas/{id}
    Borrado lógico (activo = FALSE)
    """
    try:
        db.execute(text("""
            UPDATE plantillas_tecnicas_cx
            SET activo = FALSE
            WHERE id_plantilla = :id
        """), {"id": id_plantilla})
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        print("[plantillas_tecnicas][DELETE] ERROR:", e)
        raise HTTPException(status_code=500, detail="Error al borrar la plantilla")
