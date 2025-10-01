from sqlalchemy import Column, Integer, BigInteger, SmallInteger, Text, Date, ForeignKey, String, Boolean, DateTime, text
from sqlalchemy.orm import declarative_base, relationship
from datetime import date
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid


# -------------------------------------------------
# Declarative Base
# -------------------------------------------------
Base = declarative_base()

# -------------------------------------------------
# PACIENTES
# -------------------------------------------------

# Representa a un paciente en la base de datos.
class Paciente(Base):
    __tablename__ = "pacientes"

    id_paciente = Column(BigInteger, primary_key=True)
    nombre = Column(Text, nullable=False)  # Nombre completo del paciente
    dni = Column(Text)  # Documento Nacional de Identidad
    fecha_nacimiento = Column(Date)  # Fecha de nacimiento
    sexo = Column(Integer, ForeignKey("sexo.id_sexo"), nullable=True)  # Referencia a Sexo
    cobertura = Column(Integer, ForeignKey("coberturas.id_cobertura"), nullable=True)  # Referencia a Cobertura médica
    beneficio = Column(Text)  # Número o tipo de beneficio
    nacionalidad = Column(Integer, ForeignKey("nacionalidades.id_nacionalidad"), nullable=True)  # Referencia a Nacionalidad
    localidad = Column(Integer, ForeignKey("localidades.id_localidad"), nullable=True)  # Referencia a Localidad
    telefono = Column(Text)  # Teléfono de contacto
    email = Column(Text)  # Correo electrónico
    anexo = Column(Text)  # Información adicional
    activo = Column(Boolean, nullable=False, server_default=text("true"), default=True)

    # Relaciones con tablas auxiliares para mostrar descripciones
    cobertura_rel = relationship("Cobertura", lazy="joined")
    nacionalidad_rel = relationship("Nacionalidad", lazy="joined")
    localidad_rel = relationship("Localidad", lazy="joined")

# -------------------------------------------------
# ENTIDADES AUXILIARES
# -------------------------------------------------

# Representa una cobertura médica (ej. PAMI, OSDE).
class Cobertura(Base):
    __tablename__ = "coberturas"
    id_cobertura = Column(Integer, primary_key=True)
    nombre_cobertura = Column(Text)  # Nombre de la cobertura médica

# Representa una nacionalidad (ej. Argentina, Chilena).
class Nacionalidad(Base):
    __tablename__ = "nacionalidades"
    id_nacionalidad = Column(Integer, primary_key=True)
    nombre_nacionalidad = Column(Text)  # Nombre de la nacionalidad

# Representa una localidad (ej. Bariloche, Cipolletti).
class Localidad(Base):
    __tablename__ = "localidades"
    id_localidad = Column(Integer, primary_key=True)
    nombre_localidad = Column(Text)  # Nombre de la localidad

# Representa el sexo del paciente (ej. Masculino, Femenino).
class Sexo(Base):
    __tablename__ = "sexo"
    id_sexo = Column(Integer, primary_key=True)
    sexo = Column(String)  # Descripción del sexo

# -------------------------------------------------
# TURNOS Y DERIVADORES (se agregará más adelante)
# -------------------------------------------------

# Representa a un derivador
class Derivador(Base):
    __tablename__ = "derivadores"
    id_derivador = Column(BigInteger, primary_key=True)
    nombre_derivador = Column(Text, nullable=False)  # Nombre completo del derivador

# Representa un turno asignado.
class Turno(Base):
    __tablename__ = "turnos"
    id_turno = Column(Integer, primary_key=True)
    nombre = Column(Text, nullable=False)  # Nombre del paciente
    fecha = Column(Date, nullable=False)  # Fecha del turno
    motivo = Column(Text)  # Motivo de la consulta
    derivador = Column(Integer, ForeignKey("derivadores.id_derivador"), nullable=True)  # ID del derivador

    derivador_rel = relationship("Derivador", lazy="joined")  # Relación con derivador para mostrar el nombre

# Bases para los select Motivo Consulta,  Laboratorio, imagenes, otros :
class Laboratorio(Base):
    __tablename__ = "laboratorio"
    id = Column(Integer, primary_key=True, index=True)
    laboratorio = Column(Text, unique=True, nullable=False)

class Imagen(Base):
    __tablename__ = "imagenes"
    id = Column(Integer, primary_key=True, index=True)
    imagen = Column(Text, unique=True, nullable=False)

class Especialidad(Base):
    __tablename__ = "especialidad"
    id = Column(Integer, primary_key=True, index=True)
    especialidad = Column(Text, unique=True, nullable=False)

