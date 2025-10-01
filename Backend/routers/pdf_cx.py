# routers/pdf_cx.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from .Services_pdf import build_pdf_hzb_bytes

router = APIRouter(prefix="/pdf", tags=["pdf partes quirúrgicos"]) 

# ======================
# SQL base (HZB)
# ======================
SQL_HZB = text(
    """
    SELECT 
      p.nombre                                         AS apellido_y_nombre,
      p.dni                                            AS dni,
      CAST(date_part('year', age(current_date, p.fecha_nacimiento)) AS int) AS edad,
      to_char(pp.fecha, 'DD/MM/YYYY')                 AS fecha,
      pp.fecha                                        AS fecha_raw,
      pq.hora_inicio                                    AS hora_inicio,
      pq.hora_fin                                       AS hora_finalizacion,
      to_char(pq.hora_inicio, 'HH24:MI')                AS hora_inicio_24,
      to_char(pq.hora_fin, 'HH24:MI')                   AS hora_finalizacion_24,
      COALESCE(cob.nombre_cobertura, '')               AS cobertura,
      COALESCE(NULLIF(trim(p.beneficio), ''), '-')     AS numero_afiliado,

      COALESCE(dx.nombre_diagnostico, '')              AS diagnostico_preoperatorio,
      COALESCE(pq.anexo_diagnostico, '')               AS anexo,
      COALESCE(t.nombre_tecnica, '')                   AS procedimiento,
      COALESCE(pq.anexo_procedimiento, '')             AS anexo_procedimiento,

      COALESCE(cir.nombre,  '')                        AS cirujano,
      COALESCE(ay1.nombre,  '')                        AS primer_ayudante,
      COALESCE(ay2.nombre,  '')                        AS segundo_ayudante,
      COALESCE(ay3.nombre,  '')                        AS tercer_ayudante,
      COALESCE(instr.nombre,'')                        AS instrumentador,
      COALESCE(circ.nombre, '')                        AS circulante,
      COALESCE(anes.nombre, '')                        AS anestesiologo,
      COALESCE(ta.nombre,   '')                        AS tipo_anestesia,

      COALESCE(pq.tecnica_detalle, '')                 AS tecnica_detalle,

      CASE WHEN pp.patologia THEN 'SI' ELSE 'NO' END   AS patologia,
      CASE WHEN pp.cultivo   THEN 'SI' ELSE 'NO' END   AS cultivo

    FROM public.procedimientos_pacientes pp
    JOIN public.partes_quirurgicos pq 
      ON pq.id_procedimiento_paciente = pp.id_procedimiento_paciente
    JOIN public.pacientes p 
      ON p.id_paciente = pp.id_paciente
    LEFT JOIN public.coberturas cob 
      ON cob.id_cobertura = p.cobertura
    LEFT JOIN public.diagnosticos dx 
      ON dx.id_diagnostico = pq.id_diagnostico_pre
    LEFT JOIN public.tecnicas t 
      ON t.id_tecnica = pq.id_procedimiento
    LEFT JOIN public.cirujanos cir 
      ON cir.id = pq.id_cirujano
    LEFT JOIN public.cirujanos ay1 
      ON ay1.id = pq.id_ayudante1
    LEFT JOIN public.cirujanos ay2 
      ON ay2.id = pq.id_ayudante2
    LEFT JOIN public.cirujanos ay3 
      ON ay3.id = pq.id_ayudante3
    LEFT JOIN public.instrumentadores instr 
      ON instr.id_instrumentador = pq.id_instrumentador
    LEFT JOIN public.instrumentadores circ  
      ON circ.id_instrumentador  = pq.id_circulante
    LEFT JOIN public.anestesiologos anes 
      ON anes.id = pq.id_anestesiologo
    LEFT JOIN public.tipos_anestesia ta 
      ON ta.id_tipo_anestesia = pq.id_tipo_anestesia
    WHERE pp.id_procedimiento_paciente = :id_pp
    """
)

# ======================
# GET JSON (HZB)
# ======================
@router.get("/hzb/{id_pp}", summary="Datos HZB para PDF")
def datos_hzb(id_pp: int, db: Session = Depends(get_db)):
    try:
        row = db.execute(SQL_HZB, {"id_pp": id_pp}).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Parte no encontrado")
        return JSONResponse(dict(row))
    except HTTPException:
        raise
    except Exception as e:
        print("[pdf][HZB JSON] ERROR:", e)
        raise HTTPException(status_code=500, detail="Error generando datos del parte")

# ======================
# GET PDF (HZB)
# ======================
@router.get("/hzb/{id_pp}/pdf", summary="PDF HZB", response_class=Response)
def pdf_hzb(id_pp: int, db: Session = Depends(get_db)):
    try:
        row = db.execute(SQL_HZB, {"id_pp": id_pp}).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Parte no encontrado")
        data = dict(row)
    except HTTPException:
        raise
    except Exception as e:
        print("[pdf][HZB PDF] ERROR SQL:", e)
        raise HTTPException(status_code=500, detail="Error obteniendo datos del parte")

    pdf_bytes = build_pdf_hzb_bytes(data)

    headers = {"Content-Disposition": f'inline; filename="parte_hzb_{id_pp}.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
