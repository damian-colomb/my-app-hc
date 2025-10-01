from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from datetime import date
from sqlalchemy.orm import Session
from typing import List
import os
from database import get_db
import models
import schemas
import unicodedata
import re
from storage3.exceptions import StorageApiError
from pathlib import Path
from mimetypes import guess_type
import requests

# inicia Supabase storage (robusto y tolerante a claves faltantes)
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# Priorizar SERVICE_KEY; mantener compat con SUPABASE_KEY y ANON_KEY
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY", "")
    or os.getenv("SUPABASE_KEY", "")
    or os.getenv("SUPABASE_ANON_KEY", "")
)
SUPABASE_BUCKET_INTERCONSULTAS = os.getenv("SUPABASE_BUCKET_INTERCONSULTAS", "interconsultas")

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None
except Exception:
    supabase = None


router = APIRouter(
    tags=["interconsultas"],
)

# -------------------------------------------------
# Módulo para manejo de interconsultas:
# Permite listar, crear, obtener URL y eliminar interconsultas
# con soporte para archivos adjuntos almacenados en Supabase Storage.
# -------------------------------------------------

# -------------------------------------------------
# Endpoint para ver interconsulta (GET)
# -------------------------------------------------
@router.get(
    "/{id_paciente}",
    response_model=List[schemas.InterconsultasOut],
    summary="Listar interconsultas de un paciente"
)
def get_interconsultas(
    id_paciente: int,
    db: Session = Depends(get_db)
):
    """
    Listar todas las interconsultas de un paciente ordenadas por fecha descendente.
    """
    return (
        db.query(models.Interconsulta)
            .filter(models.Interconsulta.id_paciente == id_paciente)
            .order_by(models.Interconsulta.fecha.desc())
            .all()
        )

def normalize_tag(text: str) -> str:
    """
    Normaliza nombres de especialidades para usarlos en nombres de archivos.
    1) Elimina acentos y caracteres Unicode especiales.
    2) Convierte a minúsculas y reemplaza caracteres no alfanuméricos por guiones bajos.
    """
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_only = nfkd.encode("ascii", "ignore").decode("ascii")
    tag = re.sub(r"\W+", "_", ascii_only).strip("_").lower()
    return tag

def _detect_mime(filename: str, fallback: str = "application/octet-stream") -> str:
    """
    Determina el tipo MIME a partir de la extensión del archivo.
    Soporta explícitamente PDF, JPG, JPEG y PNG.
    Si no se reconoce, usa mimetypes.guess_type o un valor por defecto.
    """
    ext = Path(filename).suffix.lower()
    map_ext = {
        ".pdf":  "application/pdf",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
    }
    if ext in map_ext:
        return map_ext[ext]
    mime, _ = guess_type(filename)
    return mime or fallback

