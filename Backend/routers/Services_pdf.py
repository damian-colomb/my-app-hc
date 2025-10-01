# Services_pdf.py
"""
Servicio de generación de PDFs de partes quirúrgicos.

- Mantiene la lógica de render (presentación) separada de los routers.
- Ofrece builders para HZB y un modo overlay para Intecnus (plantilla PDF).

Dependencias:
  pip install reportlab PyPDF2
"""
from __future__ import annotations

from io import BytesIO
from typing import Dict, Any, Iterable, Tuple, Optional
import os
script_dir = os.path.dirname(os.path.abspath(__file__))
from datetime import datetime

# ReportLab (layout basado en Platypus para HZB)
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.utils import ImageReader
# Importar Canvas base para uso en canvasmaker
from reportlab.pdfgen import canvas as rl_canvas

# Para Intecnus con overlay sobre PDF pre-hecho (opcional)
try:
    from PyPDF2 import PdfReader, PdfWriter  # type: ignore[reportMissingImports]
    _HAS_PYPDF2 = True
except Exception:
    _HAS_PYPDF2 = False

# ---------------------------------------------------------------------
# Helpers comunes
# ---------------------------------------------------------------------

def _styles():
    styles = getSampleStyleSheet()
    # Títulos y labels
    styles.add(ParagraphStyle(
        name="TitleSmall",
        parent=styles["Heading1"],
        fontSize=18,           # antes 16
        leading=20,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name="SectionLabel",
        parent=styles["Normal"],
        fontSize=10,
        textColor="#444444",
        spaceBefore=4,
        spaceAfter=2,
        leading=11,
    ))
    styles.add(ParagraphStyle(
        name="FieldLabel",
        parent=styles["Normal"],
        fontSize=9.8,
        textColor="#555555",
    ))
    styles.add(ParagraphStyle(
        name="FieldValue",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        alignment=TA_JUSTIFY,  # justificar párrafos largos
    ))
    styles.add(ParagraphStyle(
        name="FieldValueInline",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="SectionHeader",
        parent=styles["Normal"],
        fontSize=12,
        leading=14,
        alignment=1,  # centrado
        spaceBefore=8,
        spaceAfter=4,
        textColor="#000000",
    ))
    styles.add(ParagraphStyle(
        name="FieldValueTechnique",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=10.5,
        leading=13,
        alignment=TA_JUSTIFY,  # siempre justificado
        firstLineIndent=0,
        spaceAfter=0,
    ))
    styles.add(ParagraphStyle(
        name="FieldValueSubDetail",
        parent=styles["Normal"],
        fontSize=10.5,
        leading=13,
        alignment=TA_JUSTIFY,
        textColor="#000000",
        spaceBefore=0,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="FieldValueIndented",
        parent=styles["Normal"],
        fontSize=10.5,
        leading=13,
        alignment=TA_JUSTIFY,
        leftIndent=8,
        spaceBefore=0,
        spaceAfter=3,
    ))
    return styles

# Helper para respetar saltos de línea del textarea (\n -> <br/>)

def _fmt(value: Any) -> str:
    return (str(value or "")).replace("\n", "<br/>")

def _fmt_technique(value: Any) -> str:
    """Para técnica: une líneas para permitir justificado.
    - Doble salto (\n\n) => salto de párrafo (<br/><br/>)
    - Saltos simples dentro del párrafo => espacio
    """
    s = str(value or "")
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    if "\n\n" in s:
        # Hay párrafos explícitos: respetarlos, pero unir saltos simples dentro del párrafo
        paras = [" ".join(p.splitlines()).strip() for p in s.split("\n\n") if p.strip()]
        return "<br/><br/>".join(paras)
    else:
        # No hay párrafos explícitos: unir líneas en un solo párrafo para que el justificado funcione
        return " ".join([ln.strip() for ln in s.split("\n") if ln.strip()])

