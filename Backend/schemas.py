from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date, datetime, time
from uuid import UUID


# ----------------------------------
# PACIENTES
# ----------------------------------

class PacienteBase(BaseModel):
    nombre: str
    dni: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    sexo: Optional[int] = None
    cobertura: Optional[int] = None
    beneficio: Optional[str] = None
    nacionalidad: Optional[int] = None
    localidad: Optional[int] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    anexo: Optional[str] = None

class PacienteCreate(BaseModel):
    nombre: str
    dni: str | None = None
    fecha_nacimiento: date | None = None
    sexo: int | None = None
    cobertura: int | None = None
    beneficio: str | None = None
    nacionalidad: int | None = None
    localidad: int | None = None
    telefono: str | None = None
    email: str | None = None
    anexo: str | None = None

class PacienteSchema(PacienteBase):
    id_paciente: int
    activo: bool = True
    class Config:
        from_attributes = True


class PacienteConCobertura(PacienteBase):
    id_paciente: int
    activo: bool = True
    nombre_cobertura: Optional[str] = None
    nombre_nacionalidad: Optional[str] = None
    nombre_localidad: Optional[str] = None

    class Config:
        from_attributes = True


class PacientePaginatedResponse(BaseModel):
    items: list[PacienteConCobertura]
    total: int
    page: int
    page_size: int

    class Config:
        from_attributes = True

# ----------------------------------
# COBERTURAS
# ----------------------------------

class CoberturaSchema(BaseModel):
    id_cobertura: int
    nombre_cobertura: str

    class Config:
        from_attributes = True  

class CoberturaCreateSchema(BaseModel):
    nombre_cobertura: str

# ----------------------------------
# NACIONALIDADES
# ----------------------------------

class NacionalidadSchema(BaseModel):
    id_nacionalidad: int
    nombre_nacionalidad: str

    class Config:
        from_attributes = True

class NacionalidadCreateSchema(BaseModel):
    nombre_nacionalidad: str

# ----------------------------------
# LOCALIDADES
# ----------------------------------

class LocalidadSchema(BaseModel):

    id_localidad: int
    nombre_localidad: str

    class Config:
        from_attributes = True

class LocalidadCreateSchema(BaseModel):
    nombre_localidad: str

# ----------------------------------
# SEXO
# ----------------------------------

class SexoSchema(BaseModel):
    id_sexo: int
    sexo: str

    class Config:
        from_attributes = True  # ✅ Así se llama en Pydantic v2

# ----------------------------------
# DERIVADORES
# ----------------------------------

class DerivadorSchema(BaseModel):
    id_derivador: int
    nombre_derivador: str

    class Config:
        from_attributes = True

class DerivadorCreateSchema(BaseModel):
    nombre_derivador: str

# ----------------------------------
# TURNOS
# ----------------------------------

class TurnoCreateSchema(BaseModel):
    nombre: str
    fecha: date
    motivo: Optional[str] = None
    derivador: Optional[int] = None

class TurnoSchema(TurnoCreateSchema):
    id_turno: int
    nombre_derivador: Optional[str] = None
    class Config:
        from_attributes = True

# --------------------------------------------------------------------------
# Tablas base: Motivos Motivos consulta, laboratorio, imagenes, especialidad 
# --------------------------------------------------------------------------

## Laboratorio:
class LaboratorioBase(BaseModel):
    laboratorio: str

class LaboratorioCreate(LaboratorioBase):
    pass

class LaboratorioOut(LaboratorioBase):
    id: int
    class Config:
        from_attributes = True

## IMagenes:
class ImagenBase(BaseModel):
    imagen: str

class ImagenCreate(ImagenBase):
    pass

class ImagenOut(ImagenBase):
    id: int
    class Config:
        from_attributes = True

##. EspecialidaD:
class EspecialidadBase(BaseModel):
    especialidad: str

class EspecialidadCreate(EspecialidadBase):
    pass

class EspecialidadOut(EspecialidadBase):
    id: int
    class Config:
        from_attributes = True

## MotivoConsulta:
class MotivoConsultaBase(BaseModel):
    motivo_consulta: str

class MotivoConsultaCreate(MotivoConsultaBase):
    pass


