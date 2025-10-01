from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi import HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import LaboratorioPaciente, ImagenPaciente, OtroEstudioPaciente, Laboratorio
# Importar base de datos de "otros estudios"
from models import OtrosEstudios
from schemas import LaboratorioPacienteOut, ImagenPacienteOut, OtroEstudioPacienteOut
from datetime import datetime, date
import tempfile
import requests
from fastapi import HTTPException
from os import getenv
import unicodedata
import re

def normalizar_nombre(nombre: str) -> str:
    nombre = unicodedata.normalize('NFKD', nombre).encode('ASCII', 'ignore').decode('utf-8')
    nombre = nombre.lower()
    nombre = re.sub(r'\s+', '_', nombre)
    nombre = re.sub(r'[^\w\-]', '', nombre)
    return nombre

# REST helper para eliminar archivo si no hay cliente SDK
def _rest_delete_from_storage(bucket: str, key: str) -> None:
    """Fallback REST para borrar un objeto si no hay cliente SDK."""
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{key}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    resp = requests.delete(url, headers=headers)
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=500, detail=f"Error al eliminar en Storage (HTTP {resp.status_code}): {resp.text}")

# Supabase config (robusto)
SUPABASE_URL = getenv("SUPABASE_URL", "")
SUPABASE_KEY = (
    getenv("SUPABASE_SERVICE_KEY", "")
    or getenv("SUPABASE_KEY", "")
    or getenv("SUPABASE_ANON_KEY", "")
)
SUPABASE_BUCKET_LABS = getenv("SUPABASE_BUCKET_LABS", "laboratorios")
SUPABASE_BUCKET_IMAGENES = getenv("SUPABASE_BUCKET_IMAGENES", "imagenes")
SUPABASE_BUCKET_OTROS = getenv("SUPABASE_BUCKET_OTROS", "otros")

try:
    from supabase import create_client
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None
except Exception:
    supabase_client = None

async def upload_to_supabase(file: UploadFile, subfolder: str, custom_filename: str = None) -> str:
    # Leer extensión y MIME
    ext = file.filename.rsplit(".", 1)[-1].lower()
    mime_map = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
    }
    mime = file.content_type or mime_map.get(ext, "application/octet-stream")

    # Guardar temporalmente
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
    try:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp_path = tmp.name
    finally:
        tmp.close()

    # Generar clave
    from datetime import datetime
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    key = custom_filename or (f"{timestamp}_{file.filename}")

    # Subir vía REST
    url = f"{SUPABASE_URL}/storage/v1/object/{subfolder}/{key}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": mime,
        "x-upsert": "true",
    }
    with open(tmp_path, "rb") as f:
        res = requests.post(url, headers=headers, data=f)
    # Limpiar temporal
    import os
    os.remove(tmp_path)

    if res.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {res.text}")
    return key

router = APIRouter(prefix="/examenes", tags=["Exámenes Complementarios"])