def _fmt_time(value: Any) -> str:
    """Devuelve hora en formato h:mm am/pm si se puede parsear, o string plano en caso contrario."""
    try:
        from datetime import time, datetime as _dt
        def _fmt(dt: _dt) -> str:
            s = dt.strftime("%I:%M %p").lower()  # ej: "08:05 am"
            if s.startswith("0"):
                s = s[1:]  # sacar cero inicial -> "8:05 am"
            return s
        if isinstance(value, _dt):
            return _fmt(value)
        if isinstance(value, time):
            # convertir a datetime para strftime coherente
            from datetime import datetime as _datetime
            dt = _datetime.combine(_datetime.today().date(), value)
            return _fmt(dt)
        if value is not None:
            from dateutil.parser import parse
            dt = parse(str(value))
            return _fmt(dt)
    except Exception:
        pass
    return str(value or "")

# Helper para hora en 24 hs (HH:MM)
def _fmt_time24(value: Any) -> str:
    """Devuelve hora en formato 24 hs (HH:MM) si se puede parsear, o string plano en caso contrario."""
    try:
        from datetime import time, datetime as _dt
        if isinstance(value, _dt):
            return value.strftime("%H:%M")
        if isinstance(value, time):
            from datetime import datetime as _datetime
            dt = _datetime.combine(_datetime.today().date(), value)
            return dt.strftime("%H:%M")
        if value is not None:
            from dateutil.parser import parse
            dt = parse(str(value))
            return dt.strftime("%H:%M")
    except Exception:
        pass
    return str(value or "")

def _fmt_horario(hini: str, hfin: str) -> str:
    a = (hini or "").strip()
    b = (hfin or "").strip()
    if a and b:
        suf_a = a.split()[-1].lower() if " " in a else ""
        suf_b = b.split()[-1].lower() if " " in b else ""
        core_a = a.replace(" am", "").replace(" pm", "")
        core_b = b.replace(" am", "").replace(" pm", "")
        if suf_a and suf_b and suf_a == suf_b:
            return f"{core_a}–{core_b} {suf_a}"
        return f"{a}–{b}"
    return a or b


def _kv_table(pairs: Iterable[Tuple[str, Any]], styles) -> Table:
    """Convierte (label, value) en una tabla 2 columnas con estilo prolijo."""
    rows = [
        [Paragraph(f"{lab}", styles["FieldLabel"]), Paragraph(f"<b>{str(val or '')}</b>", styles["FieldValueInline"])]
        for lab, val in pairs
    ]
    tbl = Table(rows, colWidths=[70*mm, None])
    tbl.setStyle(TableStyle([
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING",    (0,0), (-1,-1), 2),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
    ]))
    return tbl

# ---------------------------------------------------------------------
# Header / Footer comunes (logo + fecha + nro de página)
# ---------------------------------------------------------------------

def _draw_header_footer(canvas, doc, *, title: str = "Resumen de Historia Clínica"):
    """Dibuja encabezado y pie con fecha/hora y numeración de página."""
    width, height = A4
    canvas.saveState()

    canvas.setFont("Helvetica-Bold", 16)
    # Título centrado
    canvas.drawCentredString(width / 2.0, height - 15 * mm, title)

    # Logo del hospital a la izquierda, centrado con el título
    try:
        # Buscar logo en ambas ubicaciones (local y producción)
        logo_path = os.path.join(script_dir, "..", "logo_hzb.jpg")
        if not os.path.exists(logo_path):
            # Si no existe en la raíz, buscar en static (entorno local)
            logo_path = os.path.join(script_dir, "..", "static", "logo_hzb.jpg")
        
        if os.path.exists(logo_path):
            # Redimensionar logo a un tamaño más pequeño
            logo_width = 25 * mm
            logo_height = 15 * mm
            # Centrar verticalmente con el título (height - 15mm es la posición del título)
            logo_y = height - 15 * mm - (logo_height / 2)
            canvas.drawImage(logo_path, 16 * mm, logo_y, 
                           width=logo_width, height=logo_height, 
                           preserveAspectRatio=True, anchor='nw')
    except Exception as e:
        print(f"Error cargando logo: {e}")

    # Separador fino (más abajo para dar espacio al logo)
    canvas.setLineWidth(0.5)
    canvas.line(16 * mm, height - 25 * mm, width - 16 * mm, height - 25 * mm)

    # Pie de página
    canvas.setFont("Helvetica", 9)
    # Solo numeración a la derecha (sin fecha de emisión para partes quirúrgicos)
    # Numeración a la derecha (formato: 1/2, 2/2, 1/3, 2/3, 3/3)
    current_page = canvas.getPageNumber()
    
    # Numeración simple: mostrar solo el número de página actual
    # Para el formato "1/5, 2/5, etc." necesitaríamos una estrategia de dos pasadas
    canvas.drawRightString(width - 16 * mm, 10 * mm, f"{current_page}")

    # Línea de firma en páginas 1 y 2 (fija), no en la última
    current_page = canvas.getPageNumber()
    total_pages = getattr(doc, 'pageCount', None)
    
    # Dibujar firma fija en páginas 1 y 2, no en la última
    if current_page == 1 or current_page == 2:
        # Páginas 1 y 2: Firma fija a 30mm del borde
        sig_line_w = 50 * mm
        sig_x1 = (width - sig_line_w) / 2.0
        sig_x2 = (width + sig_line_w) / 2.0
        sig_y = 30 * mm  # Posición fija desde abajo
        
        canvas.setLineWidth(0.3)
        canvas.line(sig_x1, sig_y, sig_x2, sig_y)
        canvas.setFont("Helvetica", 10)
        canvas.drawCentredString(width / 2.0, sig_y - 4 * mm, "Firma")

    canvas.restoreState()