class MotivoConsultaOut(MotivoConsultaBase):
    id_motivo: int

    class Config:
        from_attributes = True

# ----------------------------------
# DIAGNOSTICOS (catálogo)
# ----------------------------------
class DiagnosticoBase(BaseModel):
    nombre_diagnostico: str

class DiagnosticoCreate(DiagnosticoBase):
    pass

class DiagnosticoOut(DiagnosticoBase):
    id_diagnostico: int
    class Config:
        from_attributes = True

## Otros estudios:
class OtroEstudioBase(BaseModel):
    estudio: str

class OtroEstudioCreate(OtroEstudioBase):
    pass

class OtroEstudioUpdate(OtroEstudioBase):
    pass

class OtroEstudio(OtroEstudioBase):
    id: int

    class Config:
        from_attributes = True

# Antecedentes:
class AntecedenteBase(BaseModel):
    id_paciente: int
    medicos: Optional[str] = None
    quirurgicos: Optional[str] = None
    alergicos: Optional[str] = None
    toxicos: Optional[str] = None
    familiares: Optional[str] = None
    ginecoobstetricos: Optional[str] = None

class AntecedenteCreate(AntecedenteBase):
    pass

class AntecedenteOut(BaseModel):
    id: int
    id_paciente: int
    medicos: Optional[str] = None
    quirurgicos: Optional[str] = None
    alergicos: Optional[str] = None
    toxicos: Optional[str] = None
    familiares: Optional[str] = None
    ginecoobstetricos: Optional[str] = None

    class Config:
        from_attributes = True

# Consultas y evoluciones:
###### CONSULTAS
class ConsultaBase(BaseModel):
    id_paciente: int
    motivo: int
    fecha_consulta: date

    class Config:
        from_attributes = True  # <- si usás Pydantic v2

class ConsultaCreate(ConsultaBase):
    pass

class ConsultaOut(ConsultaBase):
    id_consulta: int
    class Config:
        from_attributes = True

class ConsultaUpdate(BaseModel):
    descripcion: Optional[str] = None
    fecha: Optional[date] = None

###### EVOLUCIONES
class EvolucionBase(BaseModel):
    id_consulta: int
    fecha_evolucion: date
    contenido: str

class EvolucionCreate(EvolucionBase):
    pass

class EvolucionOut(EvolucionBase):
    id_evolucion: int
    class Config:
        from_attributes = True

class EvolucionUpdate(BaseModel):
    fecha_evolucion: Optional[date] = None

class EvolucionDelete(BaseModel):
    id_evolucion: int


#### Interconsultas:
# === Schemas para Interconsultas ===
class InterconsultasBase(BaseModel):
    id_paciente: int
    fecha: date
    especialidad: int
    descripcion: str
    nombre_archivo: Optional[str] = None
    ruta_archivo: Optional[str] = None

# Este es el schema que el router espera
class InterconsultaCreate(InterconsultasBase):
    pass

# Alias para compatibilidad si lo referías con el nombre plural
InterconsultasCreate = InterconsultaCreate

class InterconsultaOut(BaseModel):
    id_interconsulta: int
    fecha: date
    descripcion: str
    nombre_archivo: Optional[str]
    ruta_archivo: Optional[str]
    especialidad_rel: EspecialidadOut

    class Config:
        from_attributes = True

# Alias para compatibilidad con routers
InterconsultasOut = InterconsultaOut


# EXAMENES COMPLEMENTARIOS:
# -------------------------
# Schemas: Laboratorios
# -------------------------
class LaboratorioPacienteBase(BaseModel):
    id_paciente: int
    fecha: date
    id_laboratorio: int
    descripcion: Optional[str] = None
    ruta_archivo: Optional[str] = None
    nombre_archivo: Optional[str] = None

class LaboratorioPacienteCreate(LaboratorioPacienteBase):
    pass

class LaboratorioPacienteUpdate(BaseModel):
    fecha: Optional[date] = None
    id_laboratorio: Optional[int] = None
    descripcion: Optional[str] = None
    ruta_archivo: Optional[str] = None
    nombre_archivo: Optional[str] = None