class MotivoConsulta(Base):
    __tablename__ = "motivos_consulta"

    id_motivo = Column(Integer, primary_key=True, index=True)
    motivo_consulta = Column(Text, unique=True, nullable=False)

class OtrosEstudios(Base):
    __tablename__ = "otros_estudios"

    id = Column(Integer, primary_key=True, index=True)
    estudio = Column(String, unique=True, index=True)

#Antecendentes:
class Antecedente(Base):
    __tablename__ = "antecedentes"

    id = Column(Integer, primary_key=True, index=True)
    id_paciente = Column(BigInteger, ForeignKey("pacientes.id_paciente", ondelete="CASCADE"), unique=True, nullable=False)
    medicos = Column(Text, nullable=True)
    quirurgicos = Column(Text, nullable=True)
    alergicos = Column(Text, nullable=True)
    toxicos = Column(Text, nullable=True)
    familiares = Column(Text, nullable=True)
    ginecoobstetricos = Column(Text, nullable=True)


# CONSULTAS
class Consulta(Base):
    __tablename__ = "consultas"
    id_consulta = Column(BigInteger, primary_key=True, index=True)
    id_paciente = Column(Integer, ForeignKey("pacientes.id_paciente"))
    motivo = Column(Integer, ForeignKey("motivos_consulta.id_motivo"))
    fecha_consulta = Column(Date)

# EVOLUCIONES
class Evolucion(Base):
    __tablename__ = "evoluciones"
    id_evolucion = Column(Integer, primary_key=True, index=True)
    id_consulta = Column(Integer, ForeignKey("consultas.id_consulta"), nullable=False)
    fecha_evolucion = Column(Date, nullable=False, default=date.today)
    contenido = Column(Text, nullable=False)

# INTERCONSULTAS:
class Interconsulta(Base):
    __tablename__ = "interconsultas"

    id_interconsulta = Column(Integer, primary_key=True, index=True)
    id_paciente       = Column(Integer, ForeignKey("pacientes.id_paciente"), nullable=False)
    fecha             = Column(Date, nullable=False)
    id_especialidad = Column("especialidad", Integer, ForeignKey("especialidad.id"), nullable=False)
    especialidad_rel = relationship("Especialidad", lazy="joined")
    descripcion       = Column(Text, nullable=False)
    nombre_archivo    = Column(String, nullable=True)
    ruta_archivo      = Column(Text, nullable=True)


# EXAMENES COMPLEMENTARIOS de pacientes:

class LaboratorioPaciente(Base):
    __tablename__ = "laboratorios_pacientes"

    id = Column(Integer, primary_key=True, index=True)
    id_paciente = Column(BigInteger, ForeignKey("pacientes.id_paciente"), nullable=False)
    fecha = Column(Date, nullable=False)
    id_laboratorio = Column(Integer, ForeignKey("laboratorio.id"), nullable=False)
    descripcion = Column(Text)
    ruta_archivo = Column(Text)
    nombre_archivo = Column(Text, nullable=True)

class ImagenPaciente(Base):
    __tablename__ = "imagenes_pacientes"

    id = Column(Integer, primary_key=True, index=True)
    id_paciente = Column(BigInteger, ForeignKey("pacientes.id_paciente"), nullable=False)
    fecha = Column(Date, nullable=False)
    id_imagen = Column(Integer, ForeignKey("imagenes.id"), nullable=False)
    descripcion = Column(Text)
    ruta_archivo = Column(Text)
    nombre_archivo = Column(String, nullable=True)

class OtroEstudioPaciente(Base):
    __tablename__ = "otros_estudios_pacientes"

    id = Column(Integer, primary_key=True, index=True)
    id_paciente = Column(BigInteger, ForeignKey("pacientes.id_paciente"), nullable=False)
    fecha = Column(Date, nullable=False)
    id_otro = Column(Integer, ForeignKey("otros_estudios.id"), nullable=False)
    descripcion = Column(Text)
    ruta_archivo = Column(Text)
    nombre_archivo = Column(String, nullable=True)


# ----------------------------------
# INSTITUCIONES BASE
# ----------------------------------
class InstitucionBase(Base):
    __tablename__ = "instituciones_base"

    id_institucion = Column(Integer, primary_key=True, index=True)
    institucion    = Column(String, unique=True, nullable=False)


# ----------------------------------
# PROCEDIMIENTOS BASE
# ----------------------------------
class ProcedimientoBase(Base):
    __tablename__ = "procedimientos_base"

    id_procedimiento = Column(Integer, primary_key=True, index=True)
    procedimiento    = Column(String, unique=True, nullable=False)