def _draw_footer_with_signature(canvas, doc):
    """Dibuja pie de página con línea de firma solo en la última página."""
    width, height = A4
    canvas.saveState()

    # Firma centrada al pie (solo en la última página)
    sig_line_w = 50 * mm
    sig_y = 30 * mm
    sig_x1 = (width - sig_line_w) / 2.0
    sig_x2 = (width + sig_line_w) / 2.0

    canvas.setLineWidth(0.3)
    canvas.line(sig_x1, sig_y, sig_x2, sig_y)
    canvas.setFont("Helvetica", 10)
    canvas.drawCentredString(width / 2.0, sig_y - 4 * mm, "Firma")

    canvas.restoreState()

# ---------------------------------------------------------------------
# HZB: builder Platypus
# ---------------------------------------------------------------------

def build_pdf_hzb_bytes(data: Dict[str, Any]) -> bytes:
    """Arma el PDF HZB (layout limpio con Platypus)."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16*mm,
        rightMargin=16*mm,
        topMargin=28*mm,    # más espacio por header
        bottomMargin=60*mm, # más espacio para la firma en página 1
    )
    styles = _styles()

    story = []

    story.append(Paragraph("Datos personales", styles["SectionHeader"]))
    story.append(Spacer(1, 4))

    # Datos personales en 2 columnas (izq: Paciente/DNI/Edad · der: Cobertura/Afiliado)
    p_paciente  = Paragraph(f"Paciente:&nbsp;<b>{_fmt(data.get('apellido_y_nombre',''))}</b>", styles["FieldValueInline"])
    p_dni       = Paragraph(f"DNI:&nbsp;<b>{_fmt(data.get('dni',''))}</b>", styles["FieldValueInline"])
    p_edad      = Paragraph(f"Edad:&nbsp;<b>{_fmt(data.get('edad',''))}</b>", styles["FieldValueInline"])

    p_cobertura = Paragraph(f"Cobertura:&nbsp;<b>{_fmt(data.get('cobertura',''))}</b>", styles["FieldValueInline"])
    p_afiliado  = Paragraph(f"Afiliado:&nbsp;<b>{_fmt(data.get('numero_afiliado','-'))}</b>", styles["FieldValueInline"])

    patient_tbl = Table([
        [p_paciente,  p_cobertura],
        [p_dni,       p_afiliado],
        [p_edad,      ""],
    ], colWidths=[95*mm, None])

    patient_tbl.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
        ("LEADING",      (0,0), (-1,-1), 11),
    ]))

    story.append(patient_tbl)
    story.append(Spacer(1, 8))

    story.append(Spacer(1, 4))

    # Datos del procedimiento
    story.append(Paragraph("Datos del procedimiento", styles["SectionHeader"]))
    story.append(Spacer(1, 2))

    # Inline (sin tabulación): label normal + valor en negrita al lado
    # Formatear fecha con formato local si hay hora: "dd/mm/yyyy – HH:MM h"
    fecha_val = data.get("fecha")
    fecha_str = ""
    if fecha_val:
        try:
            if isinstance(fecha_val, datetime):
                if fecha_val.hour != 0 or fecha_val.minute != 0 or fecha_val.second != 0:
                    fecha_str = fecha_val.strftime("%d/%m/%Y - %H:%M h")
                else:
                    fecha_str = fecha_val.strftime("%d/%m/%Y")
            else:
                # Intentar parsear string a datetime
                from dateutil.parser import parse
                dt = parse(str(fecha_val))
                if dt.hour != 0 or dt.minute != 0 or dt.second != 0:
                    fecha_str = dt.strftime("%d/%m/%Y - %H:%M h")
                else:
                    fecha_str = dt.strftime("%d/%m/%Y")
        except Exception:
            fecha_str = str(fecha_val)
    else:
        fecha_str = ""

    # Preferir valores en 24 hs que vienen de la SQL; si no están, intentar formatear a 24 hs
    hora_ini_str = data.get("hora_inicio_24") or _fmt_time24(data.get("hora_inicio"))
    hora_fin_val = data.get("hora_fin") if data.get("hora_fin") is not None else data.get("hora_finalizacion") or data.get("hora_fin_24")
    hora_fin_str = data.get("hora_finalizacion_24") or _fmt_time24(hora_fin_val)
    hora_ini_disp = f"{hora_ini_str} hs" if hora_ini_str else ""
    hora_fin_disp = f"{hora_fin_str} hs" if hora_fin_str else ""

    proc_lines = [
        ("Fecha:",             fecha_str),
        ("Hora inicio:",       hora_ini_disp),
        ("Hora finalización:", hora_fin_disp),
        ("Diagnóstico:",       _fmt(data.get("diagnostico_preoperatorio"))),
        ("Detalle:",           _fmt(data.get("anexo"))),  # antes "Anexo"
        ("Procedimiento:",     _fmt(data.get("procedimiento"))),
        ("Observación:",       _fmt(data.get("anexo_procedimiento"))),  # antes "Anexo procedimiento"
    ]
    for lab, val in proc_lines:
        if not val.strip():
            continue
        if lab == "Detalle:":
            story.append(Paragraph(f"{lab} {val}", styles["FieldValueIndented"]))
            story.append(Spacer(1, 3))
        elif lab == "Observación:":
            story.append(Paragraph(f"{lab} {val}", styles["FieldValueIndented"]))
            story.append(Spacer(1, 2))
        else:
            story.append(Paragraph(f"{lab} <b>{val}</b>", styles["FieldValueInline"]))
            story.append(Spacer(1, 4))

    # Separación extra entre Observación y el bloque fijo (Tipo/Patología/Cultivo)
    story.append(Spacer(1, 6))

    # Bloque fijo: Tipo de anestesia / Patología / Cultivo (siempre visibles)
    tipo_val = _fmt(data.get("tipo_anestesia", "-")) or "-"
    pat_val = "Sí" if str(data.get("patologia", "")).strip().lower().startswith("s") else "No"
    cul_val = "Sí" if str(data.get("cultivo", "")).strip().lower().startswith("s") else "No"

    story.append(Paragraph(f"Tipo de anestesia: <b>{tipo_val}</b>", styles["FieldValueInline"]))
    story.append(Spacer(1, 5))
    story.append(Paragraph(f"Patología: <b>{pat_val}</b>", styles["FieldValueInline"]))
    story.append(Spacer(1, 5))
    story.append(Paragraph(f"Cultivo: <b>{cul_val}</b>", styles["FieldValueInline"]))
    story.append(Spacer(1, 5))

    # Técnica (cada salto de línea del textarea = nuevo párrafo justificado)
    p_tec = Paragraph("Técnica:", styles["FieldValueInline"])
    p_tec.keepWithNext = True
    story.append(p_tec)
    story.append(Spacer(1, 1))

    _raw_tex = str(data.get("tecnica_detalle") or "").replace("\r\n", "\n").replace("\r", "\n")
    # Reemplazar dobles espacios por uno solo y eliminar espacios antes de puntos
    while "  " in _raw_tex:
        _raw_tex = _raw_tex.replace("  ", " ")
    _raw_tex = _raw_tex.replace(" .", ".")
    _paras = [ln.strip() for ln in _raw_tex.split("\n") if ln.strip()]
    for i, _p in enumerate(_paras):
        # Si el último carácter no es uno de estos, agregar punto.
        if _p and i == len(_paras) - 1 and _p[-1] not in ".:;!?":
            _p = _p + "."
        story.append(Paragraph(_p, styles["FieldValueTechnique"]))
        if i < len(_paras) - 1:
            story.append(Spacer(1, 1))
    story.append(Spacer(1, 8))

    story.append(Spacer(1, 4))

    # Equipo quirúrgico - asegurar que no se superponga con la firma
    from reportlab.platypus import PageBreak, KeepTogether
    story.append(Spacer(1, 8))
    
    # Crear el bloque completo del equipo quirúrgico
    equipo_content = []
    equipo_content.append(Paragraph("Equipo quirúrgico", styles["SectionHeader"]))
    equipo_content.append(Spacer(1, 4))

    def _val_or_dash(value: Any) -> str:
        return str(value).strip() if str(value or "").strip() else "-"

    eqp_tbl = Table([
        [
            Paragraph(f"Cirujano: <b>{_fmt(_val_or_dash(data.get('cirujano')))}</b>", styles["FieldValueInline"]),
            Paragraph(f"Instrumentador: <b>{_fmt(_val_or_dash(data.get('instrumentador')))}</b>", styles["FieldValueInline"]),
        ],
        [
            Paragraph(f"1º Ayudante: <b>{_fmt(_val_or_dash(data.get('primer_ayudante')))}</b>", styles["FieldValueInline"]),
            Paragraph(f"Circulante: <b>{_fmt(_val_or_dash(data.get('circulante')))}</b>", styles["FieldValueInline"]),
        ],
        [
            Paragraph(f"2º Ayudante: <b>{_fmt(_val_or_dash(data.get('segundo_ayudante')))}</b>", styles["FieldValueInline"]),
            Paragraph(f"Anestesiólogo: <b>{_fmt(_val_or_dash(data.get('anestesiologo')))}</b>", styles["FieldValueInline"]),
        ],
        [
            Paragraph(f"3º Ayudante: <b>{_fmt(_val_or_dash(data.get('tercer_ayudante')))}</b>", styles["FieldValueInline"]),
            Paragraph("", styles["FieldValueInline"]),
        ],
    ], colWidths=[90*mm, None])

    eqp_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("ALIGN", (0,0), (-1,-1), "LEFT"),
        ("TOPPADDING", (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))

    # Completar el bloque del equipo quirúrgico
    equipo_content.append(eqp_tbl)
    equipo_content.append(Spacer(1, 60))  # 60mm de espacio antes de la firma
    
    # Agregar línea de firma después del equipo quirúrgico
    from reportlab.platypus import Table as RTable
    firma_table = RTable([
        ["", "Firma", ""]
    ], colWidths=[A4[0]/3, A4[0]/3, A4[0]/3])
    
    firma_table.setStyle([
        ("LINEBELOW", (1, 0), (1, 0), 0.3, "black"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("VALIGN", (1, 0), (1, 0), "BOTTOM"),
        ("FONTSIZE", (1, 0), (1, 0), 10),
        ("TOPPADDING", (1, 0), (1, 0), 4),
        ("BOTTOMPADDING", (1, 0), (1, 0), 2),
    ])
    
    equipo_content.append(firma_table)
    
    # Agregar el bloque completo (se mantendrá junto)
    story.append(KeepTogether(equipo_content))

    # La línea de firma se maneja en el header/footer de cada página

    # Removed the old flags table here (Patología/Cultivo)


    def _on_page(c, d):
        _draw_header_footer(c, d, title="Parte Quirúrgico - HZB")

    # Para poder mostrar total de páginas, asignamos pageCount a doc
    # ReportLab no provee directamente el total de páginas antes de build,
    # pero podemos usar onLaterPages y onFirstPage para asignar número de página
    # y hacer un dos-pasadas o usar doc.afterFlowable para contar páginas.
    # Aquí hacemos una solución simple con build con canvas que actualiza doc.page y doc.pageCount.

    # Decorar canvas para guardar pageCount al final, usando rl_canvas.Canvas
    class NumberedCanvas(rl_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._page_count = 0

        def showPage(self):
            self._page_count += 1
            super().showPage()

        def save(self):
            # Al guardar, exponemos el total al doc para el footer "Página X de Y"
            try:
                self._doc.pageCount = self._page_count + 1 if self._page_count == self._pageNumber else self._page_count
            except Exception:
                self._doc.pageCount = self._page_count
            super().save()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page, canvasmaker=NumberedCanvas)
    out = buf.getvalue()
    buf.close()
    return out


# ---------------------------------------------------------------------
# Intecnus (opcional): overlay sobre PDF plantilla
# ---------------------------------------------------------------------

def build_pdf_intecnus_overlay_bytes(background_pdf: bytes, fields: Dict[str, Tuple[float, float, str]]) -> bytes:
    """
    Crea un PDF para Intecnus escribiendo texto en posiciones absolutas (overlay) sobre
    un PDF de plantilla existente (background).

    Parámetros:
      - background_pdf: bytes del PDF de plantilla (1 o más páginas)
      - fields: dict { nombre_campo: (x_mm, y_mm, valor_str) }
                Coordenadas en milímetros desde la esquina inferior izquierda.

    Requiere PyPDF2.
    """
    if not _HAS_PYPDF2:
        raise RuntimeError("PyPDF2 no instalado. Instalá con: pip install PyPDF2")

    # Preparamos un PDF con el texto en las posiciones pedidas
    overlay_buf = BytesIO()
    from reportlab.pdfgen import canvas as _canvas
    c = _canvas.Canvas(overlay_buf, pagesize=A4)
    c.setFont("Helvetica", 10)

    for _, (x_mm_pos, y_mm_pos, value) in fields.items():
        x = float(x_mm_pos) * mm
        y = float(y_mm_pos) * mm
        c.drawString(x, y, str(value or ""))

    c.save()
    overlay_pdf = overlay_buf.getvalue()
    overlay_buf.close()

    # Mezclar overlay con background
    reader_bg = PdfReader(BytesIO(background_pdf))
    reader_ov = PdfReader(BytesIO(overlay_pdf))
    writer = PdfWriter()

    num_pages = len(reader_bg.pages)
    for i in range(num_pages):
        page_bg = reader_bg.pages[i]
        # Si overlay tiene 1 página, la reutilizamos; si tiene igual cantidad, usamos la i
        page_ov = reader_ov.pages[min(i, len(reader_ov.pages) - 1)]
        page_bg.merge_page(page_ov)  # mezcla
        writer.add_page(page_bg)

    out = BytesIO()
    writer.write(out)
    return out.getvalue()


# ---------------------------------------------------------------------
# Resumen de Historia Clínica
# ---------------------------------------------------------------------

def build_resumen_hc_bytes(data: Dict[str, Any]) -> bytes:
    """Arma el PDF del resumen de historia clínica."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16*mm,
        rightMargin=16*mm,
        topMargin=28*mm,
        bottomMargin=18*mm,
    )
    styles = _styles()

    story = []

    # Profesional
    story.append(Paragraph("<b>Dr. Colomb, Damián</b>", styles["FieldValueInline"]))
    story.append(Paragraph("Especialista en Cirugía General", styles["FieldValueInline"]))
    story.append(Paragraph("MPRN 6790 - 2642", styles["FieldValueInline"]))
    story.append(Spacer(1, 12))

    # DATOS PERSONALES
    story.append(Paragraph("DATOS PERSONALES", styles["SectionHeader"]))
    story.append(Spacer(1, 4))
    
    # Datos personales en dos columnas
    datos_izq = [
        ("Nombre:", data.get('nombre', '')),
        ("DNI:", data.get('dni', '')),
        ("Edad:", data.get('edad', '')),
        ("Cobertura:", data.get('cobertura', '')),
    ]
    
    datos_der = [
        ("Teléfono:", data.get('telefono', '')),
        ("Email:", data.get('email', '')),
        ("Localidad:", data.get('localidad', '')),
        ("", ""),  # Espacio vacío para alineación
    ]
    
    # Crear tabla de dos columnas
    filas_datos = []
    for i in range(max(len(datos_izq), len(datos_der))):
        fila = []
        # Columna izquierda
        if i < len(datos_izq):
            label, value = datos_izq[i]
            if value:
                fila.append(Paragraph(f"{label} <b>{_fmt(value)}</b>", styles["FieldValueInline"]))
            else:
                fila.append(Paragraph("", styles["FieldValueInline"]))
        else:
            fila.append(Paragraph("", styles["FieldValueInline"]))
        
        # Columna derecha
        if i < len(datos_der):
            label, value = datos_der[i]
            if value:
                fila.append(Paragraph(f"{label} <b>{_fmt(value)}</b>", styles["FieldValueInline"]))
            else:
                fila.append(Paragraph("", styles["FieldValueInline"]))
        else:
            fila.append(Paragraph("", styles["FieldValueInline"]))
        
        filas_datos.append(fila)
    
    tabla_datos = Table(filas_datos, colWidths=[90*mm, 90*mm])
    tabla_datos.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ("LEADING", (0,0), (-1,-1), 11),
    ]))
    
    story.append(tabla_datos)
    
    # Cobertura y Beneficio en una línea
    cobertura = data.get('cobertura', '')
    beneficio = data.get('beneficio', '')
    if cobertura or beneficio:
        cobertura_text = f"Cobertura: <b>{cobertura}</b>" if cobertura else ""
        beneficio_text = f"<b>{beneficio}</b>" if beneficio else ""
        if cobertura_text and beneficio_text:
            story.append(Paragraph(f"{cobertura_text}  {beneficio_text}", styles["FieldValueInline"]))
        elif cobertura_text:
            story.append(Paragraph(cobertura_text, styles["FieldValueInline"]))
        elif beneficio_text:
            story.append(Paragraph(f"Beneficio: {beneficio_text}", styles["FieldValueInline"]))
        story.append(Spacer(1, 4))
    
    story.append(Spacer(1, 8))

    # ANTECEDENTES
    story.append(Paragraph("ANTECEDENTES", styles["SectionHeader"]))
    story.append(Spacer(1, 4))
    
    antecedentes = [
        ("Médicos:", data.get('medicos', '')),
        ("Quirúrgicos:", data.get('quirurgicos', '')),
        ("Alérgicos:", data.get('alergicos', '')),
        ("Tóxicos:", data.get('toxicos', '')),
        ("Familiares:", data.get('familiares', '')),
        ("Ginecoobstétricos:", data.get('ginecoobstetricos', '')),
    ]
    
    for label, value in antecedentes:
        if value:
            story.append(Paragraph(f"{label}", styles["FieldValueInline"]))
            story.append(Paragraph(f"<b>{_fmt(value)}</b>", styles["FieldValue"]))
            story.append(Spacer(1, 6))
    
    story.append(Spacer(1, 8))

    # 3. CONSULTAS (ordenadas cronológicamente)
    consultas = data.get('consultas', [])
    if consultas:
        story.append(Paragraph("CONSULTAS", styles["SectionHeader"]))
        story.append(Spacer(1, 4))
        
        for consulta in consultas:
            fecha = consulta.get('fecha_consulta', '')
            motivo = consulta.get('motivo_consulta', '')
            evoluciones = consulta.get('evoluciones', [])
            
            story.append(Paragraph(f"<b>{fecha}</b> - <b>{motivo}</b>", styles["FieldValueInline"]))
            
            if evoluciones:
                story.append(Paragraph("<b>Consultas:</b>", styles["FieldValueInline"]))
                for evol in evoluciones:
                    fecha_evol = evol.get('fecha_evolucion', '')
                    contenido = evol.get('contenido', '')
                    story.append(Paragraph(f"  {fecha_evol}: {_fmt(contenido)}", styles["FieldValueIndented"]))
            
            story.append(Spacer(1, 6))
    
    story.append(Spacer(1, 8))

    # 4. EXÁMENES COMPLEMENTARIOS (ordenados cronológicamente)
    examenes = data.get('examenes', [])
    if examenes:
        story.append(Paragraph("EXÁMENES COMPLEMENTARIOS", styles["SectionHeader"]))
        story.append(Spacer(1, 4))
        
        # Agrupar por tipo
        laboratorios = [e for e in examenes if e.get('tipo_examen') == 'laboratorio']
        imagenes = [e for e in examenes if e.get('tipo_examen') == 'imagen']
        otros = [e for e in examenes if e.get('tipo_examen') == 'otro']
        
        if laboratorios:
            story.append(Paragraph("<b>Laboratorio:</b>", styles["FieldValueInline"]))
            for lab in laboratorios:
                fecha = lab.get('fecha', '')
                tipo = lab.get('tipo_estudio', '')
                descripcion = lab.get('descripcion', '')
                story.append(Paragraph(f"  <b>{fecha}</b> - <b>{tipo}</b>: {_fmt(descripcion)}", styles["FieldValueIndented"]))
            story.append(Spacer(1, 4))
        
        if imagenes:
            story.append(Paragraph("<b>Imágenes:</b>", styles["FieldValueInline"]))
            for img in imagenes:
                fecha = img.get('fecha', '')
                tipo = img.get('tipo_estudio', '')
                descripcion = img.get('descripcion', '')
                story.append(Paragraph(f"  <b>{fecha}</b> - <b>{tipo}</b>: {_fmt(descripcion)}", styles["FieldValueIndented"]))
            story.append(Spacer(1, 4))
        
        if otros:
            story.append(Paragraph("<b>Otros:</b>", styles["FieldValueInline"]))
            for otro in otros:
                fecha = otro.get('fecha', '')
                tipo = otro.get('tipo_estudio', '')
                descripcion = otro.get('descripcion', '')
                story.append(Paragraph(f"  <b>{fecha}</b> - <b>{tipo}</b>: {_fmt(descripcion)}", styles["FieldValueIndented"]))
    
    story.append(Spacer(1, 8))

    # 5. PROCEDIMIENTOS (ordenados cronológicamente)
    procedimientos = data.get('procedimientos', [])
    if procedimientos:
        story.append(Paragraph("PROCEDIMIENTOS", styles["SectionHeader"]))
        story.append(Spacer(1, 4))
        
        for proc in procedimientos:
            fecha = proc.get('fecha', '')
            procedimiento_base = proc.get('procedimiento_base', '')
            diagnostico_pre = proc.get('diagnostico_pre', '')
            anexo_diagnostico = proc.get('anexo_diagnostico', '')
            procedimiento_quirurgico = proc.get('procedimiento_quirurgico', '')
            anexo_procedimiento = proc.get('anexo_procedimiento', '')
            
            story.append(Paragraph(f"<b>{fecha}</b>", styles["FieldValueInline"]))
            
            # 1. Procedimiento
            if procedimiento_base:
                story.append(Paragraph(f"Procedimiento: <b>{procedimiento_base}</b>", styles["FieldValueInline"]))
            
            # 2. Observación (anexo técnica)
            if anexo_procedimiento:
                story.append(Paragraph(f"Observación: <b>{_fmt(anexo_procedimiento)}</b>", styles["FieldValue"]))
            
            # 3. Diagnóstico
            if diagnostico_pre:
                story.append(Paragraph(f"Diagnóstico: <b>{diagnostico_pre}</b>", styles["FieldValueInline"]))
            
            # 4. Detalle (anexo diagnóstico)
            if anexo_diagnostico:
                story.append(Paragraph(f"Detalle: <b>{_fmt(anexo_diagnostico)}</b>", styles["FieldValue"]))
            
            story.append(Spacer(1, 6))
    
    story.append(Spacer(1, 8))

    # 6. INTERCONSULTAS (ordenadas cronológicamente)
    interconsultas = data.get('interconsultas', [])
    if interconsultas:
        story.append(Paragraph("INTERCONSULTAS", styles["SectionHeader"]))
        story.append(Spacer(1, 4))
        
        for inter in interconsultas:
            fecha = inter.get('fecha', '')
            especialidad = inter.get('especialidad', '')
            descripcion = inter.get('descripcion', '')
            
            story.append(Paragraph(f"<b>Fecha:</b> {fecha}", styles["FieldValueInline"]))
            story.append(Paragraph(f"<b>Especialidad:</b> {especialidad}", styles["FieldValueInline"]))
            story.append(Paragraph(f"<b>Descripción:</b> {_fmt(descripcion)}", styles["FieldValue"]))
            story.append(Spacer(1, 6))

    def _on_first_page(c, d):
        _draw_header_footer(c, d, title="Resumen de Historia Clínica")
    
    def _on_later_pages(c, d):
        _draw_header_footer(c, d, title="Resumen de Historia Clínica")
        # Agregar firma solo en la última página
        if hasattr(d, 'page') and hasattr(d, 'pageCount') and d.page == d.pageCount:
            _draw_footer_with_signature(c, d)

    doc.build(story, onFirstPage=_on_first_page, onLaterPages=_on_later_pages)
    out = buf.getvalue()
    buf.close()
    return out