class LaboratorioPacienteOut(LaboratorioPacienteBase):
    id: int
    class Config:
        from_attributes = True

# -------------------------
# Schemas: Imágenes
# -------------------------
class ImagenPacienteBase(BaseModel):
    id_paciente: int
    fecha: date
    id_imagen: int
    descripcion: Optional[str] = None
    ruta_archivo: Optional[str] = None
    nombre_archivo: Optional[str] = None

class ImagenPacienteCreate(ImagenPacienteBase):
    pass

class ImagenPacienteUpdate(BaseModel):
    fecha: Optional[date] = None
    id_imagen: Optional[int] = None
    descripcion: Optional[str] = None
    ruta_archivo: Optional[str] = None
    nombre_archivo: Optional[str] = None

class ImagenPacienteOut(ImagenPacienteBase):
    id: int
    class Config:
        from_attributes = True

# -------------------------
# Schemas: Otros estudios
# -------------------------
class OtroEstudioPacienteBase(BaseModel):
    id_paciente: int
    fecha: date
    id_otro: int
    descripcion: Optional[str] = None
    ruta_archivo: Optional[str] = None
    nombre_archivo: Optional[str] = None

class OtroEstudioPacienteCreate(OtroEstudioPacienteBase):
    pass

class OtroEstudioPacienteUpdate(BaseModel):
    fecha: Optional[date] = None
    id_otro: Optional[int] = None
    descripcion: Optional[str] = None
    ruta_archivo: Optional[str] = None
    nombre_archivo: Optional[str] = None


class OtroEstudioPacienteOut(OtroEstudioPacienteBase):
    id: int
    class Config:
        from_attributes = True


# ----------------------------------
# PATOLOGÍA
# ----------------------------------

class PatologiaBase(BaseModel):
    id_paciente: int
    id_procedimiento: int
    fecha: date
    informe_texto: Optional[str] = None
    informe_pdf_url: Optional[str] = None
    id_procedimiento_paciente: Optional[int] = None
    fecha_procedimiento: Optional[date] = None
    tipo_registro: Optional[str] = None

class PatologiaCreate(PatologiaBase):
    pass

class PatologiaOut(PatologiaBase):
    id_patologia: int
    procedimiento_nombre: Optional[str] = None
    procedimiento_tecnica: Optional[str] = None

    class Config:
        from_attributes = True


# ----------------------------------
# PROCEDIMIENTOS BASE
# ----------------------------------

class ProcedimientoBaseCreate(BaseModel):
    procedimiento: str

class ProcedimientoBaseOut(BaseModel):
    id_procedimiento: int
    procedimiento: str

    class Config:
        from_attributes = True
class ProcedimientoBaseUpdate(BaseModel):
    procedimiento: Optional[str] = None

# ----------------------------------
# INSTITUCIONES BASE
# ----------------------------------

class InstitucionBaseCreate(BaseModel):
    institucion: str

class InstitucionBaseOut(BaseModel):
    id_institucion: int
    institucion: str

    class Config:
        from_attributes = True

class InstitucionBaseUpdate(BaseModel):
    institucion: Optional[str] = None
    
# ----------------------------------
# FOTOS  y archivos DE PATOLOGÍA
# ----------------------------------

class FotosPatologiaBase(BaseModel):
    id_patologia: int
    file_key: str
    file_url: str

class FotosPatologiaCreate(FotosPatologiaBase):
    pass

class FotosPatologiaOut(BaseModel):
    id: int
    id_patologia: int
    file_key: str
    file_url: str

    class Config:
        from_attributes = True

class PatologiaOutConArchivos(PatologiaOut):
    fotos: list[FotosPatologiaOut] = Field(default_factory=list)

# ----------------------------------
# DETALLE VCC
# ----------------------------------

class VccDetalleBase(BaseModel):
    id_patologia: int
    screening: bool
    adenomas: bool

class VccDetalleCreate(VccDetalleBase):
    pass

class VccDetalleOut(VccDetalleBase):
    id: int

    class Config:
        from_attributes = True


# ----------------------------------
# PROCEDIMIENTOS PACIENTES
# ----------------------------------

