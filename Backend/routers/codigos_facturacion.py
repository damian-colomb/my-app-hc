# routers/CodigosFacturacion.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel, field_validator
from database import get_db

# ====== Pydantic ======
ROLES_VALIDOS = {"cirujano", "ayudante1", "ayudante2", "ayudante3"}

class CodigoItem(BaseModel):
    rol: str
    codigo: Optional[str] = None
    porcentaje: Optional[int] = None
    fila: Optional[int] = None  # opcional (1..3). Si no lo mandás, lo asignamos nosotros.

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, v: str):
        v = (v or "").strip().lower()
        if v not in ROLES_VALIDOS:
            raise ValueError("rol inválido")
        return v

    @field_validator("porcentaje")
    @classmethod
    def validar_porcentaje(cls, v):
        if v is None or v == "":
            return None
        if not isinstance(v, int):
            raise ValueError("porcentaje debe ser entero 0..100")
        if v < 0 or v > 100:
            raise ValueError("porcentaje fuera de rango (0..100)")
        return v

    @field_validator("fila")
    @classmethod
    def validar_fila(cls, v):
        if v is None:
            return None
        if v < 1 or v > 3:
            raise ValueError("fila debe ser 1..3")
        return v

# ====== Router ======
router_codfac = APIRouter(prefix="/procedimientos", tags=["codigos_facturacion"])

@router_codfac.get("/{id_procedimiento}/codigos", summary="Listar códigos de facturación de un procedimiento")
def listar_codigos(id_procedimiento: int, db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text("""
                SELECT id_codigo       AS id,
                       id_procedimiento AS id_procedimiento,
                       rol,
                       codigo,
                       porcentaje,
                       fila,
                       creado_en,
                       actualizado_en
                  FROM public.codigos_facturacion
                 WHERE id_procedimiento = :id
                 ORDER BY rol, COALESCE(fila, 999), id_codigo
            """),
            {"id": id_procedimiento}
        ).mappings().all()
        return rows
    except Exception as e:
        print("[codigos_facturacion][GET] ERROR:", e)
        raise HTTPException(status_code=500, detail="Error al listar códigos de facturación")

@router_codfac.put("/{id_procedimiento}/codigos", summary="Reemplazar todos los códigos de un procedimiento")
def reemplazar_codigos(id_procedimiento: int, payload: List[CodigoItem], db: Session = Depends(get_db)):
    # Normalizar: ignorar filas totalmente vacías (sin codigo y sin porcentaje)
    items = []
    # agrupamos por rol para auto-asignar 'fila' si no llegó
    contador_por_rol = {}

    for it in payload or []:
        data = it.model_dump()
        rol = data["rol"]
        codigo = (data.get("codigo") or "").strip()
        porcentaje = data.get("porcentaje", None)
        fila = data.get("fila", None)

        # descartar filas 100% vacías
        if not codigo and porcentaje is None:
            continue

        if fila is None:
            contador_por_rol[rol] = contador_por_rol.get(rol, 0) + 1
            fila = contador_por_rol[rol]
        # clamp fila 1..3 (por si desde front vino algo raro)
        if fila < 1: fila = 1
        if fila > 3: fila = 3

        items.append({
            "rol": rol,
            "codigo": codigo or None,
            "porcentaje": porcentaje,
            "fila": fila
        })

    try:
        # Reemplazo atómico: borro actuales y cargo los nuevos
        with db.begin():
            db.execute(
                text("DELETE FROM public.codigos_facturacion WHERE id_procedimiento = :id"),
                {"id": id_procedimiento}
            )
            if items:
                db.execute(
                    text("""
                        INSERT INTO public.codigos_facturacion
                            (id_procedimiento, rol, codigo, porcentaje, fila, creado_en, actualizado_en)
                        VALUES
                            -- ejecutemany style
                            (:id_procedimiento, :rol, :codigo, :porcentaje, :fila, NOW(), NOW())
                    """),
                    [ { **it, "id_procedimiento": id_procedimiento } for it in items ]
                )

        # devolver estado final
        rows = db.execute(
            text("""
                SELECT id_codigo       AS id,
                       id_procedimiento AS id_procedimiento,
                       rol,
                       codigo,
                       porcentaje,
                       fila,
                       creado_en,
                       actualizado_en
                  FROM public.codigos_facturacion
                 WHERE id_procedimiento = :id
                 ORDER BY rol, COALESCE(fila, 999), id_codigo
            """),
            {"id": id_procedimiento}
        ).mappings().all()
        return rows

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("[codigos_facturacion][PUT] ERROR:", e)
        raise HTTPException(status_code=500, detail="No se pudieron guardar los códigos de facturación")