# ----------------------------------
# TIPOS DE CIRUGÍA (catálogo)
# ----------------------------------
class TipoCirugia(Base):
    __tablename__ = "tipos_cirugia"

    id_tipo = Column(SmallInteger, primary_key=True, index=True)
    nombre  = Column(String(50), nullable=False, unique=True)


# ----------------------------------
# PROCEDIMIENTOS DE PACIENTES
# ----------------------------------
class ProcedimientoPaciente(Base):
    __tablename__ = "procedimientos_pacientes"

    # BIGINT identity PK
    id_procedimiento_paciente = Column(BigInteger, primary_key=True, autoincrement=True, index=True)

    # FK → pacientes.id_paciente (BIGINT)
    id_paciente = Column(BigInteger, ForeignKey("pacientes.id_paciente", ondelete="CASCADE"), nullable=False)

    # FK → tecnicas.id_tecnica (la columna en la tabla se llama id_procedimiento_base)
    id_procedimiento_base = Column(Integer, ForeignKey("tecnicas.id_tecnica"), nullable=False)

    # Fecha del procedimiento
    fecha = Column(Date, nullable=False)

    # FK → instituciones_base.id_institucion (BIGINT)
    id_institucion = Column(BigInteger, ForeignKey("instituciones_base.id_institucion"), nullable=False)

    # Urgencia/Programada (1/2) – FK al catálogo tipos_cirugia
    tipo_cirugia = Column(SmallInteger, ForeignKey("tipos_cirugia.id_tipo"), nullable=False, default=1)

    # Flags
    patologia = Column(Boolean, nullable=False, default=False)
    cultivo   = Column(Boolean, nullable=False, default=False)

    # Relaciones (ajustadas a los catálogos reales)
    paciente_rel       = relationship("Paciente", lazy="joined")
    procedimiento_rel  = relationship("Tecnica", lazy="joined", primaryjoin="ProcedimientoPaciente.id_procedimiento_base==Tecnica.id_tecnica")
    institucion_rel    = relationship("InstitucionBase", lazy="joined")
    tipo_cirugia_rel   = relationship("TipoCirugia", lazy="joined")