# Lo que recibo al crear un procedimiento de paciente
class ProcedimientoPacienteCreate(BaseModel):
    id_paciente: int
    id_procedimiento_base: int
    fecha: date
    id_institucion: int
    patologia: bool = False
    cultivo: bool = False

class ProcedimientoPacienteOut(BaseModel):
    id_procedimiento_paciente: int
    id_paciente: int
    fecha: date
    patologia: bool
    cultivo: bool
    institucion_rel: InstitucionBaseOut
    procedimiento_rel: ProcedimientoBaseOut

    class Config:
        from_attributes = True

class ProcedimientoPacienteUpdate(BaseModel):
    id_paciente: Optional[int] = None
    id_procedimiento_base: Optional[int] = None
    fecha: Optional[date] = None
    id_institucion: Optional[int] = None
    patologia: Optional[bool] = None
    cultivo: Optional[bool] = None
    

class ProcedimientoPacienteConBase(BaseModel):
    id_procedimiento_paciente: int
    id_paciente: int
    fecha: date
    patologia: bool
    cultivo: bool
    procedimiento_rel: ProcedimientoBaseOut  # este sí está bien definido

    class Config:
        from_attributes = True


# ----------------------------------
# PROFESIONALES
# ----------------------------------
# CIRUJANOS
class CirujanoBase(BaseModel):
    nombre: str

class CirujanoCreate(CirujanoBase):
    pass

class CirujanoOut(CirujanoBase):
    id: UUID
    activo: bool

    class Config:
        orm_mode = True


# ANESTESIOLOGOS
class AnestesiologoBase(BaseModel):
    nombre: str

class AnestesiologoCreate(AnestesiologoBase):
    pass

class AnestesiologoOut(AnestesiologoBase):
    id: UUID
    activo: bool

    class Config:
        orm_mode = True


# INSTRUMENTADORES
class InstrumentadorBase(BaseModel):
    nombre: str

class InstrumentadorCreate(InstrumentadorBase):
    pass

class InstrumentadorOut(InstrumentadorBase):
    id_instrumentador: int

    class Config:
        orm_mode = True

# ----------------------------------
# PROFESIONALES (CRUD simple para catálogos)
# ----------------------------------
class CirujanoCreateSimple(BaseModel):
    nombre: str

class CirujanoUpdateSimple(BaseModel):
    nombre: Optional[str] = None

class CirujanoOutSimple(BaseModel):
    id: int
    nombre: str
    class Config:
        from_attributes = True

class AnestesiologoCreateSimple(BaseModel):
    nombre: str

class AnestesiologoUpdateSimple(BaseModel):
    nombre: Optional[str] = None

class AnestesiologoOutSimple(BaseModel):
    id: int
    nombre: str
    class Config:
        from_attributes = True



class TipoAnestesiaIn(BaseModel):
    nombre: str

class TipoAnestesiaOut(BaseModel):
    id_tipo_anestesia: int
    nombre: str
    model_config = ConfigDict(from_attributes=True)

# ----------------------------------
# PROTOCOLOS CX (Schemas)
# ----------------------------------
from typing import List, Optional, Literal

class CodigoCxIn(BaseModel):
    codigo: str = Field(..., min_length=1)
    porcentaje: Optional[int] = Field(default=None, ge=0, le=100)

class DetalleCxIn(BaseModel):
    fecha: str
    hora_inicio: str
    hora_fin: str
    dx_pre: str
    dx_post: str
    # Normalizados (IDs)
    id_procedimiento_base: Optional[int] = None
    id_tecnica_tipo: Optional[int] = None
    tecnica_detalle: Optional[str] = None
    # Equipo
    cirujano: str
    ayudante1: Optional[str] = None
    ayudante2: Optional[str] = None
    ayudante3: Optional[str] = None
    anestesiologo: str
    id_tipo_anestesia: Optional[int] = None
    # HZB opcionales
    id_instrumentador: Optional[int] = None
    id_circulante: Optional[int] = None

class ProtocoloCxIn(BaseModel):
    centro: Literal["HZB", "INTECNUS"]
    detalle: DetalleCxIn
    codigos_facturacion: Optional[List[CodigoCxIn]] = None

