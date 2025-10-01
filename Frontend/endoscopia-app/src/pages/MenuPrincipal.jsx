// ================================================
//  MenuPrincipal.jsx - Vista principal de la app
//  Página principal de gestión de pacientes, entidades y navegación.
// ================================================
// Importación de React y hooks
import React, { useState, useEffect, useMemo, useRef } from "react";
// Cliente HTTP para conectar con el backend
import { api } from "@/lib/api";
import { API_BASE } from "@/config";
// Importaciones internas:
import ModalMensaje from "@/components/ModalMensaje";
import ModalListaEditable from "@/components/ModalListaEditable";
import ModalNuevoPaciente from "@/components/ModalNuevoPaciente";
import LogoutButton from "@/components/LogoutButton";
import { useNavigate } from "react-router-dom";
import { Slice, Stethoscope } from "lucide-react";

// Helper to build full API URLs from API_BASE
const url = (path) => `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

const ENTIDADES_CONFIG = {
    coberturas: {
        titulo: "Coberturas",
        endpoint: "coberturas",
        campoNombre: "nombre_cobertura",
        idCampo: "id_cobertura",
    },
    localidades: {
        titulo: "Localidades",
        endpoint: "localidades",
        campoNombre: "nombre_localidad",
        idCampo: "id_localidad",
    },
    nacionalidades: {
        titulo: "Nacionalidades",
        endpoint: "nacionalidades",
        campoNombre: "nombre_nacionalidad",
        idCampo: "id_nacionalidad",
    },
};

export default function MenuPrincipal() {
    // Hook de navegación para cambiar de ruta con react-router-dom
    const navigate = useNavigate();

    // ==============================
    //        1. ESTADOS (useState)
    // ==============================
    // --- Modales ---
    const [mostrarModalEntidad, setMostrarModalEntidad] = useState(false); // Modal de entidades auxiliares (cobertura, localidad, nacionalidad)
    const [tipoEntidad, setTipoEntidad] = useState(""); // Tipo de entidad a editar
    const [tituloEntidad, setTituloEntidad] = useState(""); // Título del modal de entidad
    const [modalInfo, setModalInfo] = useState(null); // Modal de mensajes generales (error, éxito, confirmación)

    // --- Pacientes ---
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [pacientes, setPacientes] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalPacientes, setTotalPacientes] = useState(0);
    const [loadingPacientes, setLoadingPacientes] = useState(false);
    const [errorPacientes, setErrorPacientes] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [openModalNuevoPaciente, setOpenModalNuevoPaciente] = useState(false); // Modal “Nuevo Paciente”
    const requestController = useRef(null);
    const debounceRef = useRef(null);

    // --- Mensajes y contacto ---
    const [mostrarContacto, setMostrarContacto] = useState(false); // Mostrar modal de contacto
    const [pacienteContacto, setPacienteContacto] = useState(null); // Paciente cuyo contacto se muestra

    const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

    // ==============================
    //        2. useEffect
    // ==============================
    // Debounce de búsqueda para evitar llamadas innecesarias
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const delay = searchTerm.length > 2 ? 220 : 320;

        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, delay);
        debounceRef.current = handler;
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Carga de pacientes paginados
    useEffect(() => {
        let activo = true;
        const requestedPage = page;
        const requestedPageSize = pageSize;

        if (requestController.current) {
            requestController.current.abort();
        }

        const controller = new AbortController();
        requestController.current = controller;

        setLoadingPacientes(true);
        setErrorPacientes(null);

        const params = { page: requestedPage, page_size: requestedPageSize };
        if (debouncedSearch) params.search = debouncedSearch;

        api.get("/pacientes/", { params, signal: controller.signal })
            .then(({ data }) => {
                if (!activo) return;

                const items = Array.isArray(data?.items) ? data.items : [];
                const totalCount = data?.total ?? items.length;
                setTotalPacientes(totalCount);

                const lastPage = requestedPageSize > 0 ? Math.max(1, Math.ceil(totalCount / requestedPageSize)) : 1;

                if (totalCount === 0) {
                    setPacientes([]);
                    if (requestedPage !== 1) {
                        setPage(1);
                    }
                    return;
                }

                if (requestedPage > lastPage) {
                    setPage(lastPage);
                    return;
                }

                setPacientes(items);
            })
            .catch((error) => {
                if (!activo) return;
                if (api.isCancel?.(error) || error?.code === "ERR_CANCELED") {
                    return;
                }
                if (!activo) return;
                setPacientes([]);
                setTotalPacientes(0);
                const mensaje = error?.response?.data?.detail || "No se pudieron cargar los pacientes.";
                setErrorPacientes(mensaje);
                setModalInfo({
                    tipo: "error",
                    titulo: "❌ Error",
                    mensaje,
                    onCerrar: () => setModalInfo(null),
                });
            })
            .finally(() => {
                if (requestController.current === controller) {
                    requestController.current = null;
                }
                if (activo) {
                    setLoadingPacientes(false);
                }
            });

        return () => {
            activo = false;
            controller.abort();
        };
    }, [page, pageSize, debouncedSearch, reloadToken]);

    const handleSearchKeyDown = (event) => {
        if (event.key === "Enter") {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            const trimmed = searchTerm.trim();
            setDebouncedSearch(trimmed);
            setPage(1);
        }
    };

    // ==============================
    // 3. FUNCIONES INTERNAS
    // ==============================

    // Abre el modal para editar una entidad auxiliar (cobertura, localidad, nacionalidad)
    const handleAbrirModal = (tipo) => {
        if (!ENTIDADES_CONFIG[tipo]) return;
        setTipoEntidad(tipo);
        setTituloEntidad(ENTIDADES_CONFIG[tipo].titulo);
        setMostrarModalEntidad(true);
    };

    // Cierra el modal de información
    function cerrarModalInfo() {
        setModalInfo(null);
    }

    const pacientesProcesados = useMemo(() => {
        const lista = Array.isArray(pacientes) ? pacientes : [];
        return lista
            .map((paciente) => {
                const fecha = paciente?.fecha_nacimiento;
                let edad = "N/D";
                if (fecha) {
                    const nacimiento = new Date(fecha);
                    if (!Number.isNaN(nacimiento.getTime())) {
                        const hoy = new Date();
                        let anios = hoy.getFullYear() - nacimiento.getFullYear();
                        const mes = hoy.getMonth() - nacimiento.getMonth();
                        if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
                            anios -= 1;
                        }
                        edad = anios;
                    }
                }
                return { ...paciente, edadCalculada: edad };
            })
            .sort((a, b) => (a?.nombre || "").localeCompare(b?.nombre || "", "es", { sensitivity: "base" }));
    }, [pacientes]);

    const totalPages = Math.max(1, Math.ceil(totalPacientes / pageSize) || 1);
    const safePage = Math.min(page, totalPages);
    const showingFrom = totalPacientes === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const showingTo = totalPacientes === 0 ? 0 : Math.min(totalPacientes, safePage * pageSize);
    const hasResultados = pacientesProcesados.length > 0;
    const mostrarSkeleton = loadingPacientes && !hasResultados;
    const entidadSeleccionada = tipoEntidad ? ENTIDADES_CONFIG[tipoEntidad] : null;

    const handlePrevPage = () => {
        setPage((prev) => Math.max(1, prev - 1));
    };

    const handleNextPage = () => {
        setPage((prev) => (prev < totalPages ? prev + 1 : prev));
    };

    const handlePageSizeChange = (event) => {
        const newSize = Number(event.target.value);
        if (!Number.isNaN(newSize)) {
            setPageSize(newSize);
            setPage(1);
        }
    };

    const refreshPacientes = () => {
        setReloadToken((token) => token + 1);
    };

    // ==============================
    //     4. BLOQUE JSX DE RETORNO
    // ==============================
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#050b16] text-white">
            <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col px-4 pb-16 pt-12 sm:px-6 lg:px-16">
            {/* --- Header con título y logout --- */}
            <div className="flex justify-between items-center mb-8">
                {/* --- Título principal de la app --- */}
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-4">
                    <Slice className="w-6 h-6 text-red-400 hover:text-red-500 hover:animate-pulse transition" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Historia Clínica</h1>
                        <p className="mt-1 text-sm uppercase tracking-[0.35em] text-white/50">
                            Gestión integral de pacientes
                        </p>
                    </div>
                    <Stethoscope className="w-6 h-6 text-green-400 hover:text-green-500 hover:animate-pulse transition" />
                </div>
                
                {/* --- Botón de logout --- */}
                <LogoutButton />
            </div>

            {/* --- Botonera principal de navegación --- */}
            <div className="mt-10">
                <div className="flex flex-wrap justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <button
                        onClick={() => navigate("/pendientes")}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-400/70 bg-black/40 px-5 py-2 text-sm font-semibold tracking-wide text-blue-200 transition hover:border-blue-300 hover:bg-blue-500/10 hover:text-white"
                    >
                        PENDIENTES
                    </button>

                    <button
                        onClick={() => navigate("/pacientes")}
                        className="inline-flex items-center gap-2 rounded-full border border-green-400/70 bg-black/40 px-5 py-2 text-sm font-semibold tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-500/10 hover:text-white"
                    >
                        PACIENTES
                    </button>
                    <button
                        onClick={() => navigate("/estadistica")}
                        className="inline-flex items-center gap-2 rounded-full border border-yellow-400/70 bg-black/40 px-5 py-2 text-sm font-semibold tracking-wide text-amber-200 transition hover:border-amber-300 hover:bg-amber-500/10 hover:text-white"
                    >
                        ESTADÍSTICAS
                    </button>
                    <button
                        onClick={() => navigate("/turnos")}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-400/70 bg-black/40 px-5 py-2 text-sm font-semibold tracking-wide text-blue-200 transition hover:border-blue-300 hover:bg-blue-500/10 hover:text-white"
                    >
                        TURNOS
                    </button>

                       <button
                        onClick={() => navigate("/cirugia")}
                        className="inline-flex items-center gap-2 rounded-full border border-red-400/70 bg-black/40 px-5 py-2 text-sm font-semibold tracking-wide text-red-200 transition hover:border-red-300 hover:bg-red-500/10 hover:text-white"
                    >
                        FACTURACIÓN
                    </button>
                </div>
            </div>

            {/* --- Resumen y acciones --- */}
            {/* --- Buscador y botón para abrir modal de nuevo paciente --- */}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/50 bg-black/30 text-xs text-emerald-200">
                        🔍
                    </span>
                    <div className="flex-1">
                        <label className="text-xs uppercase tracking-[0.3em] text-white/50">Buscar</label>
                        <input
                            type="text"
                            placeholder="Nombre, apellido o DNI"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="mt-1 w-full bg-transparent text-sm font-semibold tracking-wide text-white placeholder:text-white/40 focus:outline-none"
                        />
                    </div>
                </div>
                <button
                    onClick={() => setOpenModalNuevoPaciente(true)}
                    className="inline-flex h-[48px] items-center justify-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-400/20 hover:text-white"
                >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/20 text-xs">+</span>
                    Nuevo Paciente
                </button>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-300">
                <button
                    onClick={() => handleAbrirModal("coberturas")}
                    className="rounded-full border border-sky-500/60 px-4 py-1.5 transition hover:border-sky-400 hover:bg-sky-400/20"
                >
                    Gestionar coberturas
                </button>
                <button
                    onClick={() => handleAbrirModal("localidades")}
                    className="rounded-full border border-sky-500/60 px-4 py-1.5 transition hover:border-sky-400 hover:bg-sky-400/20"
                >
                    Gestionar localidades
                </button>
                <button
                    onClick={() => handleAbrirModal("nacionalidades")}
                    className="rounded-full border border-sky-500/60 px-4 py-1.5 transition hover:border-sky-400 hover:bg-sky-400/20"
                >
                    Gestionar nacionalidades
                </button>
            </div>

            {/* --- Tabla de pacientes --- */}
            <div className="mt-8 w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-black/20 backdrop-blur">
                <div className="max-h-[65vh] overflow-auto">
                    <table className="w-full min-w-[68rem] divide-y divide-white/10 text-sm">
                        <thead className="bg-white/5 text-[0.7rem] uppercase tracking-[0.35em] text-white/60">
                            <tr>
                                <th className="w-14 px-3 py-3 text-center font-semibold">Historia</th>
                                <th className="w-52 px-4 py-3 text-center font-semibold">Nombre</th>
                                <th className="w-30 px-4 py-3 text-center font-semibold">DNI</th>
                                <th className="w-18 px-3 py-3 text-center font-semibold">Edad</th>
                                <th className="w-36 px-4 py-3 text-center font-semibold">Cobertura</th>
                                <th className="w-40 px-4 py-3 text-center font-semibold">Número</th>
                                <th className="w-20 px-4 py-3 text-center font-semibold">Contacto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {mostrarSkeleton ? (
                                Array.from({ length: 6 }).map((_, idx) => (
                                    <tr key={`skeleton-${idx}`} className="bg-white/5">
                                        <td className="px-6 py-5 text-center">
                                            <div className="mx-auto h-6 w-6 rounded-full bg-slate-700/40" />
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="h-4 w-40 rounded bg-slate-700/40" />
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="mx-auto h-4 w-24 rounded bg-slate-700/40" />
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="mx-auto h-4 w-10 rounded bg-slate-700/40" />
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="h-4 w-32 rounded bg-slate-700/40" />
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="h-4 w-28 rounded bg-slate-700/40" />
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="mx-auto h-6 w-20 rounded-full bg-slate-700/40" />
                                        </td>
                                    </tr>
                                ))
                            ) : errorPacientes ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center text-red-300">
                                        {errorPacientes}
                                    </td>
                                </tr>
                            ) : !hasResultados ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-white/60">
                                        No encontramos pacientes con esos filtros.
                                    </td>
                                </tr>
                            ) : (
                                pacientesProcesados.map((paciente) => (
                                    <tr
                                        title={`ID #${paciente.id_paciente}${paciente.nombre ? ` · ${paciente.nombre}` : ""}`}
                                        key={paciente.id_paciente}
                                        className={`transition-colors ${loadingPacientes ? "opacity-70" : "hover:bg-emerald-500/10"}`}
                                    >
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => {
                                                    navigate("/hc", { state: { paciente } });
                                                }}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-base text-emerald-200 transition hover:bg-emerald-400/20 hover:text-white"
                                                title="Ver historia clínica"
                                            >
                                                📁
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-white">
                                            <span
                                                className={`truncate ${paciente.nombre ? "cursor-pointer hover:text-emerald-300 transition-colors" : ""}`}
                                                title={paciente.nombre || "—"}
                                                onClick={() => {
                                                    if (paciente.nombre) navigator.clipboard.writeText(paciente.nombre);
                                                }}
                                            >
                                                {paciente.nombre || "—"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center text-white/80">
                                            <span
                                                className={`${paciente.dni ? "cursor-pointer hover:text-emerald-300 transition-colors" : ""}`}
                                                onClick={() => {
                                                    if (paciente.dni) navigator.clipboard.writeText(paciente.dni);
                                                }}
                                            >
                                                {paciente.dni || "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-white/80">
                                            {paciente.edadCalculada ?? "N/D"}
                                        </td>
                                        <td className="px-5 py-3 text-white">
                                            <span
                                                className={`inline-flex max-w-sm items-center gap-2 truncate rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 ${paciente.nombre_cobertura ? "cursor-pointer hover:text-emerald-300 transition-colors" : ""}`}
                                                onClick={() => {
                                                    if (paciente.nombre_cobertura) navigator.clipboard.writeText(paciente.nombre_cobertura);
                                                }}
                                            >
                                                {paciente.nombre_cobertura || "—"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-white">
                                            <span
                                                className={`truncate ${paciente.beneficio ? "cursor-pointer hover:text-emerald-300 transition-colors" : ""}`}
                                                title={paciente.beneficio || "—"}
                                                onClick={() => {
                                                    if (paciente.beneficio) navigator.clipboard.writeText(paciente.beneficio);
                                                }}
                                            >
                                                {paciente.beneficio || "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPacienteContacto(paciente);
                                                    setMostrarContacto(true);
                                                }}
                                                className="inline-flex min-w-[2.4rem] items-center justify-center rounded-full border border-emerald-400/60 px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.05em] text-white transition hover:border-emerald-300 hover:bg-emerald-400/20"
                                            >
                                                Ver
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 backdrop-blur">
                <div className="font-semibold text-white">
                    {loadingPacientes ? "Cargando pacientes…" : `Mostrando ${showingFrom}-${showingTo} de ${totalPacientes}`}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/50">Pág.</span>
                    <button
                        onClick={handlePrevPage}
                        disabled={safePage <= 1 || loadingPacientes}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${safePage <= 1 || loadingPacientes ? "cursor-not-allowed border-white/10 text-white/30" : "border-emerald-400/60 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-400/20 hover:text-white"}`}
                    >
                        ◀
                    </button>
                    <span className="px-2 font-semibold text-white">
                        {safePage} / {totalPages}
                    </span>
                    <button
                        onClick={handleNextPage}
                        disabled={safePage >= totalPages || loadingPacientes}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${safePage >= totalPages || loadingPacientes ? "cursor-not-allowed border-white/10 text-white/30" : "border-emerald-400/60 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-400/20 hover:text-white"}`}
                    >
                        ▶
                    </button>
                </div>
                <label className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/50">Filas</span>
                    <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-white focus:border-emerald-400 focus:outline-none"
                    >
                        {PAGE_SIZE_OPTIONS.map((option) => (
                            <option key={option} value={option} className="bg-[#050b16] text-white">
                                {option}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {/* --- Modal de contacto del paciente --- */}
            {mostrarContacto && pacienteContacto && (
                <ModalMensaje
                    tipo="contacto"
                    titulo="Contacto de:"
                    nombre={pacienteContacto.nombre}
                    telefono={pacienteContacto.telefono}
                    email={pacienteContacto.email}
                    onClose={() => setMostrarContacto(false)}
                />
            )}

            {/* --- Modal general de mensajes (error, éxito, confirmación, etc.) --- */}
            {modalInfo && (
                <ModalMensaje
                    tipo={modalInfo.tipo}
                    titulo={modalInfo.titulo}
                    mensaje={modalInfo.mensaje}
                    onCerrar={modalInfo.onCerrar || cerrarModalInfo}
                    nombre={modalInfo.nombre}
                    tipoEntidad={modalInfo.tipoEntidad}
                    onConfirmar={modalInfo.onConfirmar}
                />
            )}

            {/* --- Modal para editar entidades auxiliares (Coberturas, Localidades, Nacionalidades) --- */}
            {mostrarModalEntidad && entidadSeleccionada && (
                <ModalListaEditable
                    titulo={tituloEntidad || entidadSeleccionada.titulo}
                    endpoint={entidadSeleccionada.endpoint}
                    campoNombre={entidadSeleccionada.campoNombre}
                    idCampo={entidadSeleccionada.idCampo}
                    onClose={() => setMostrarModalEntidad(false)}
                />
            )}

            {/* --- Modal NUEVO PACIENTE --- */}
            <ModalNuevoPaciente
                open={openModalNuevoPaciente}
                onClose={() => setOpenModalNuevoPaciente(false)}
                onSaved={() => {
                    // Recargamos lista para evitar desfasajes
                    refreshPacientes();
                    setOpenModalNuevoPaciente(false);
                }}
            />
            </div>
        </div>
    );
}