@router.post("/laboratorio", response_model=LaboratorioPacienteOut)
async def crear_laboratorio(
    id_paciente: int = Form(...),
    fecha: date = Form(...),
    id_laboratorio: int = Form(...),
    descripcion: str = Form(""),
    archivo: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # 1) Validar la fecha
    if not fecha:
        raise HTTPException(status_code=422, detail="La fecha es obligatoria")

    ruta_archivo   = None
    nombre_archivo = None

    if archivo:
        # 2) Recuperar el nombre para el slug
        lab = db.query(Laboratorio).filter(Laboratorio.id == id_laboratorio).first()
        if not lab:
            raise HTTPException(status_code=404, detail="Laboratorio no encontrado")

        # 3) Normalizarlo y montar el filename
        slug       = normalizar_nombre(lab.laboratorio)
        ext        = archivo.filename.rsplit(".", 1)[-1].lower() or "pdf"
        fecha_str  = fecha.strftime("%Y_%m_%d")
        filename   = f"{slug}_{fecha_str}.{ext}"

        # 4) Subir a Supabase, guardando **exactamente** la key que devuelve
        key = await upload_to_supabase(
            archivo,
            "laboratorios",               # bucket
            f"{id_paciente}/{filename}"   # carpeta dentro del bucket
        )

        # 5) Así aseguramos que nombre_archivo coincida con lo que hay en Storage
        nombre_archivo = filename              # ej: "7/hemograma_2025_07_30.pdf"
        ruta_archivo   = f"{SUPABASE_URL}/storage/v1/object/public/laboratorios/{key}"

        # DEBUG: imprimir a consola si quieres verificar
        print(f"[crear_laboratorio] key={key}, nombre_archivo={nombre_archivo}")
        print ("El filename es:", filename)
    # 6) Persistir en Neon
    nuevo = LaboratorioPaciente(
        id_paciente    = id_paciente,
        fecha          = fecha,
        id_laboratorio = id_laboratorio,
        descripcion    = descripcion,
        nombre_archivo = nombre_archivo,
        ruta_archivo   = ruta_archivo,
    )
    print("NOMBRE_ARCHIVO ANTES DE GUARDAR:", nombre_archivo)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.get("/laboratorio/{id_paciente}", response_model=list[LaboratorioPacienteOut])
def listar_laboratorios(id_paciente: int, db: Session = Depends(get_db)):
    return db.query(LaboratorioPaciente).filter_by(id_paciente=id_paciente).order_by(LaboratorioPaciente.fecha.desc()).all()

# Obtener un estudio de laboratorio individual por ID
@router.get("/laboratorio/item/{id_estudio}", response_model=LaboratorioPacienteOut)
def obtener_laboratorio(id_estudio: int, db: Session = Depends(get_db)):
    estudio = db.query(LaboratorioPaciente).filter(LaboratorioPaciente.id == id_estudio).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio de laboratorio no encontrado")
    # Si existe ruta_archivo, devolver la URL pública completa de Supabase
    if estudio.ruta_archivo and not estudio.ruta_archivo.startswith("http"):
        estudio.ruta_archivo = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET_LABS}/{estudio.ruta_archivo}"
    return estudio

# Actualizar un estudio de laboratorio
@router.put("/laboratorio/{id_estudio}", response_model=LaboratorioPacienteOut)
async def actualizar_laboratorio(
    id_estudio: int,
    fecha: str = Form(...),                  # fecha en formato YYYY-MM-DD vía form-data
    id_laboratorio: int = Form(...),         # id del laboratorio
    descripcion: str = Form(""),             # descripción opcional
    archivo: UploadFile = File(None),        # archivo opcional
    db: Session = Depends(get_db),
):
    # 1. Buscar el estudio existente
    estudio = db.query(LaboratorioPaciente).filter(LaboratorioPaciente.id == id_estudio).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio de laboratorio no encontrado")

    # 2. Actualizar campos básicos
    # Validar y parsear fecha (soporta ISO y dd/MM/YYYY)
    if not fecha:
        raise HTTPException(status_code=422, detail="La fecha es obligatoria")
    try:
        if '-' in fecha:
            fecha_date = datetime.strptime(fecha, "%Y-%m-%d").date()
        elif '/' in fecha:
            fecha_date = datetime.strptime(fecha, "%d/%m/%Y").date()
        else:
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato de fecha inválido, use YYYY-MM-DD o DD/MM/YYYY")
    # Fecha normalizada en objeto date

    estudio.fecha = fecha_date
    estudio.id_laboratorio = id_laboratorio
    estudio.descripcion = descripcion

    # 3. Si se envía un nuevo archivo, sustituir el anterior
    if archivo:
        # Si había un archivo previo, eliminarlo de Supabase
        if estudio.nombre_archivo:
            old_key = f"{estudio.id_paciente}/{estudio.nombre_archivo}"
            try:
                if supabase_client is not None:
                    supabase_client.storage.from_(SUPABASE_BUCKET_LABS).remove([old_key])
                else:
                    _rest_delete_from_storage(SUPABASE_BUCKET_LABS, old_key)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"No se pudo eliminar archivo previo: {e}")

        # Obtener nombre legible del laboratorio
        lab_obj = db.query(Laboratorio).filter(Laboratorio.id == id_laboratorio).first()
        nombre_lab = lab_obj.laboratorio if lab_obj else "laboratorio"
        # Crear nombre de archivo: slug_laboratorio_fecha.ext
        fecha_str = fecha_date.strftime("%Y_%m_%d")
        slug = normalizar_nombre(nombre_lab)
        ext = archivo.filename.rsplit(".", 1)[-1].lower()
        nuevo_nombre = f"{slug}_{fecha_str}.{ext}"

        # Subir al bucket "laboratorios", guardando en carpeta según id del paciente
        key = await upload_to_supabase(
            archivo,
            "laboratorios",
            f"{estudio.id_paciente}/{nuevo_nombre}"
        )

        # Extraer nombre de archivo para BD y asignar URL pública
        estudio.nombre_archivo = key.split("/", 1)[1]
        estudio.ruta_archivo = f"{SUPABASE_URL}/storage/v1/object/public/laboratorios/{key}"

    # 4. Guardar en la base de datos
    db.commit()
    db.refresh(estudio)
    return estudio