class CodigoCxOut(BaseModel):
    id_codigo_cx: int
    codigo: str
    porcentaje: Optional[int] = None

class DetalleCxOut(BaseModel):
    id_detalle: int
    id_procedimiento_paciente: int
    fecha: str
    hora_inicio: str
    hora_fin: str
    dx_pre: str
    dx_post: str
    id_procedimiento_base: Optional[int] = None
    id_tecnica_tipo: Optional[int] = None
    tecnica_detalle: Optional[str] = None
    cirujano: str
    ayudante1: Optional[str] = None
    ayudante2: Optional[str] = None
    ayudante3: Optional[str] = None
    anestesiologo: str
    id_tipo_anestesia: Optional[int] = None
    id_instrumentador: Optional[int] = None
    id_circulante: Optional[int] = None
    class Config:
        from_attributes = True

class ProtocoloCxOut(BaseModel):
    centro: Literal["HZB", "INTECNUS"]
    detalle: DetalleCxOut
    codigos_facturacion: List[CodigoCxOut] = []

# Catálogos para selects en protocolos_cx
class TecnicaTipoOut(BaseModel):
    id_tecnica_tipo: int
    nombre: str
    class Config:
        from_attributes = True

class PlantillaCxOut(BaseModel):
    id: int
    tecnica: str
    desarrollo: str
    class Config:
        from_attributes = True

# Listados simples (evitar colisión con CirujanoOut/InstrumentadorOut existentes)
class CirujanoListOutCx(BaseModel):
    id_cirujano: int
    nombre: str
    class Config:
        from_attributes = True

class InstrumentadorListOutCx(BaseModel):
    id_instrumentador: int
    nombre: str
    class Config:
        from_attributes = True

# ----------------------------------
# PARTES QUIRÚRGICOS
# ----------------------------------
class ParteCreate(BaseModel):
    # Encabezado (procedimientos_pacientes)
    id_paciente: int
    id_procedimiento_base: int
    fecha: date
    id_institucion: int
    tipo_cirugia: int = 1  # 1=Programada, 2=Urgencia
    patologia: bool = False
    cultivo: bool = False

    # Detalle temporal (se envían como 'HH:MM', se combinan con fecha en el router)
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    duracion_min: Optional[int] = None  # opcional: puede calcularse en el backend

    # Diagnóstico preoperatorio
    id_diagnostico_pre: Optional[int] = None
    anexo_diagnostico: Optional[str] = None

    # Procedimiento (si no viene, se usa id_procedimiento_base)
    id_procedimiento: Optional[int] = None
    anexo_procedimiento: Optional[str] = None
    tecnica_detalle: Optional[str] = None

    # Equipo
    id_cirujano: Optional[UUID] = None
    id_anestesiologo: Optional[UUID] = None
    id_instrumentador: Optional[int] = None
    id_tipo_anestesia: Optional[int] = None

    # Ayudantes
    id_ayudante_1: Optional[int] = None
    id_ayudante_2: Optional[int] = None
    id_ayudante_3: Optional[int] = None


class ParteUpdate(BaseModel):
    # Encabezado
    id_paciente: Optional[int] = None
    id_procedimiento_base: Optional[int] = None
    fecha: Optional[date] = None
    id_institucion: Optional[int] = None
    tipo_cirugia: Optional[int] = None
    patologia: Optional[bool] = None
    cultivo: Optional[bool] = None

    # Detalle temporal
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    duracion_min: Optional[int] = None

    # Diagnóstico preoperatorio
    id_diagnostico_pre: Optional[int] = None
    anexo_diagnostico: Optional[str] = None

    # Procedimiento
    id_procedimiento: Optional[int] = None
    anexo_procedimiento: Optional[str] = None
    tecnica_detalle: Optional[str] = None

    # Equipo
    id_cirujano: Optional[UUID] = None
    id_anestesiologo: Optional[UUID] = None
    id_instrumentador: Optional[int] = None
    id_tipo_anestesia: Optional[int] = None

    # Ayudantes
    id_ayudante_1: Optional[int] = None
    id_ayudante_2: Optional[int] = None
    id_ayudante_3: Optional[int] = None
