# routers/patologia.py

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
from dotenv import load_dotenv
import os
from typing import List

from database import get_db
import models, schemas

# ——— Configuración de Supabase (robusta) ———
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY", "")
    or os.getenv("SUPABASE_KEY", "")
    or os.getenv("SUPABASE_ANON_KEY", "")
)
SUPABASE_BUCKET_PATOLOGIA = os.getenv("SUPABASE_BUCKET_PATOLOGIA", "patologias")
SUPABASE_BUCKET_CULTIVOS = os.getenv("SUPABASE_BUCKET_CULTIVOS", "cultivos")

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None
except Exception:
    supabase = None

def _public_url(bucket: str, key: str) -> str:
    if not key:
        return ""
    base = (SUPABASE_URL or "").rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{key}"


def ensure_patologia_columns(db: Session) -> None:
    """Garantiza columnas opcionales agregadas recientemente."""
    try:
        db.execute(text("""
            ALTER TABLE patologias
            ADD COLUMN IF NOT EXISTS id_procedimiento_paciente BIGINT
        """))
        db.execute(text("""
            ALTER TABLE patologias
            ADD COLUMN IF NOT EXISTS fecha_procedimiento DATE
        """))
        db.execute(text("""
            ALTER TABLE patologias
            ADD COLUMN IF NOT EXISTS tipo_registro VARCHAR(32)
        """))
        db.commit()
    except Exception:
        db.rollback()


def _fill_procedimiento_metadata(pat: models.Patologia, db: Session) -> None:
    """Adjunta nombres legibles del procedimiento asociado a la patología."""
    proced_nombre = None
    proced_tecnica = None
    proced_fecha = pat.fecha_procedimiento

    if pat.procedimiento_rel is not None:
        proced_nombre = pat.procedimiento_rel.procedimiento

    pp = None
    if pat.id_procedimiento_paciente:
        pp = db.get(models.ProcedimientoPaciente, pat.id_procedimiento_paciente)
    if pp is None:
        pp = (
            db.query(models.ProcedimientoPaciente)
            .filter(models.ProcedimientoPaciente.id_paciente == pat.id_paciente)
            .filter(models.ProcedimientoPaciente.fecha <= pat.fecha)
            .order_by(models.ProcedimientoPaciente.fecha.desc(), models.ProcedimientoPaciente.id_procedimiento_paciente.desc())
            .first()
        )
    if pp is None:
        pp = (
            db.query(models.ProcedimientoPaciente)
            .filter(models.ProcedimientoPaciente.id_paciente == pat.id_paciente)
            .order_by(models.ProcedimientoPaciente.fecha.asc(), models.ProcedimientoPaciente.id_procedimiento_paciente.asc())
            .first()
        )

    if pp is not None:
        proced_fecha = proced_fecha or pp.fecha
        if hasattr(pp, "procedimiento_rel") and pp.procedimiento_rel is not None:
            proced_tecnica = pp.procedimiento_rel.nombre_tecnica or proced_tecnica
        if not pat.id_procedimiento_paciente:
            pat.id_procedimiento_paciente = pp.id_procedimiento_paciente

    pat.procedimiento_nombre = (proced_nombre or proced_tecnica or "").strip()
    pat.procedimiento_tecnica = (proced_tecnica or "").strip()
    if proced_fecha:
        pat.fecha_procedimiento = proced_fecha
    pat.tipo_registro = (pat.tipo_registro or "patologia").strip().lower()


def _bucket_for_pat(pat: models.Patologia) -> str:
    tipo = (pat.tipo_registro or "patologia").strip().lower()
    return SUPABASE_BUCKET_CULTIVOS if tipo == "cultivo" else SUPABASE_BUCKET_PATOLOGIA