@router.delete("/laboratorio/{id_estudio}", response_model=dict)
def eliminar_laboratorio(id_estudio: int, db: Session = Depends(get_db)):
    estudio = (
        db.query(LaboratorioPaciente)
        .filter(LaboratorioPaciente.id == id_estudio)
        .first()
    )

    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio de laboratorio no encontrado")

    # ───────────── BORRAR ARCHIVO EN SUPABASE ─────────────
    if estudio.nombre_archivo:
        key = f"{estudio.id_paciente}/{estudio.nombre_archivo}"
        print(f"[DELETE] Borrando archivo Supabase con key: {key}")
        try:
            if supabase_client is not None:
                res = supabase_client.storage.from_(SUPABASE_BUCKET_LABS).remove([key])
                if isinstance(res, list) and res and isinstance(res[0], dict) and res[0].get("error"):
                    raise HTTPException(status_code=500, detail=f"Error al eliminar archivo en Supabase: {res[0]['error']['message']}")
            else:
                _rest_delete_from_storage(SUPABASE_BUCKET_LABS, key)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar archivo: {e}")

    # ───────────── BORRAR DE NEON ─────────────
    db.delete(estudio)
    db.commit()

    return {"detail": "Estudio de laboratorio eliminado correctamente"}






# IMÁGENES MÉDICAS
@router.post("/imagenes", response_model=ImagenPacienteOut)
async def crear_imagen(
    id_paciente: int = Form(...),
    fecha: str = Form(...),
    id_imagen: int = Form(...),
    descripcion: str = Form(""),
    archivo: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    """
    Crea un nuevo estudio de imagen para un paciente.
    """
    nombre_archivo = None
    ruta_archivo   = None

    if archivo:
        # Normalizar nombre y fecha para filename
        fecha_str = datetime.strptime(fecha, "%Y-%m-%d").strftime("%Y_%m_%d")
        ext       = archivo.filename.rsplit(".", 1)[-1].lower()
        filename  = f"imagen_{id_imagen}_{fecha_str}.{ext}"

        # Subir a Supabase y capturar key ("paciente_id/filename")
        key = await upload_to_supabase(
            archivo,
            "imagenes",
            f"{id_paciente}/{filename}"
        )
        nombre_archivo = key
        ruta_archivo   = f"{SUPABASE_URL}/storage/v1/object/public/imagenes/{key}"

    estudio = ImagenPaciente(
        id_paciente    = id_paciente,
        fecha          = datetime.strptime(fecha, "%Y-%m-%d").date(),
        id_imagen      = id_imagen,
        descripcion    = descripcion,
        nombre_archivo = nombre_archivo,
        ruta_archivo   = ruta_archivo,
    )
    db.add(estudio)
    db.commit()
    db.refresh(estudio)
    return estudio


@router.get("/imagenes/{id_paciente}", response_model=list[ImagenPacienteOut])
def listar_imagenes(id_paciente: int, db: Session = Depends(get_db)):
    return db.query(ImagenPaciente).filter_by(id_paciente=id_paciente).order_by(ImagenPaciente.fecha.desc()).all()


@router.get("/imagenes/item/{id_estudio}", response_model=ImagenPacienteOut)
def obtener_imagen(id_estudio: int, db: Session = Depends(get_db)):
    estudio = db.query(ImagenPaciente).filter(ImagenPaciente.id == id_estudio).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio de imagen no encontrado")
    return estudio


@router.put("/imagenes/{id_estudio}", response_model=ImagenPacienteOut)
async def actualizar_imagen(
    id_estudio: int,
    fecha: str = Form(...),
    id_imagen: int = Form(...),
    descripcion: str = Form(""),
    archivo: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    """
    Actualiza un estudio de imagen existente.
    """
    estudio = db.query(ImagenPaciente).get(id_estudio)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio de imagen no encontrado")

    try:
        estudio.fecha = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato de fecha inválido")

    estudio.id_imagen   = id_imagen
    estudio.descripcion = descripcion

    if archivo:
        # Eliminar el archivo anterior si existía
        if estudio.nombre_archivo:
            try:
                if supabase_client is not None:
                    supabase_client.storage.from_(SUPABASE_BUCKET_IMAGENES).remove([estudio.nombre_archivo])
                else:
                    _rest_delete_from_storage(SUPABASE_BUCKET_IMAGENES, estudio.nombre_archivo)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"No se pudo eliminar imagen previa: {e}")

        # Preparar nuevo filename
        fecha_str = estudio.fecha.strftime("%Y_%m_%d")
        ext       = archivo.filename.rsplit(".", 1)[-1].lower()
        filename  = f"imagen_{id_imagen}_{fecha_str}.{ext}"

        # Subir nuevo archivo usando el id_paciente del estudio
        key = await upload_to_supabase(
            archivo,
            "imagenes",
            f"{estudio.id_paciente}/{filename}"
        )
        estudio.nombre_archivo = key
        estudio.ruta_archivo   = f"{SUPABASE_URL}/storage/v1/object/public/imagenes/{key}"

    db.commit()
    db.refresh(estudio)
    return estudio


@router.delete("/imagenes/{id_estudio}", response_model=dict)
def eliminar_imagen(id_estudio: int, db: Session = Depends(get_db)):
    """
    Elimina un estudio de imagen y su archivo asociado en Supabase Storage.
    """
    estudio = db.query(ImagenPaciente).get(id_estudio)
    if not estudio:
        raise HTTPException(status_code=404, detail="Estudio de imagen no encontrado")

    if estudio.nombre_archivo:
        try:
            if supabase_client is not None:
                res = supabase_client.storage.from_(SUPABASE_BUCKET_IMAGENES).remove([estudio.nombre_archivo])
                if isinstance(res, dict) and res.get("error"):
                    raise HTTPException(status_code=500, detail=f"Error al eliminar imagen en Supabase: {res['error']['message']}")
            else:
                _rest_delete_from_storage(SUPABASE_BUCKET_IMAGENES, estudio.nombre_archivo)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar imagen: {e}")

    db.delete(estudio)
    db.commit()
    return {"detail": "Estudio de imagen eliminado correctamente"}


# OTROS ESTUDIOS
@router.post("/otros", response_model=OtroEstudioPacienteOut)
async def crear_otro(
    id_paciente: int = Form(...),
    fecha: str = Form(...),
    id_otro: int = Form(...),
    descripcion: str = Form(""),
    archivo: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    ruta_archivo = None
    nombre_archivo = None

    if archivo:
        # 1) Obtener y validar el nombre del otro estudio
        estudio_obj = db.query(OtrosEstudios).filter(OtrosEstudios.id == id_otro).first()
        if not estudio_obj:
            raise HTTPException(status_code=404, detail="Otro estudio no encontrado")
        # 2) Normalizar nombre del estudio y fecha para filename
        slug      = normalizar_nombre(estudio_obj.estudio)
        fecha_str = datetime.strptime(fecha, "%Y-%m-%d").strftime("%Y_%m_%d")
        ext       = archivo.filename.rsplit(".", 1)[-1].lower() or "pdf"
        filename  = f"{slug}_{fecha_str}.{ext}"
        # 3) Subir a Supabase y capturar key ("id_paciente/filename")
        key = await upload_to_supabase(
            archivo,
            "otros",
            f"{id_paciente}/{filename}"
        )
        nombre_archivo = filename
        ruta_archivo   = f"{SUPABASE_URL}/storage/v1/object/public/otros/{key}"

    estudio = OtroEstudioPaciente(
        id_paciente    = id_paciente,
        fecha          = datetime.strptime(fecha, "%Y-%m-%d").date(),
        id_otro        = id_otro,
        descripcion    = descripcion,
        nombre_archivo = nombre_archivo,
        ruta_archivo   = ruta_archivo,
    )
    db.add(estudio)
    db.commit()
    db.refresh(estudio)
    return estudio


@router.get("/otros/{id_paciente}", response_model=list[OtroEstudioPacienteOut])
def listar_otros(id_paciente: int, db: Session = Depends(get_db)):
    return db.query(OtroEstudioPaciente).filter_by(id_paciente=id_paciente).order_by(OtroEstudioPaciente.fecha.desc()).all()


@router.get("/otros/item/{id_estudio}", response_model=OtroEstudioPacienteOut)
def obtener_otro(id_estudio: int, db: Session = Depends(get_db)):
    estudio = db.query(OtroEstudioPaciente).filter(OtroEstudioPaciente.id == id_estudio).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Otro estudio no encontrado")
    return estudio


@router.put("/otros/{id_estudio}", response_model=OtroEstudioPacienteOut)
async def actualizar_otro(
    id_estudio: int,
    fecha: str = Form(...),
    id_otro: int = Form(...),
    descripcion: str = Form(""),
    archivo: UploadFile = File(None,
    ),
    db: Session = Depends(get_db)
):
    estudio = db.query(OtroEstudioPaciente).filter(OtroEstudioPaciente.id == id_estudio).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Otro estudio no encontrado")

    try:
        estudio.fecha = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato de fecha inválido")

    estudio.id_otro    = id_otro
    estudio.descripcion = descripcion

    if archivo:
        # 1) Eliminar anterior si existe
        if estudio.nombre_archivo:
            try:
                key_prev = f"{estudio.id_paciente}/{estudio.nombre_archivo}"
                if supabase_client is not None:
                    supabase_client.storage.from_(SUPABASE_BUCKET_OTROS).remove([key_prev])
                else:
                    _rest_delete_from_storage(SUPABASE_BUCKET_OTROS, key_prev)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"No se pudo eliminar archivo previo: {e}")
        # 2) Obtener y validar el nombre del otro estudio
        estudio_obj = db.query(OtrosEstudios).filter(OtrosEstudios.id == id_otro).first()
        if not estudio_obj:
            raise HTTPException(status_code=404, detail="Otro estudio no encontrado")
        # 3) Preparar nuevo filename con slug de estudio y fecha
        slug      = normalizar_nombre(estudio_obj.estudio)
        fecha_str = estudio.fecha.strftime("%Y_%m_%d")
        ext       = archivo.filename.rsplit(".", 1)[-1].lower() or "pdf"
        filename  = f"{slug}_{fecha_str}.{ext}"
        key = await upload_to_supabase(
            archivo,
            "otros",
            f"{estudio.id_paciente}/{filename}"
        )
        estudio.nombre_archivo = filename
        estudio.ruta_archivo   = f"{SUPABASE_URL}/storage/v1/object/public/otros/{key}"

    db.commit()
    db.refresh(estudio)
    return estudio


@router.delete("/otros/{id_estudio}", response_model=dict)
def eliminar_otro(id_estudio: int, db: Session = Depends(get_db)):
    estudio = db.query(OtroEstudioPaciente).filter(OtroEstudioPaciente.id == id_estudio).first()
    if not estudio:
        raise HTTPException(status_code=404, detail="Otro estudio no encontrado")

    # 1) Borrar archivo asociado en Supabase si existe
    if estudio.nombre_archivo:
        key = f"{estudio.id_paciente}/{estudio.nombre_archivo}"
        try:
            if supabase_client is not None:
                resp = supabase_client.storage.from_(SUPABASE_BUCKET_OTROS).remove([key])
                err = None
                if isinstance(resp, list) and resp:
                    err = resp[0].get("error")
                elif isinstance(resp, dict):
                    err = resp.get("error")
                if err:
                    raise HTTPException(status_code=500, detail=f"Error al eliminar otro estudio en Supabase: {err['message']}")
            else:
                _rest_delete_from_storage(SUPABASE_BUCKET_OTROS, key)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar otro estudio: {e}")

    db.delete(estudio)
    db.commit()
    return {"detail": "Otro estudio eliminado correctamente"}