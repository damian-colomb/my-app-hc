from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import List, Dict, Any
import os
import uuid
import logging
from urllib.parse import quote, unquote
from io import BytesIO

try:
    # supabase-py v2
    from supabase import create_client
except Exception as e:  # pragma: no cover
    create_client = None  # type: ignore

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET_PROCEDIMIENTOS", "procedimientos")

_supabase = None
if create_client and SUPABASE_URL and SUPABASE_KEY:
    _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def _public_url(file_key: str) -> str:
    """Obtiene URL pública para un objeto del bucket.
    Intenta usar SDK; si no, construye la URL manualmente.
    """
    if not file_key:
        return ""
    if _supabase is not None:
        try:
            data = _supabase.storage.from_(SUPABASE_BUCKET).get_public_url(file_key)
            if isinstance(data, dict):
                url = data.get("data", {}).get("publicUrl") or data.get("publicUrl")
                if url:
                    return url
        except Exception:
            pass
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{base}/storage/v1/object/public/{SUPABASE_BUCKET}/{quote(file_key)}"


def _safe_name(original: str) -> str:
    # conserva extensión y evita el patrón roto "__" sin nombre
    original = (original or "").strip() or "archivo"
    if "." in original:
        base, ext = original.rsplit(".", 1)
        ext = ext.lower()
    else:
        base, ext = original, "bin"
    return f"{uuid.uuid4().hex}.{ext}"


@router.get("/procedimientos/{id_proc_pac}/fotos")
def listar_fotos_procedimiento(id_proc_pac: int) -> List[Dict[str, Any]]:
    """Lista fotos desde el Storage para el procedimiento dado.
    Si no hay filas en BD, usamos el bucket directamente (fallback robusto).
    """
    if _supabase is None:
        return []
    try:
        folder = str(id_proc_pac)
        resp = _supabase.storage.from_(SUPABASE_BUCKET).list(folder)
        files: List[Dict[str, Any]] = []
        # `resp` puede venir como dict { data: [...] } ó como lista
        if isinstance(resp, dict):
            files = resp.get("data") or []
        elif isinstance(resp, list):
            files = resp  # type: ignore
        items: List[Dict[str, Any]] = []
        for it in files:
            name = it.get("name") if isinstance(it, dict) else str(it)
            # descartar nombres legados rotos (uuid__.ext)
            if name and name.count("_") >= 1 and name.endswith("__."):
                # patrón improbable, evitamos 400
                continue
            key = f"{folder}/{name}"
            url = _public_url(key)
            size_bytes = 0
            if isinstance(it, dict):
                size_bytes = it.get("metadata", {}).get("size", 0) or it.get("size", 0) or 0
            items.append({
                "id_foto": None,
                "url": url,
                "file_url": url,
                "file_key": key,
                "filename": name,
                "content_type": None,
                "size_bytes": size_bytes,
                "created_at": None,
            })
        return items
    except Exception as e:  # pragma: no cover
        # preferimos no romper el listado del parte por fotos
        return []


@router.get("/partes/{id_parte}/fotos")
def listar_fotos_parte(id_parte: int) -> List[Dict[str, Any]]:
    """
    Alias para compatibilidad: algunas vistas llaman con id_parte.
    Reutiliza el mismo listado por carpeta {id} en el Storage.
    """
    return listar_fotos_procedimiento(id_parte)


@router.post("/procedimientos/{id_proc_pac}/fotos", status_code=201)
async def subir_fotos_procedimiento(id_proc_pac: int, files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """Sube una o varias fotos al bucket en la carpeta {id_proc_pac} y devuelve metadatos.
    No toca BD; el front puede listar por storage.
    """
    if _supabase is None:
        raise HTTPException(status_code=500, detail="Supabase no configurado")
    if not files:
        raise HTTPException(status_code=400, detail="Sin archivos")

    errors: List[str] = []

    created: List[Dict[str, Any]] = []
    for f in files:
        try:
            unique_name = _safe_name(f.filename)
            key = f"{id_proc_pac}/{unique_name}"
            content = await f.read()
            options = {
                "contentType": f.content_type or "application/octet-stream",
            }
            try:
                logging.info(f"[procedimientosFotosCx] upload bucket={SUPABASE_BUCKET} key={key} ct={f.content_type} bytes={len(content)}")
            except Exception:
                pass
            try:
                _supabase.storage.from_(SUPABASE_BUCKET).upload(
                    path=key,
                    file=content,
                    file_options=options,
                )
            except Exception as up:
                print(f"[upload_fotos] fallo upload primario '{key}': {up}")
                alt_key = f"{id_proc_pac}/{int(__import__('time').time())}_{unique_name}"
                try:
                    _supabase.storage.from_(SUPABASE_BUCKET).upload(
                        path=alt_key,
                        file=content,
                        file_options=options,
                    )
                    key = alt_key
                except Exception as up2:
                    print(f"[upload_fotos] reintento falló '{alt_key}': {up2}")
                    raise HTTPException(status_code=500, detail=f"Upload falló para '{f.filename}': {up2}")
            url = _public_url(key)
            created.append({
                "id_foto": None,
                "url": url,
                "file_url": url,
                "file_key": key,
                "filename": unique_name,
                "content_type": f.content_type or None,
                "size_bytes": len(content),
                "created_at": None,
            })
        except Exception as e:  # pragma: no cover
            # si es un HTTPException previo, re-lanzarlo para que llegue el detail al cliente
            if isinstance(e, HTTPException):
                raise
            msg = f"[procedimientosFotosCx][upload_fail] key={locals().get('key','?')} err={e}"
            try:
                logging.error(msg)
                print(msg)
            except Exception:
                pass
            errors.append(str(e))
            continue

    if not created:
        detail = "No se pudo subir ninguna foto"
        if errors:
            detail += f": {errors[0]}"
        raise HTTPException(status_code=500, detail=detail)

    return {"uploaded": created}


@router.delete("/procedimientos/{id_proc_pac}/fotos/{file_key:path}")
def borrar_foto_procedimiento_path(id_proc_pac: int, file_key: str):
    """Borra una foto del bucket por clave en el path. Acepta file_key con subcarpetas.
    Ej.: DELETE /procedimientos/49/fotos/49%2Fabcd.jpg
    """
    if _supabase is None:
        raise HTTPException(status_code=500, detail="Supabase no configurado")
    try:
        key = unquote(file_key or "").lstrip("/")
        # Si no viene con prefijo, lo agregamos
        if not key.startswith(f"{id_proc_pac}/"):
            key = f"{id_proc_pac}/" + key
        # Ejecutar borrado
        resp = _supabase.storage.from_(SUPABASE_BUCKET).remove([key])
        # remove retorna {'data': [...], 'error': None} o similar; validamos error si existe
        if isinstance(resp, dict) and resp.get("error"):
            raise Exception(str(resp["error"]))
        return {"deleted": key}
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Delete falló: {e}")


@router.delete("/procedimientos/{id_proc_pac}/fotos")
def borrar_foto_procedimiento_query(id_proc_pac: int, file_key: str = Query(..., description="Clave del archivo a borrar")):
    """Compat: permite borrar pasando `file_key` como query string.
    Ej.: DELETE /procedimientos/49/fotos?file_key=49/abcd.jpg
    """
    return borrar_foto_procedimiento_path(id_proc_pac=id_proc_pac, file_key=file_key)