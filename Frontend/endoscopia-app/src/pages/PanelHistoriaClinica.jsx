// ================================================
// PanelHistoriaClinica.jsx - Vista principal de la Historia Clínica
// ================================================

import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { HiOutlineDocumentSearch } from "react-icons/hi";
import { FiCopy } from "react-icons/fi";
import ModalListaEditable from "../components/ModalListaEditable";
import { API_BASE } from "../config.js";

// Componentes de módulos
import Antecedentes from "./Modulos/Antecedentes";
import Procedimientos from "./Modulos/Procedimientos";
import Interconsultas from "./Modulos/Interconsultas";
import Consultas from "./Modulos/Consultas";
import EstudiosComplementarios from "./Modulos/EstudiosComplementarios";
import Patologia from "./Modulos/Patologia";

// Otros componentes
import axios from "axios";
import ModalMensaje from "../components/ModalMensaje";

const url = (path) => `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

function PanelHistoriaClinica() {
    // ==============================
    // 1. Ubicación y navegación
    // ==============================
    const location = useLocation();
    const navigate = useNavigate();
    const paciente = location.state?.paciente;
    

    // ==============================
    // 2. Estados generales del paciente
    // ==============================
    const [datosPaciente, setDatosPaciente] = useState(null);

    // ==============================
    // 3. Estados por sección
    // ==============================
    const [interconsultas, setInterconsultas] = useState({});
    const [procedimientos, setProcedimientos] = useState([]);
    const [procedimientosRefreshKey, setProcedimientosRefreshKey] = useState(0);

    const [motivos, setMotivos] = useState([]);
    const [evoluciones, setEvoluciones] = useState({});
    const [expandedMotivo, setExpandedMotivo] = useState(null);
    const [listaMotivos, setListaMotivos] = useState([]);
    const [mostrarConsultas, setMostrarConsultas] = useState(false);
    const [antecedentesPaciente, setAntecedentesPaciente] = useState({});

    const [modalMensaje, setModalMensaje] = useState({
        mostrar: false,
        tipo: "",
        nombre: "",
        mensaje: "",
        telefono: "",
        email: "",
        onClose: null,
        onConfirm: null,
    });

    const [mostrarModalEntidad, setMostrarModalEntidad] = useState(false);
    const [tipoEntidad, setTipoEntidad] = useState("");
    const [tituloEntidad, setTituloEntidad] = useState("");
    
    const handleAbrirModal = (tipo, titulo) => {
    setTipoEntidad(tipo);
    setTituloEntidad(titulo);
    setMostrarModalEntidad(true);
    };  

    const [actualizarMotivos, setActualizarMotivos] = useState(false);
    
    
    // ==============================
    // 4. useEffect para obtener historia clínica
    // ==============================
    useEffect(() => {
        if (paciente?.id_paciente) {
            axios.get(url(`/pacientes/historia/${paciente.id_paciente}`))
                .then(response => {
                    setDatosPaciente(response.data);
                })
                .catch(error => {
                    console.error("Error al obtener datos del paciente:", error);
                });
        }
    }, [paciente]);

    // ==============================
    // useEffect para obtener motivos de consulta
    // ==============================
    useEffect(() => {
        const fetchMotivos = async () => {
            try {
                const response = await axios.get(url(`/bases/motivos_consulta/`));
                setListaMotivos(response.data);
            } catch (error) {
                console.error("Error al obtener motivos de consulta:", error);
            }
        };
        fetchMotivos();
    }, [actualizarMotivos]);

    // ==============================
    // 5. Función para calcular edad
    // ==============================
    // Calcula la edad a partir de la fecha de nacimiento
    function calcularEdad(fechaNacimiento) {
        if (!fechaNacimiento) return null;
        const hoy = new Date();
        const nacimiento = new Date(fechaNacimiento);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    }

    // ==============================
    // 6. Render JSX
    // ==============================
    const bumpProcedimientosRefresh = () => {
        setProcedimientosRefreshKey((prev) => prev + 1);
    };

    return (
        <div className="text-white px-3 py-4 space-y-5 text-[13px] max-w-4xl mx-auto">
            {/* Encabezado */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-[0_25px_60px_-20px_rgba(15,20,40,0.85)]">
                <div className="pointer-events-none absolute inset-0 opacity-40" style={{
                    background: "radial-gradient( circle at 30% 20%, rgba(41,142,255,0.18), transparent 45% ), radial-gradient( circle at 80% 10%, rgba(16,196,164,0.12), transparent 40% )"
                }} />

                <div className="relative px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-sky-500/20 text-2xl">
                                🩺
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 className="text-2xl font-semibold text-white">Historia Clínica</h2>
                                    <button
                                        onClick={() => {
                                            if (paciente?.id_paciente) {
                                                // Abrir el PDF en una nueva ventana
                                                window.open(url(`/pdf/resumen-hc/${paciente.id_paciente}`), '_blank');
                                            } else {
                                                setModalMensaje({
                                                    mostrar: true,
                                                    tipo: "error",
                                                    titulo: "Error",
                                                    mensaje: "No se pudo obtener el ID del paciente",
                                                    onClose: () => setModalMensaje((prev) => ({ ...prev, mostrar: false })),
                                                    onConfirm: null,
                                                });
                                            }
                                        }}
                                        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-3 py-1 text-white/80 text-[10px] uppercase tracking-[0.25em] transition hover:border-sky-400/50 hover:bg-white/12 hover:text-white"
                                    >
                                        <HiOutlineDocumentSearch size={12} className="opacity-75" />
                                        Resumen HC
                                    </button>
                                </div>
                                {datosPaciente?.nombre && (
                                    <p className="mt-1 text-base font-semibold text-emerald-300/90">
                                        {datosPaciente.nombre}
                                    </p>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => navigate("/")}
                            className="inline-flex items-center gap-2 self-start rounded-full border border-white/30 bg-white px-6 py-2.5 text-slate-900 text-sm font-semibold shadow-md shadow-black/20 transition hover:-translate-y-[1px] hover:bg-white/90"
                        >
                            Volver
                        </button>
                    </div>

                    {datosPaciente && (
                        <div className="mt-4 rounded-2xl border border-white/5 bg-white/5/15 px-4 py-4 backdrop-blur">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {[
                                    { label: "DNI", valor: datosPaciente.dni },
                                    { label: "Edad", valor: calcularEdad(datosPaciente.fecha_nacimiento) },
                                    { label: "Teléfono", valor: datosPaciente.telefono, copy: datosPaciente.telefono },
                                    { label: "Cobertura", valor: datosPaciente.nombre_cobertura },
                                    { label: "N° Beneficio", valor: datosPaciente.beneficio, copy: datosPaciente.beneficio },
                                ].map(({ label, valor, copy }) => (
                                    <div
                                        key={label}
                                        className={`group flex items-baseline gap-3 border-l border-white/10 pl-3 transition hover:border-emerald-300/50 ${
                                            copy ? "cursor-pointer" : ""
                                        }`}
                                        onClick={() => {
                                            if (copy) navigator.clipboard.writeText(copy);
                                        }}
                                        title={copy ? `Clic para copiar ${label.toLowerCase()}` : undefined}
                                    >
                                        <div className="min-w-[90px] text-[0.55rem] uppercase tracking-[0.3em] text-white/35">
                                            {label}
                                        </div>
                                        {label === "Email" ? (
                                            <div className="flex flex-1 items-center gap-2 text-sm font-semibold text-white/85">
                                                <span className="truncate">{valor || "—"}</span>
                                                {copy ? (
                                                    <FiCopy
                                                        size={12}
                                                        className="text-white/30 transition group-hover:text-emerald-300"
                                                    />
                                                ) : null}
                                            </div>
                                        ) : (
                                        <div className={`flex-1 text-sm font-semibold text-white/85 ${copy ? 'group-hover:text-emerald-300' : ''} truncate`}>
                                                {valor || "—"}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="group col-span-full flex items-baseline gap-3 border-l border-white/10 pl-3 transition hover:border-emerald-300/50 cursor-pointer"
                                    onClick={() => navigator.clipboard.writeText(datosPaciente.email || "")}
                                    title="Clic para copiar email">
                                    <div className="min-w-[90px] text-[0.55rem] uppercase tracking-[0.3em] text-white/35">
                                        Email
                                    </div>
                                    <div className="flex-1 text-sm font-semibold text-white/85 break-all transition group-hover:text-emerald-300">
                                        {datosPaciente.email || "—"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Secciones */}
            <div className="h-2"></div>

            {/* Antecedentes */}
            <div className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-3 py-2 mb-1 shadow-sm transition duration-150 ease-in-out text-xs">
                <Antecedentes 
                    setModalMensaje={setModalMensaje} 
                    sexoPaciente={datosPaciente?.sexo}
                    paciente={datosPaciente}
                    onAntecedentesChange={setAntecedentesPaciente}
                />
            </div>

            {/* Consultas */}
            <div className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-3 py-2 mb-1 shadow-sm transition duration-150 ease-in-out text-xs">
                <Consultas
                    paciente={paciente}
                    mostrarConsultas={mostrarConsultas}
                    actualizarMotivos={actualizarMotivos}
                    setActualizarMotivos={setActualizarMotivos}
                    setMostrarConsultas={setMostrarConsultas}
                    motivos={motivos}
                    setMotivos={setMotivos}
                    evoluciones={evoluciones}
                    setEvoluciones={setEvoluciones}
                    expandedMotivo={expandedMotivo}
                    setExpandedMotivo={setExpandedMotivo}
                    listaMotivos={listaMotivos}
                    setModalMensaje={setModalMensaje}
                    handleAbrirModal={handleAbrirModal}
                    pacienteAntecedentes={antecedentesPaciente}
                    
                />
            </div>

            {/* Estudios Complementarios */}
            <div className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-3 py-2 mb-1 shadow-sm transition duration-150 ease-in-out text-xs">
                <EstudiosComplementarios idPaciente={paciente?.id_paciente} />
            </div>

            {/* Procedimientos */}
            <div className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-3 py-2 mb-1 shadow-sm transition duration-150 ease-in-out text-xs">
                <Procedimientos
                    procedimientos={procedimientos}
                    paciente={datosPaciente ? { ...datosPaciente, cobertura_nombre: datosPaciente?.nombre_cobertura } : null}
                    refreshKey={procedimientosRefreshKey}
                />
            </div>

            {/* Interconsultas */}
            <div className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-3 py-2 mb-1 shadow-sm transition duration-150 ease-in-out text-xs">
                <Interconsultas paciente={paciente} />
            </div>

            {/* Patología */}
            <div className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-3 py-2 mb-1 shadow-sm transition duration-150 ease-in-out text-xs">
                <Patologia
                    paciente={paciente}
                    onProcedimientosUpdate={bumpProcedimientosRefresh}
                />
            </div>

            {mostrarModalEntidad && tipoEntidad === "motivos_consulta" && (
                        <ModalListaEditable
                            titulo="Motivos de Consulta"
                            endpoint="bases/motivos_consulta"
                            campoNombre="motivo_consulta"
                            idCampo="id_motivo"
                            onClose={() => {
                                    setMostrarModalEntidad(false);
                                    setActualizarMotivos(prev => !prev);
                            }}
                        />
                    )}

                    {mostrarModalEntidad && tipoEntidad === "laboratorio" && (
                        <ModalListaEditable
                            titulo="Laboratorio"
                            endpoint="bases/laboratorio"
                            campoNombre="laboratorio"
                            idCampo="id"
                            onClose={() => setMostrarModalEntidad(false)}
                        />
                    )}

                    {mostrarModalEntidad && tipoEntidad === "imagenes" && (
                        <ModalListaEditable
                            titulo="Imágenes"
                            endpoint="bases/imagenes"
                            campoNombre="imagen"
                            idCampo="id"
                            onClose={() => setMostrarModalEntidad(false)}
                        />
                    )}

                    {mostrarModalEntidad && tipoEntidad === "especialidad" && (
                        <ModalListaEditable
                            titulo="Especialidades"
                            endpoint="bases/especialidad"
                            campoNombre="especialidad"
                            idCampo="id"
                            onClose={() => setMostrarModalEntidad(false)}
                        />
                    )}
            
                    {/* Modal de mensajes */}
                    {modalMensaje.mostrar && (
                        <ModalMensaje
                            tipo={modalMensaje.tipo}
                            nombre={modalMensaje.nombre}
                            mensaje={modalMensaje.mensaje}
                            telefono={modalMensaje.telefono}
                            email={modalMensaje.email}
                            onClose={modalMensaje.onClose}
                            onConfirm={modalMensaje.onConfirm}
                        />
                    )}
        </div>
        
    );
}

export default PanelHistoriaClinica;
