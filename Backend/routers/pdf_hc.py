# routers/pdf_hc.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from .Services_pdf import build_resumen_hc_bytes

router = APIRouter(prefix="/pdf", tags=["pdf historia clínica"])

# ======================
# SQL para Resumen de Historia Clínica
# ======================

# 1. Datos Personales
SQL_DATOS_PERSONALES = text("""
    SELECT 
        p.id_paciente,
        p.nombre,
        p.dni,
        p.fecha_nacimiento,
        EXTRACT(YEAR FROM age(p.fecha_nacimiento)) AS edad,
        s.sexo AS sexo,
        c.nombre_cobertura AS cobertura,
        p.beneficio,
        n.nombre_nacionalidad AS nacionalidad,
        l.nombre_localidad AS localidad,
        p.telefono,
        p.email,
        p.anexo,
        p.activo
    FROM pacientes p
    LEFT JOIN sexo s ON p.sexo = s.id_sexo
    LEFT JOIN coberturas c ON p.cobertura = c.id_cobertura
    LEFT JOIN nacionalidades n ON p.nacionalidad = n.id_nacionalidad
    LEFT JOIN localidades l ON p.localidad = l.id_localidad
    WHERE p.id_paciente = :id_paciente
""")

# 2. Antecedentes
SQL_ANTECEDENTES = text("""
    SELECT 
        a.id_paciente,
        a.medicos,
        a.quirurgicos,
        a.alergicos,
        a.toxicos,
        a.familiares,
        a.ginecoobstetricos
    FROM antecedentes a
    WHERE a.id_paciente = :id_paciente
""")

# 3. Exámenes Complementarios
SQL_EXAMENES = text("""
    SELECT *
    FROM (
      -- Laboratorios
      SELECT 
          'laboratorio'::text AS tipo_examen,
          l.id,
          l.fecha,
          lab.laboratorio AS tipo_estudio,
          l.descripcion
      FROM laboratorios_pacientes l
      LEFT JOIN laboratorio lab ON l.id_laboratorio = lab.id
      WHERE l.id_paciente = :id_paciente

      UNION ALL

      -- Imágenes
      SELECT 
          'imagen'::text AS tipo_examen,
          i.id,
          i.fecha,
          img.imagen AS tipo_estudio,
          i.descripcion
      FROM imagenes_pacientes i
      LEFT JOIN imagenes img ON i.id_imagen = img.id
      WHERE i.id_paciente = :id_paciente

      UNION ALL

      -- Otros estudios
      SELECT 
          'otro'::text AS tipo_examen,
          o.id,
          o.fecha,
          oe.estudio AS tipo_estudio,
          o.descripcion
      FROM otros_estudios_pacientes o
      LEFT JOIN otros_estudios oe ON o.id_otro = oe.id
      WHERE o.id_paciente = :id_paciente
    ) t
    ORDER BY t.fecha DESC
""")

# 4. Procedimientos
SQL_PROCEDIMIENTOS = text("""
    SELECT 
        pp.id_procedimiento_paciente,
        pp.fecha,
        t.nombre_tecnica as procedimiento_base,
        tc.nombre as tipo_cirugia,
        pp.patologia,
        pp.cultivo,
        d.nombre_diagnostico as diagnostico_pre,
        pq.anexo_diagnostico,
        pq.anexo_procedimiento,
        t2.nombre_tecnica as procedimiento_quirurgico
    FROM procedimientos_pacientes pp
    LEFT JOIN tecnicas t ON pp.id_procedimiento_base = t.id_tecnica
    LEFT JOIN tipos_cirugia tc ON pp.tipo_cirugia = tc.id_tipo
    LEFT JOIN instituciones_base i ON pp.id_institucion = i.id_institucion
    LEFT JOIN partes_quirurgicos pq ON pp.id_procedimiento_paciente = pq.id_procedimiento_paciente
    LEFT JOIN diagnosticos d ON pq.id_diagnostico_pre = d.id_diagnostico
    LEFT JOIN tecnicas t2 ON pq.id_procedimiento = t2.id_tecnica
    WHERE pp.id_paciente = :id_paciente
    ORDER BY pp.fecha DESC
""")

# 5. Interconsultas
SQL_INTERCONSULTAS = text("""
    SELECT 
        ic.id_interconsulta,
        ic.fecha,
        e.especialidad,
        ic.descripcion
    FROM interconsultas ic
    LEFT JOIN especialidad e ON ic.especialidad = e.id
    WHERE ic.id_paciente = :id_paciente
    ORDER BY ic.fecha DESC
""")

# 6. Consultas con Evoluciones
SQL_CONSULTAS = text("""
    SELECT 
        c.id_consulta,
        c.fecha_consulta,
        mc.motivo_consulta,
        c.motivo as id_motivo,
        COALESCE(
            json_agg(
                json_build_object(
                    'id_evolucion', e.id_evolucion,
                    'fecha_evolucion', e.fecha_evolucion,
                    'contenido', e.contenido
                )
            ) FILTER (WHERE e.id_evolucion IS NOT NULL),
            '[]'::json
        ) as evoluciones
    FROM consultas c
    LEFT JOIN motivos_consulta mc ON c.motivo = mc.id_motivo
    LEFT JOIN evoluciones e ON c.id_consulta = e.id_consulta
    WHERE c.id_paciente = :id_paciente
    GROUP BY c.id_consulta, c.fecha_consulta, mc.motivo_consulta, c.motivo
    ORDER BY c.fecha_consulta DESC
""")

# ======================
# GET PDF Resumen Historia Clínica
# ======================
@router.get("/resumen-hc/{id_paciente}", summary="Resumen de Historia Clínica PDF", response_class=Response)
def pdf_resumen_hc(id_paciente: int, db: Session = Depends(get_db)):
    try:
        # Ejecutar las 6 consultas
        datos_personales = db.execute(SQL_DATOS_PERSONALES, {"id_paciente": id_paciente}).mappings().first()
        if not datos_personales:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        
        antecedentes = db.execute(SQL_ANTECEDENTES, {"id_paciente": id_paciente}).mappings().first()
        examenes = db.execute(SQL_EXAMENES, {"id_paciente": id_paciente}).mappings().all()
        procedimientos = db.execute(SQL_PROCEDIMIENTOS, {"id_paciente": id_paciente}).mappings().all()
        interconsultas = db.execute(SQL_INTERCONSULTAS, {"id_paciente": id_paciente}).mappings().all()
        consultas = db.execute(SQL_CONSULTAS, {"id_paciente": id_paciente}).mappings().all()
        
        # Debug: imprimir las consultas para ver qué contienen
        print(f"[DEBUG] Consultas encontradas: {len(consultas)}")
        for i, consulta in enumerate(consultas):
            print(f"[DEBUG] Consulta {i}: {dict(consulta)}")
        
        # Combinar todos los datos
        data = dict(datos_personales)
        if antecedentes:
            data.update(dict(antecedentes))
        
        data['examenes'] = [dict(e) for e in examenes]
        data['procedimientos'] = [dict(p) for p in procedimientos]
        data['interconsultas'] = [dict(i) for i in interconsultas]
        data['consultas'] = [dict(c) for c in consultas]
        
    except HTTPException:
        raise
    except Exception as e:
        print("[pdf][Resumen HC] ERROR SQL:", e)
        raise HTTPException(status_code=500, detail="Error obteniendo datos del resumen")

    pdf_bytes = build_resumen_hc_bytes(data)

    headers = {"Content-Disposition": f'inline; filename="resumen_hc_{id_paciente}.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