# -------------------------------------------------
# Endpoint para crear interconsulta (create)
# -------------------------------------------------
@router.post("/", response_model=schemas.InterconsultaOut)
async def create_interconsulta(
    id_paciente:    int             = Form(...),
    fecha:          date            = Form(...),
    especialidad:   int             = Form(...),
    descripcion:    str             = Form(...),
    archivo:        UploadFile | None = File(None),
    db:             Session         = Depends(get_db),
):
    """
    Crea una nueva interconsulta para un paciente.
    
    Pasos:
    1) Valida que la especialidad exista.
    2) Si se adjunta un archivo:
        - Normaliza el nombre del archivo con la especialidad y fecha.
        - Guarda temporalmente el archivo con la extensión correcta.
        - Detecta el tipo MIME correcto.
        - Sube el archivo a Supabase Storage usando requests.post.
    3) Guarda la información de la interconsulta en la base de datos.
    """
    nombre_archivo = None
    ruta_archivo   = None

    if archivo:
        # Extensión original en minúscula, por defecto .pdf si no tiene
        ext = Path(archivo.filename).suffix.lower()
        if not ext:
            ext = ".pdf"

        # Obtener y normalizar el nombre de la especialidad para el archivo
        esp = (
            db.query(models.Especialidad)
            .filter(models.Especialidad.id == especialidad)
            .first()
        )
        if not esp:
            raise HTTPException(status_code=400, detail="Especialidad no encontrada")
        tag = normalize_tag(esp.especialidad)

        # Nombre del archivo local y clave para almacenamiento en Supabase
        nombre_archivo_local = f"ic_{tag}_{fecha.isoformat()}{ext}"
        key = f"{id_paciente}/{nombre_archivo_local}"

        import tempfile

        # Guardar archivo temporalmente con la extensión correcta
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(await archivo.read())
            tmp_path = tmp.name

        # Detectar MIME correcto basándose en la extensión
        mime = _detect_mime(archivo.filename)

        # Subir archivo a Supabase Storage usando requests.post
        try:
            url = f"{SUPABASE_URL}/storage/v1/object/interconsultas/{key}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": mime,
                "x-upsert": "true",
            }
            with open(tmp_path, "rb") as f:
                res = requests.post(url, headers=headers, data=f)
                if res.status_code not in (200, 201):
                    raise HTTPException(status_code=500, detail=f"Error al subir archivo (HTTP {res.status_code}): {res.text}")
        except Exception as e:
            os.remove(tmp_path)
            raise HTTPException(status_code=500, detail=f"Error al subir archivo directo a Supabase: {e}")

        # Guardar el nombre normalizado para la DB
        nombre_archivo = nombre_archivo_local

        os.remove(tmp_path)

        # Si se desea guardar la URL pública, se puede descomentar este bloque:
        # public_url = supabase.storage.from_("interconsultas").get_public_url(key)
        # ruta_archivo = public_url.get("publicUrl") if isinstance(public_url, dict) else None

    # Persistir interconsulta en la base de datos
    db_item = models.Interconsulta(
        id_paciente     = id_paciente,
        fecha           = fecha,
        id_especialidad = especialidad,
        descripcion     = descripcion,
        nombre_archivo  = nombre_archivo,
        ruta_archivo    = ruta_archivo,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# -------------------------------------------------
# Endpoint para ver la url (GET)
# -------------------------------------------------
@router.get("/archivo-url/{id_interconsulta}")
def get_archivo_url(id_interconsulta: int, db: Session = Depends(get_db)):
    """
    Genera un enlace temporal (URL firmada) para acceder al archivo de la interconsulta.
    La URL tiene una duración limitada (300 segundos).
    """
    item = (
        db.query(models.Interconsulta)
        .filter(models.Interconsulta.id_interconsulta == id_interconsulta)
        .first()
    )
    if not item or not item.nombre_archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado para esta interconsulta")

    key = f"{item.id_paciente}/{item.nombre_archivo}"
    try:
        signed = supabase.storage.from_("interconsultas").create_signed_url(key, 300)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo generar URL firmada: {e}")

    # Supabase suele devolver un dict con 'signedURL' (camelCase)
    url = signed.get("signedURL") if isinstance(signed, dict) else (signed if isinstance(signed, str) else None)
    if not url:
        raise HTTPException(status_code=500, detail="Respuesta inesperada al generar URL firmada")

    return {"url": url}
# -------------------------------------------------
# Endpoint para borrar interconsulta (Delete)
# -------------------------------------------------

@router.delete("/{id_interconsulta}")
def delete_interconsulta(id_interconsulta: int, db: Session = Depends(get_db)):
    """
    Elimina una interconsulta y su archivo asociado en Supabase Storage si existe.
    """
    db_item = (
        db.query(models.Interconsulta)
        .filter(models.Interconsulta.id_interconsulta == id_interconsulta)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=404, detail="Interconsulta no encontrada")

    # Borrar archivo asociado si existe
    if db_item.nombre_archivo:
        key = f"{db_item.id_paciente}/{db_item.nombre_archivo}"
        try:
            if supabase is not None:
                supabase.storage.from_(SUPABASE_BUCKET_INTERCONSULTAS).remove([key])
            else:
                # Fallback REST: DELETE /storage/v1/object/{bucket}/{key}
                url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET_INTERCONSULTAS}/{key}"
                headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
                res = requests.delete(url, headers=headers)
                if res.status_code not in (200, 204):
                    raise HTTPException(status_code=500, detail=f"Error al eliminar archivo (HTTP {res.status_code}): {res.text}")
        except StorageApiError as e:
            raise HTTPException(status_code=500, detail=f"Error al eliminar archivo en Supabase Storage: {e}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar archivo: {e}")

    db.delete(db_item)
    db.commit()
    return {"mensaje": "Interconsulta eliminada correctamente"}

# -------------------------------------------------
# Endpoint para actualizar interconsulta (PUT)
# -------------------------------------------------


@router.put("/{id_interconsulta}", response_model=schemas.InterconsultaOut)
async def update_interconsulta(
    id_interconsulta: int,
    fecha: str = Form(...),
    especialidad: str = Form(...),
    descripcion: str = Form(...),
    archivo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """
    Actualiza una interconsulta existente.
    Convierte la fecha y la especialidad desde strings recibidos por FormData.
    Si se adjunta un nuevo archivo, reemplaza el anterior en Supabase.
    """
    from datetime import datetime
    try:
        fecha = datetime.strptime(fecha, "%Y-%m-%d").date()
        especialidad = int(especialidad)
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato inválido en fecha o especialidad")

    db_item = db.query(models.Interconsulta).filter(models.Interconsulta.id_interconsulta == id_interconsulta).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Interconsulta no encontrada")

    db_item.fecha = fecha
    db_item.id_especialidad = especialidad
    db_item.descripcion = descripcion

    if archivo:
        ext = Path(archivo.filename).suffix.lower()
        if not ext:
            ext = ".pdf"

        esp = db.query(models.Especialidad).filter(models.Especialidad.id == especialidad).first()
        if not esp:
            raise HTTPException(status_code=400, detail="Especialidad no encontrada")
        tag = normalize_tag(esp.especialidad)

        nombre_archivo_local = f"ic_{tag}_{fecha.isoformat()}{ext}"
        key = f"{db_item.id_paciente}/{nombre_archivo_local}"

        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(await archivo.read())
            tmp_path = tmp.name

        mime = _detect_mime(archivo.filename)

        try:
            url = f"{SUPABASE_URL}/storage/v1/object/interconsultas/{key}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": mime,
                "x-upsert": "true",
            }
            with open(tmp_path, "rb") as f:
                res = requests.post(url, headers=headers, data=f)
                if res.status_code not in (200, 201):
                    raise HTTPException(status_code=500, detail=f"Error al subir archivo (HTTP {res.status_code}): {res.text}")
        except Exception as e:
            os.remove(tmp_path)
            raise HTTPException(status_code=500, detail=f"Error al subir archivo directo a Supabase: {e}")

        os.remove(tmp_path)

        # Eliminar archivo anterior si cambió el nombre
        if db_item.nombre_archivo and db_item.nombre_archivo != nombre_archivo_local:
            old_key = f"{db_item.id_paciente}/{db_item.nombre_archivo}"
            try:
                supabase.storage.from_("interconsultas").remove([old_key])
            except Exception:
                pass  # No romper si falla la eliminación

        db_item.nombre_archivo = nombre_archivo_local

    db.commit()
    db.refresh(db_item)
    return db_item