async def upload_to_supabase(
    archivo: UploadFile,
    bucket: str,
    key: str
) -> None:
    """
    Guarda el archivo en Supabase Storage bajo la ruta indicada (bucket/key).
    Lanza HTTPException si falla.
    """
    # Detectar extensión y MIME
    ext = archivo.filename.rsplit(".", 1)[-1].lower()
    mime_map = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
    }
    content_type = archivo.content_type or mime_map.get(ext, "application/octet-stream")

    # Leer contenido del archivo
    data = await archivo.read()
    # Subir usando el cliente oficial de Supabase
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase no configurado")
    try:
        supabase.storage.from_(bucket).upload(
            path=key,
            file=data,
            file_options={"contentType": content_type, "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo en Supabase: {e}")

router = APIRouter(prefix="/patologias", tags=["Patología"])

# ——— CRUD de Patología ———

@router.post("/", response_model=schemas.PatologiaOut)
async def crear_patologia(
    id_paciente: int = Form(...),
    id_procedimiento: int = Form(...),
    fecha: date = Form(...),
    informe_texto: str = Form(""),
    informe_pdf: UploadFile | None = File(None),
    id_procedimiento_paciente: int | None = Form(None),
    tipo_registro: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """
    Crea un registro de patología. Puede incluir texto y/o PDF.
    Si se pasa `id_procedimiento_paciente`, se marca ese procedimiento como no pendiente (`patologia = False`).
    """
    # Validar existencia de paciente y tipo de procedimiento
    if not db.get(models.Paciente, id_paciente):
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if not db.get(models.ProcedimientoBase, id_procedimiento):
        raise HTTPException(status_code=404, detail="Tipo de procedimiento no existe")

    pdf_key = None
    pdf_url = None

    ensure_patologia_columns(db)

    tipo_registro_norm = (tipo_registro or "patologia").strip().lower()
    if tipo_registro_norm not in ("patologia", "cultivo"):
        tipo_registro_norm = "patologia"

    fecha_procedimiento = None
    proc = None
    if id_procedimiento_paciente is not None:
        proc = db.get(models.ProcedimientoPaciente, id_procedimiento_paciente)
        if not proc:
            raise HTTPException(status_code=404, detail="Procedimiento de paciente relacionado no encontrado")
        if proc.id_paciente != id_paciente:
            raise HTTPException(status_code=400, detail="El procedimiento relacionado no pertenece al paciente indicado")
        fecha_procedimiento = proc.fecha

    # Crear la patología primero, sin PDF
    nueva = models.Patologia(
        id_paciente=id_paciente,
        id_procedimiento=id_procedimiento,
        fecha=fecha,
        informe_texto=informe_texto or None,
        informe_pdf_key=None,
        informe_pdf_url=None,
        id_procedimiento_paciente=id_procedimiento_paciente,
        fecha_procedimiento=fecha_procedimiento,
        tipo_registro=tipo_registro_norm,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    if informe_pdf:
        # Usar el ID de la patología para un nombre estable y único
        prefix = "cultivo" if tipo_registro_norm == "cultivo" else "patologia"
        suffix = f"_{id_procedimiento_paciente}" if id_procedimiento_paciente else ""
        filename = f"{prefix}{suffix}_{nueva.id_patologia}.pdf"
        key = f"{id_paciente}/informes/{filename}"
        bucket = SUPABASE_BUCKET_CULTIVOS if tipo_registro_norm == "cultivo" else SUPABASE_BUCKET_PATOLOGIA
        # Subir a Supabase
        await upload_to_supabase(informe_pdf, bucket, key)
        pdf_key = key
        pdf_url = _public_url(bucket, key)
        # Actualizar la instancia con la info del PDF
        nueva.informe_pdf_key = pdf_key
        nueva.informe_pdf_url = pdf_url
        db.commit()
        db.refresh(nueva)
    # Si la patología está relacionada a un procedimiento del paciente, marcarlo como no pendiente
    if proc is not None:
        if proc.patologia is True:
            proc.patologia = False
            db.commit()
            db.refresh(proc)
    return nueva


@router.get("/item/{id_patologia}", response_model=schemas.PatologiaOut)
def obtener_patologia(id_patologia: int, db: Session = Depends(get_db)):
    """
    Devuelve un registro de patología por su ID.
    """
    ensure_patologia_columns(db)
    item = db.get(models.Patologia, id_patologia)
    if not item:
        raise HTTPException(status_code=404, detail="Patología no encontrada")
    return item

@router.put("/{id_patologia}", response_model=schemas.PatologiaOut)
async def actualizar_patologia(
    id_patologia: int,
    fecha: date = Form(...),
    informe_texto: str = Form(""),
    informe_pdf: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """
    Actualiza la patología; si se envía nuevo PDF, reemplaza el anterior.
    """
    ensure_patologia_columns(db)
    pat = db.get(models.Patologia, id_patologia)
    if not pat:
        raise HTTPException(status_code=404, detail="Patología no encontrada")

    if (pat.tipo_registro or "patologia").lower() == "cultivo":
        raise HTTPException(status_code=400, detail="Los cultivos no admiten carga de fotos")

    bucket = _bucket_for_pat(pat)
    if bucket == SUPABASE_BUCKET_CULTIVOS:
        bucket = SUPABASE_BUCKET_PATOLOGIA

    # Actualizar texto y fecha
    pat.fecha = fecha
    pat.informe_texto = informe_texto or None

    # Reemplazar PDF si se envía uno nuevo
    if informe_pdf:
        # Subir/actualizar PDF usando una ruta estable por ID de patología
        prefix = "cultivo" if (pat.tipo_registro or "patologia").lower() == "cultivo" else "patologia"
        suffix = f"_{pat.id_procedimiento_paciente}" if pat.id_procedimiento_paciente else ""
        filename = f"{prefix}{suffix}_{pat.id_patologia}.pdf"
        key = f"{pat.id_paciente}/informes/{filename}"
        bucket = _bucket_for_pat(pat)

        # Si había un PDF con otra key (esquema viejo basado en fecha), lo eliminamos para no dejar huérfanos
        if pat.informe_pdf_key and pat.informe_pdf_key != key:
            if supabase is None:
                raise HTTPException(status_code=500, detail="Supabase no configurado")
            try:
                supabase.storage.from_(bucket).remove([pat.informe_pdf_key])
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al eliminar PDF previo en Supabase: {e}")

        await upload_to_supabase(informe_pdf, bucket, key)
        pat.informe_pdf_key = key
        pat.informe_pdf_url = _public_url(bucket, key)

    db.commit()
    db.refresh(pat)
    return pat

@router.delete("/{id_patologia}", response_model=dict)
def eliminar_patologia(id_patologia: int, db: Session = Depends(get_db)):
    """
    Elimina una patología, su PDF (si existe) y TODAS sus fotos asociadas
    (archivos en Storage + filas en DB).
    """
    ensure_patologia_columns(db)
    pat = db.get(models.Patologia, id_patologia)
    if not pat:
        raise HTTPException(status_code=404, detail="Patología no encontrada")

    # 1) Borrar fotos asociadas (Storage + DB)
    if (pat.tipo_registro or "patologia").lower() == "patologia":
        fotos = (
            db.query(models.FotosPatologia)
            .filter(models.FotosPatologia.id_patologia == id_patologia)
            .all()
        )
        keys = [f.file_key for f in fotos if f.file_key]
        if keys:
            if supabase is None:
                raise HTTPException(status_code=500, detail="Supabase no configurado")
            try:
                supabase.storage.from_(SUPABASE_BUCKET_PATOLOGIA).remove(keys)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al eliminar fotos en Supabase: {e}")
        for f in fotos:
            db.delete(f)

    # 1.b) Borrar detalle VCC asociado (si existe) con SQL crudo para evitar lazy-loads
    try:
        db.execute(text("DELETE FROM patologias_vcc WHERE id_patologia = :id"), {"id": id_patologia})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar detalle VCC: {e}")

    # 2) Borrar PDF si existe
    if pat.informe_pdf_key:
        if supabase is None:
            raise HTTPException(status_code=500, detail="Supabase no configurado")
        try:
            supabase.storage.from_(SUPABASE_BUCKET_PATOLOGIA).remove([pat.informe_pdf_key])
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al eliminar PDF en Supabase: {e}")

    # 3) Borrar la patología
    db.delete(pat)
    db.commit()
    return {"detail": "Patología y archivos asociados eliminados correctamente"}

# ——— Gestión de Fotos de Patología ———

@router.post(
    "/{id_patologia}/fotos",
    response_model=list[schemas.FotosPatologiaOut],
    summary="Subir una o varias fotos de patología"
)
async def subir_fotos_patologia(
    id_patologia: int,
    archivos: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Sube una o varias fotos macroscópicas de la patología.
    """
    pat = db.get(models.Patologia, id_patologia)
    if not pat:
        raise HTTPException(status_code=404, detail="Patología no encontrada")

    fotos_creadas: list[models.FotosPatologia] = []
    from datetime import datetime

    for archivo in archivos:
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        filename = f"{ts}_{archivo.filename}"
        key = f"{pat.id_paciente}/fotos/{filename}"

        await upload_to_supabase(archivo, bucket, key)
        url = _public_url(bucket, key)

        foto = models.FotosPatologia(
            id_patologia=id_patologia,
            file_key=key,
            file_url=url
        )
        db.add(foto)
        fotos_creadas.append(foto)

    db.commit()
    for foto in fotos_creadas:
        db.refresh(foto)

    return fotos_creadas

@router.get("/{id_patologia}/fotos", response_model=list[schemas.FotosPatologiaOut])
def listar_fotos_patologia(id_patologia: int, db: Session = Depends(get_db)):
    """
    Lista las fotos asociadas a una patología.
    """
    return (
        db.query(models.FotosPatologia)
            .filter(models.FotosPatologia.id_patologia == id_patologia)
            .all()
    )

# ——— Marcar procedimiento de paciente como pendiente / no-pendiente (patologia flag) ———
@router.put("/procedimientos/pacientes/{id}", response_model=dict)
@router.put("/procedimientos/{id}", response_model=dict)
def actualizar_flags_procedimiento_paciente(
    id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Actualiza los flags `patologia` y/o `cultivo` del procedimiento de paciente.
    Cualquiera de las dos rutas es aceptada por compatibilidad con versiones anteriores.

    Body esperado (JSON):
        {
            "patologia": true|false,   # opcional
            "cultivo": true|false      # opcional
        }
    Debe incluir al menos una de las claves.
    """
    proc = db.get(models.ProcedimientoPaciente, id)
    if not proc:
        raise HTTPException(status_code=404, detail="Procedimiento de paciente no encontrado")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Body inválido")

    cambios = {}

    if "patologia" in payload:
        valor = payload.get("patologia")
        if not isinstance(valor, bool):
            raise HTTPException(status_code=422, detail="'patologia' debe ser booleano (true/false)")
        proc.patologia = valor
        cambios["patologia"] = proc.patologia

    if "cultivo" in payload:
        valor = payload.get("cultivo")
        if not isinstance(valor, bool):
            raise HTTPException(status_code=422, detail="'cultivo' debe ser booleano (true/false)")
        proc.cultivo = valor
        cambios["cultivo"] = proc.cultivo

    if not cambios:
        raise HTTPException(status_code=422, detail="Incluí 'patologia' y/o 'cultivo' en el body")

    db.commit()
    db.refresh(proc)

    return {
        "detail": "Flags de procedimiento actualizados",
        "id_procedimiento_paciente": id,
        **cambios,
    }

# ——— Tipos de Procedimiento Base (para front) ———
@router.get("/procedimientos-base", summary="Listar tipos de procedimiento base (id y nombre)")
def listar_procedimientos_base(db: Session = Depends(get_db)):
    rows = (
        db.query(models.ProcedimientoBase)
        .order_by(models.ProcedimientoBase.procedimiento.asc())
        .all()
    )
    return [
        {"id_procedimiento": r.id_procedimiento, "procedimiento": r.procedimiento}
        for r in rows
    ]

# Alias para compatibilidad con el front (por si llamó a /bases/procedimiento o /bases/procedimientos)
@router.get("/bases/procedimiento")
@router.get("/bases/procedimientos")
def listar_procedimientos_base_alias(db: Session = Depends(get_db)):
    return listar_procedimientos_base(db)

# ——— Eliminar PDF de una patología sin borrar la patología ———
@router.delete("/pdf/{id_patologia}", response_model=dict)
def eliminar_pdf_patologia(id_patologia: int, db: Session = Depends(get_db)):
    """
    Elimina el PDF de una patología (si existe) y limpia las referencias en la base de datos,
    sin eliminar el registro de patología.
    """
    pat = db.get(models.Patologia, id_patologia)
    if not pat:
        raise HTTPException(status_code=404, detail="Patología no encontrada")

    if not pat.informe_pdf_key:
        # No hay PDF para borrar: devolvemos 200 idempotente con detalle informativo
        return {"detail": "La patología no tiene PDF para eliminar"}

    bucket = _bucket_for_pat(pat)

    # Borrar archivo en Storage
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase no configurado")
    try:
        supabase.storage.from_(bucket).remove([pat.informe_pdf_key])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar PDF en Supabase: {e}")

    # Limpiar campos en DB con UPDATE explícito
    db.query(models.Patologia).filter(models.Patologia.id_patologia == id_patologia).update(
        {"informe_pdf_key": None, "informe_pdf_url": None},
        synchronize_session=False
    )
    db.commit()

    return {"detail": "PDF eliminado correctamente"}


@router.get("/procedimientos-base/{id_paciente}", response_model=List[schemas.ProcedimientoPacienteConBase])
def procedimientos_con_patologia(id_paciente: int, db: Session = Depends(get_db)):
    return (
        db.query(models.ProcedimientoPaciente)
        .join(models.ProcedimientoBase, models.ProcedimientoPaciente.id_procedimiento_base == models.ProcedimientoBase.id_procedimiento)
        .filter(models.ProcedimientoPaciente.id_paciente == id_paciente)
        .filter(models.ProcedimientoPaciente.patologia == True)
        .all()
    )

# ——— Endpoint: Listar todas las patologías de un paciente, incluyendo archivos ———

@router.get("/paciente/{id_paciente}", response_model=List[schemas.PatologiaOutConArchivos])
def listar_patologias_paciente(id_paciente: int, db: Session = Depends(get_db)):
    """
    Devuelve todas las patologías de un paciente, incluyendo archivos PDF y fotos.
    """
    ensure_patologia_columns(db)
    # Traigo todos los registros de patología del paciente ordenados por fecha
    patologias = (
        db.query(models.Patologia)
        .filter(models.Patologia.id_paciente == id_paciente)
        .order_by(models.Patologia.fecha.desc())
        .all()
    )

    for pat in patologias:
        _fill_procedimiento_metadata(pat, db)

        # Cargo las fotos relacionadas
        fotos = (
            db.query(models.FotosPatologia)
            .filter(models.FotosPatologia.id_patologia == pat.id_patologia)
            .all()
        )
        pat.fotos = fotos  # Inyectamos manualmente la relación si no está mapeada

        # --- Nuevo filtrado: dejo solo las fotos que realmente existen en Storage ---
        existing = []
        if (pat.tipo_registro or "patologia").lower() == "patologia" and supabase is not None:
            try:
                sup_res = supabase.storage.from_(SUPABASE_BUCKET_PATOLOGIA).list(f"{id_paciente}/fotos")
                if isinstance(sup_res, dict):
                    data_list = sup_res.get("data") or []
                else:
                    data_list = sup_res or []
                existing = [ (e.get("name") if isinstance(e, dict) else str(e)) for e in data_list ]
            except Exception:
                existing = []
            if existing:
                pat.fotos = [
                    f for f in pat.fotos
                    if f.file_key.split("/")[-1] in existing
                ]
        else:
            pat.fotos = []
        # -------------------------------------------------------------------------

    return patologias


# Alias: endpoint alternativo para listar patologías de un paciente, misma lógica que /paciente/{id_paciente}
@router.get("/patologias/{id_paciente}", response_model=List[schemas.PatologiaOutConArchivos])
def listar_patologias_paciente_alias(id_paciente: int, db: Session = Depends(get_db)):
    """
    Alias de listar patologías: responde en /patologias/patologias/{id_paciente}.
    """
    ensure_patologia_columns(db)
    patologias = (
        db.query(models.Patologia)
        .filter(models.Patologia.id_paciente == id_paciente)
        .order_by(models.Patologia.fecha.desc())
        .all()
    )

    for pat in patologias:
        _fill_procedimiento_metadata(pat, db)

        fotos = (
            db.query(models.FotosPatologia)
            .filter(models.FotosPatologia.id_patologia == pat.id_patologia)
            .all()
        )
        pat.fotos = fotos

    return patologias