# ----------------------------------
# PARTES QUIRÚRGICOS (detalle del acto)
# ----------------------------------
class ParteQuirurgico(Base):
    __tablename__ = "partes_quirurgicos"

    # PK que iguala al id del procedimiento_paciente (según tu esquema)
    id_parte = Column(BigInteger, primary_key=True, index=True)

    # En la tabla existen ambos campos; dejamos los dos por compatibilidad
    id_procedimiento_paciente = Column(
        BigInteger,
        ForeignKey("procedimientos_pacientes.id_procedimiento_paciente", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Tiempos (usamos timestamptz para compatibilidad con la DB)
    hora_inicio = Column(DateTime(timezone=True), nullable=True)
    hora_fin    = Column(DateTime(timezone=True), nullable=True)

    # Diagnóstico preoperatorio y anexos
    id_diagnostico_pre = Column(Integer, ForeignKey("diagnosticos.id_diagnostico"), nullable=True, index=True)
    anexo_diagnostico  = Column(Text, nullable=True)

    # Procedimiento (si lo necesitás en esta tabla además del PP)
    id_procedimiento    = Column(Integer, ForeignKey("procedimientos_base.id_procedimiento"), nullable=True)
    anexo_procedimiento = Column(Text, nullable=True)
    tecnica_detalle = Column(Text, nullable=True)

    # Equipo quirúrgico (en tu DB cirujanos/anestes usan UUID; no imponemos FK del ORM para evitar choques de tipos)
    id_cirujano       = Column(UUID(as_uuid=True), nullable=True, index=True)
    id_anestesiologo  = Column(UUID(as_uuid=True), nullable=True, index=True)
    id_instrumentador = Column(BigInteger, nullable=True, index=True)
    id_tipo_anestesia = Column(Integer, ForeignKey("tipos_anestesia.id_tipo_anestesia"), nullable=True, index=True)

    # Ayudantes (ahora con nombres consistentes a la DB)
    id_ayudante1 = Column(BigInteger, nullable=True)
    id_ayudante2 = Column(BigInteger, nullable=True)
    id_ayudante3 = Column(BigInteger, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relaciones útiles
    procedimiento_paciente_rel = relationship("ProcedimientoPaciente", lazy="joined")

# ----------------------------------
# FOTOS DE PARTES QUIRÚRGICOS / PROCEDIMIENTOS
# ----------------------------------
class FotoParteCx(Base):
    __tablename__ = "fotos_partes_cx"

    id_foto = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_procedimiento_paciente = Column(
        Integer,
        ForeignKey("procedimientos_pacientes.id_procedimiento_paciente", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    storage_key = Column(Text, nullable=False)   # ruta interna en el bucket (Supabase)
    url = Column(Text, nullable=False)           # URL pública
    filename = Column(Text, nullable=False)      # nombre original
    content_type = Column(String, nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relación útil
    procedimiento_rel = relationship("ProcedimientoPaciente", lazy="joined")

# ----------------------------------
# PATOLOGÍA PRINCIPAL
# ----------------------------------
class Patologia(Base):
    __tablename__ = "patologias"

    id_patologia      = Column(Integer, primary_key=True, index=True)
    id_paciente       = Column(BigInteger, ForeignKey("pacientes.id_paciente", ondelete="CASCADE"), nullable=False)
    id_procedimiento  = Column(Integer, ForeignKey("procedimientos_base.id_procedimiento"), nullable=False)
    id_procedimiento_paciente = Column(BigInteger, ForeignKey("procedimientos_pacientes.id_procedimiento_paciente"), nullable=True)
    fecha             = Column(Date, nullable=False)
    fecha_procedimiento = Column(Date, nullable=True)
    informe_texto     = Column(Text, nullable=True)
    informe_pdf_key   = Column(Text, nullable=True)
    informe_pdf_url   = Column(Text, nullable=True)
    tipo_registro     = Column(String, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    paciente_rel      = relationship("Paciente", lazy="joined")
    procedimiento_rel = relationship("ProcedimientoBase", lazy="joined")
    procedimiento_paciente_rel = relationship("ProcedimientoPaciente", lazy="joined")
    fotos             = relationship("FotosPatologia", back_populates="patologia_rel", cascade="all, delete-orphan")
    vcc_detalle       = relationship("PatologiaVCC", back_populates="patologia_rel", uselist=False, cascade="all, delete-orphan", passive_deletes=True, lazy="noload")


# ----------------------------------
# DETALLE ESPECÍFICO PARA VCC
# ----------------------------------
class PatologiaVCC(Base):
    __tablename__ = "patologias_vcc"

    id            = Column("id_vcc", Integer, primary_key=True, index=True)
    id_patologia = Column(Integer, ForeignKey("patologias.id_patologia", ondelete="CASCADE"), nullable=False)
    screening     = Column(Boolean, default=False)
    adenomas      = Column(Boolean, default=False)

    patologia_rel = relationship("Patologia", back_populates="vcc_detalle")


# ----------------------------------
# FOTOS MACROSCÓPICAS DE PATOLOGÍA
# ----------------------------------
class FotosPatologia(Base):
    __tablename__ = "fotos_patologia"

    id            = Column(Integer, primary_key=True, index=True)
    id_patologia  = Column(Integer, ForeignKey("patologias.id_patologia", ondelete="CASCADE"), nullable=False)
    file_key      = Column(Text, nullable=False)
    file_url      = Column(Text, nullable=False)
    uploaded_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    patologia_rel = relationship("Patologia", back_populates="fotos")



# ----------------------------------
# PROFESIONALES
# ----------------------------------

class Cirujano(Base):
    __tablename__ = "cirujanos"
    id_cirujano = Column(Integer, primary_key=True, autoincrement=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    activo = Column(Boolean, default=True)


class Anestesiologo(Base):
    __tablename__ = "anestesiologos"
    id_anestesiologo = Column(Integer, primary_key=True, autoincrement=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    activo = Column(Boolean, default=True)

class Instrumentador(Base):
    __tablename__ = "instrumentadores"
    id_instrumentador = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String, unique=True, nullable=False)

# --- Catálogo: Tipos de anestesia ---

class TipoAnestesia(Base):
    __tablename__ = "tipos_anestesia"
    id_tipo_anestesia = Column(Integer, primary_key=True, index=True)
    nombre = Column(Text, nullable=False, unique=True)

class Procedimiento(Base):
    __tablename__ = "procedimientos"
    id_procedimiento = Column(Integer, primary_key=True, index=True)
    nombre_procedimiento = Column(String, unique=True, nullable=False)

class Tecnica(Base):
    __tablename__ = "tecnicas"
    id_tecnica = Column(Integer, primary_key=True, index=True)
    nombre_tecnica = Column(String, unique=True, nullable=False)

# --- Catálogo: Diagnósticos ---
class Diagnosticos(Base):
    __tablename__ = "diagnosticos"

    id_diagnostico = Column(Integer, primary_key=True, index=True)
    nombre_diagnostico = Column(Text, unique=True, nullable=False)
