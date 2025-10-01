

"""
Helper de almacenamiento de archivos (Supabase + fallback local).

ENV requeridas (para usar Supabase):
    - SUPABASE_URL
    - SUPABASE_KEY
    - SUPABASE_PARTES_BUCKET   (por defecto: "partes")

ENV opcionales para fallback local:
    - UPLOADS_DIR              (por defecto: "uploads")
    - PUBLIC_UPLOADS_BASE      (por defecto: "/static")

Diseño:
- Proveer funciones genéricas para subir/borrar archivos.
- Wrappers por dominio para no romper módulos existentes:
    * upload_procedimiento_file(id_proc_pac, fileobj, filename, content_type)
    * upload_patologia_file(id_patologia, fileobj, filename, content_type)
    * upload_interconsulta_file(id_interconsulta, fileobj, filename, content_type)

Todas retornan:
    {
        "url": str,          # URL pública para mostrar/descargar
        "storage_key": str,  # ruta interna del bucket o del FS local
        "size_bytes": int,   # tamaño del archivo
        "content_type": str  # content-type normalizado
    }

Nota: NO realizamos resize/conversión de imágenes aquí. Si se necesita,
se puede agregar luego sin romper las firmas públicas.
"""

import os
from uuid import uuid4
from typing import Optional

# Intentamos inicializar el cliente de Supabase si hay credenciales
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_PARTES_BUCKET", "partes")

_uploads_dir_default = os.getenv("UPLOADS_DIR", "uploads")
_public_base_default = os.getenv("PUBLIC_UPLOADS_BASE", "/static")

_supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client  # type: ignore
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        # Si falla la importación o inicialización, seguimos con fallback local
        _supabase_client = None


def _normalize_content_type(ct: Optional[str]) -> str:
    return ct if (ct and isinstance(ct, str)) else "application/octet-stream"


def _read_all(fileobj) -> bytes:
    """
    Lee el contenido completo del file-like object SIN asumir que está al inicio.
    """
    try:
        fileobj.seek(0)
    except Exception:
        pass
    data = fileobj.read()
    if isinstance(data, str):
        data = data.encode("utf-8")
    return data


def build_storage_key(base_path: str, filename: str, identifier: Optional[str | int] = None) -> str:
    """
    Construye una key estable y única:
        {base_path}/{identifier?}/{uuid}_{filename}

    Ejemplos:
        build_storage_key("procedimientos", "foto.jpg", 123) ->
            "procedimientos/123/3f7e..._foto.jpg"
        build_storage_key("patologia/45", " informe.pdf") ->
            "patologia/45/3f7e..._informe.pdf"
    """
    # Sanitizamos filename mínimamente (sin espacios extremos)
    clean_name = (filename or "archivo").strip().replace("\\", "/")
    uid = uuid4().hex
    if identifier is not None:
        return f"{base_path}/{identifier}/{uid}_{clean_name}"
    return f"{base_path}/{uid}_{clean_name}"


def upload_file(base_path: str, fileobj, filename: str, content_type: Optional[str] = None) -> dict:
    """
    Sube un archivo a Supabase si está configurado; en caso contrario, guarda localmente.

    Retorna: {url, storage_key, size_bytes, content_type}
    """
    ct = _normalize_content_type(content_type)
    data = _read_all(fileobj)
    size = len(data)

    # Construimos una key de almacenamiento única
    storage_key = build_storage_key(base_path, filename)

    # Camino 1: Supabase
    if _supabase_client:
        try:
            res = _supabase_client.storage.from_(SUPABASE_BUCKET).upload(
                storage_key, data, {"content-type": ct, "upsert": False}
            )
            # Algunas versiones devuelven None o un objeto con .error
            if res is None or getattr(res, "error", None):
                raise RuntimeError("Error subiendo a Supabase")
            # Generar URL firmada (signed URL) para bucket privado
            signed = _supabase_client.storage.from_(SUPABASE_BUCKET).create_signed_url(storage_key, 3600)
            public_url = signed.get("signedURL") or signed.get("signedUrl")
            return {
                "url": public_url,
                "storage_key": storage_key,
                "size_bytes": size,
                "content_type": ct,
            }
        except Exception as e:
            # Si falla, seguimos al fallback local
            # (También podríamos relanzar si preferís fallo duro)
            pass

    # Camino 2: Fallback local
    dest_path = os.path.join(_uploads_dir_default, storage_key)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(data)
    public_url = f"{_public_base_default}/{storage_key}"
    return {
        "url": public_url,
        "storage_key": storage_key,
        "size_bytes": size,
        "content_type": ct,
    }


def delete_file(storage_key: str) -> bool:
    """
    Borra un archivo del bucket si hay Supabase; si no, intenta borrar del FS local.

    Devuelve True si aparenta haberse borrado (o no existir).
    """
    ok = False
    if _supabase_client:
        try:
            # La API de supabase-py para borrar puede variar; la más nueva usa .remove()
            res = _supabase_client.storage.from_(SUPABASE_BUCKET).remove([storage_key])
            # Si no explota, lo consideramos OK
            ok = True
        except Exception:
            ok = False

    # Intentamos también borrar local por si existiera
    try:
        local_path = os.path.join(_uploads_dir_default, storage_key)
        if os.path.exists(local_path):
            os.remove(local_path)
        ok = True or ok
    except Exception:
        pass

    return ok


# -------------------------------
# Wrappers por módulo (compat)
# -------------------------------

def upload_procedimiento_file(id_proc_pac: int, fileobj, filename: str, content_type: Optional[str] = None) -> dict:
    """
    Sube un archivo bajo el prefijo 'procedimientos/{id_proc_pac}/...'
    """
    base = f"procedimientos/{id_proc_pac}"
    return upload_file(base, fileobj, filename, content_type)


def upload_patologia_file(id_patologia: int, fileobj, filename: str, content_type: Optional[str] = None) -> dict:
    """
    Sube un archivo bajo el prefijo 'patologia/{id_patologia}/...'
    """
    base = f"patologia/{id_patologia}"
    return upload_file(base, fileobj, filename, content_type)


def upload_interconsulta_file(id_interconsulta: int, fileobj, filename: str, content_type: Optional[str] = None) -> dict:
    """
    Sube un archivo bajo el prefijo 'interconsultas/{id_interconsulta}/...'
    """
    base = f"interconsultas/{id_interconsulta}"
    return upload_file(base, fileobj, filename, content_type)