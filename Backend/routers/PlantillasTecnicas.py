# routers/PlantillasTecnicas.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router_catalogos = APIRouter(prefix="/plantillas", tags=["plantillas_tecnicas"])

@router_catalogos.get("/test", summary="Test endpoint")
def test_endpoint():
    return {"message": "PlantillasTecnicas router funcionando"}

@router_catalogos.get("/plantillas_tecnicas_cx", summary="Listar plantillas técnicas activas")
def listar_plantillas_tecnicas(db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text("""
                SELECT id_plantilla AS id,
                       tecnica,
                       desarrollo
                  FROM public.plantillas_tecnicas_cx
                 WHERE activo IS TRUE
                 ORDER BY tecnica
            """)
        ).mappings().all()
        return rows
    except Exception as e:
        print("[plantillas_tecnicas_cx][GET] ERROR:", e)
        raise HTTPException(status_code=500, detail="Error al listar plantillas técnicas")

@router_catalogos.post("/plantillas_tecnicas_cx", status_code=201, summary="Crear plantilla técnica")
def crear_plantilla_tecnica(payload: dict, db: Session = Depends(get_db)):
    tecnica = (payload.get("tecnica") or "").strip()
    desarrollo = (payload.get("desarrollo") or "").strip()
    if not tecnica or not desarrollo:
        raise HTTPException(status_code=400, detail="Campos 'tecnica' y 'desarrollo' son obligatorios")

    try:
        row = db.execute(
            text("""
                INSERT INTO public.plantillas_tecnicas_cx (tecnica, desarrollo)
                VALUES (:tecnica, :desarrollo)
                RETURNING id_plantilla AS id, tecnica, desarrollo
            """),
            {"tecnica": tecnica, "desarrollo": desarrollo}
        ).mappings().first()
        db.commit()
        return row
    except Exception as e:
        db.rollback()
        msg = "Ya existe una plantilla técnica con esa técnica" if "unique" in str(e).lower() else "No se pudo crear la plantilla técnica"
        print("[plantillas_tecnicas_cx][POST] ERROR:", e)
        raise HTTPException(status_code=400, detail=msg)

@router_catalogos.put("/plantillas_tecnicas_cx/{id_plantilla}", summary="Actualizar plantilla técnica")
def actualizar_plantilla_tecnica(id_plantilla: int, payload: dict, db: Session = Depends(get_db)):
    tecnica = (payload.get("tecnica") or "").strip()
    desarrollo = (payload.get("desarrollo") or "").strip()
    if not tecnica or not desarrollo:
        raise HTTPException(status_code=400, detail="Campos 'tecnica' y 'desarrollo' son obligatorios")

    try:
        row = db.execute(
            text("""
                UPDATE public.plantillas_tecnicas_cx
                   SET tecnica = :tecnica,
                       desarrollo = :desarrollo,
                       actualizado_en = NOW()
                 WHERE id_plantilla = :id
                RETURNING id_plantilla AS id, tecnica, desarrollo
            """),
            {"id": id_plantilla, "tecnica": tecnica, "desarrollo": desarrollo}
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Plantilla técnica no encontrada")
        db.commit()
        return row
    except Exception as e:
        db.rollback()
        msg = "Ya existe una plantilla técnica con esa técnica" if "unique" in str(e).lower() else "No se pudo actualizar la plantilla técnica"
        print("[plantillas_tecnicas_cx][PUT] ERROR:", e)
        raise HTTPException(status_code=400, detail=msg)

@router_catalogos.delete("/plantillas_tecnicas_cx/{id_plantilla}", status_code=204, summary="Borrar plantilla técnica")
def borrar_plantilla_tecnica(id_plantilla: int, db: Session = Depends(get_db)):
    try:
        res = db.execute(
            text("""
                UPDATE public.plantillas_tecnicas_cx
                   SET activo = FALSE,
                       actualizado_en = NOW()
                 WHERE id_plantilla = :id
            """),
            {"id": id_plantilla}
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Plantilla técnica no encontrada")
        db.commit()
        return
    except Exception as e:
        db.rollback()
        print("[plantillas_tecnicas_cx][DELETE] ERROR:", e)
        raise HTTPException(status_code=500, detail="No se pudo borrar la plantilla técnica")

# Export alias so main.py can import either name
router = router_catalogos