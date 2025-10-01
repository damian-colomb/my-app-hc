# routers/PlantillasTecnicasSimple.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router_simple = APIRouter(prefix="/plantillas", tags=["plantillas_simple"])

@router_simple.get("/test")
def test_simple():
    return {"message": "Router simple funcionando"}

@router_simple.get("/plantillas_tecnicas_cx")
def listar_plantillas_simple(db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text("""
                SELECT id_plantilla AS id,
                       tecnica,
                       desarrollo
                  FROM plantillas_tecnicas_cx
                 WHERE activo IS TRUE
                 ORDER BY tecnica
            """)
        ).mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[plantillas_simple][GET] ERROR: {e}")
        return []