@router_codfac.post("/{id_procedimiento}/codigos", summary="Crear un código de facturación (una fila)")
def crear_codigo(id_procedimiento: int, item: CodigoItem, db: Session = Depends(get_db)):
    # validar y normalizar
    data = item.model_dump()
    rol = data["rol"]
    codigo = (data.get("codigo") or "").strip() or None
    porcentaje = data.get("porcentaje", None)
    fila = data.get("fila", None)
    if fila is None:
        # calcular siguiente fila para ese rol
        fila_row = db.execute(
            text("""
                SELECT COALESCE(MAX(fila), 0) + 1 AS next
                  FROM public.codigos_facturacion
                 WHERE id_procedimiento = :id AND rol = :rol
            """),
            {"id": id_procedimiento, "rol": rol}
        ).mappings().first()
        fila = max(1, min(3, int(fila_row["next"])) )
    else:
        fila = max(1, min(3, int(fila)))

    try:
        row = db.execute(
            text("""
                INSERT INTO public.codigos_facturacion
                    (id_procedimiento, rol, codigo, porcentaje, fila, creado_en, actualizado_en)
                VALUES (:id, :rol, :codigo, :porcentaje, :fila, NOW(), NOW())
                RETURNING id_codigo       AS id,
                          id_procedimiento AS id_procedimiento,
                          rol, codigo, porcentaje, fila,
                          creado_en, actualizado_en
            """),
            {"id": id_procedimiento, "rol": rol, "codigo": codigo, "porcentaje": porcentaje, "fila": fila}
        ).mappings().first()
        db.commit()
        return row
    except Exception as e:
        db.rollback()
        print("[codigos_facturacion][POST] ERROR:", e)
        raise HTTPException(status_code=400, detail="No se pudo crear el código de facturación")


@router_codfac.patch("/{id_procedimiento}/codigos/{id_codigo}", summary="Actualizar un código de facturación")
def actualizar_codigo(id_procedimiento: int, id_codigo: int, item: CodigoItem, db: Session = Depends(get_db)):
    # Solo actualizamos los campos provistos
    data = item.model_dump()
    sets = []
    params = {"id": id_codigo, "pid": id_procedimiento}

    if data.get("rol"):
        sets.append("rol = :rol")
        params["rol"] = (data["rol"] or "").strip().lower()
    if "codigo" in data:
        sets.append("codigo = :codigo")
        params["codigo"] = (data.get("codigo") or "").strip() or None
    if "porcentaje" in data:
        sets.append("porcentaje = :porcentaje")
        params["porcentaje"] = data.get("porcentaje", None)
    if data.get("fila") is not None:
        sets.append("fila = :fila")
        f = int(data.get("fila", 1))
        params["fila"] = max(1, min(3, f))

    if not sets:
        raise HTTPException(status_code=400, detail="Nada para actualizar")

    try:
        row = db.execute(
            text(f"""
                UPDATE public.codigos_facturacion
                   SET {', '.join(sets)}, actualizado_en = NOW()
                 WHERE id_codigo = :id AND id_procedimiento = :pid
                RETURNING id_codigo       AS id,
                          id_procedimiento AS id_procedimiento,
                          rol, codigo, porcentaje, fila,
                          creado_en, actualizado_en
            """),
            params
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Código no encontrado")
        db.commit()
        return row
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print("[codigos_facturacion][PATCH] ERROR:", e)
        raise HTTPException(status_code=400, detail="No se pudo actualizar el código de facturación")


@router_codfac.delete("/{id_procedimiento}/codigos/{id_codigo}", status_code=204, summary="Eliminar (una fila) de códigos de facturación")
def eliminar_codigo(id_procedimiento: int, id_codigo: int, db: Session = Depends(get_db)):
    try:
        res = db.execute(
            text("""
                DELETE FROM public.codigos_facturacion
                 WHERE id_codigo = :id AND id_procedimiento = :pid
            """),
            {"id": id_codigo, "pid": id_procedimiento}
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Código no encontrado")
        db.commit()
        return
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print("[codigos_facturacion][DELETE one] ERROR:", e)
        raise HTTPException(status_code=500, detail="No se pudo eliminar el código de facturación")


@router_codfac.delete("/{id_procedimiento}/codigos", status_code=204, summary="Eliminar todos los códigos de un procedimiento")
def eliminar_todos_codigos(id_procedimiento: int, db: Session = Depends(get_db)):
    try:
        db.execute(
            text("DELETE FROM public.codigos_facturacion WHERE id_procedimiento = :id"),
            {"id": id_procedimiento}
        )
        db.commit()
        return
    except Exception as e:
        db.rollback()
        print("[codigos_facturacion][DELETE all] ERROR:", e)
        raise HTTPException(status_code=500, detail="No se pudieron eliminar los códigos de facturación")

# Export alias
router = router_codfac