// PanelPacientes.jsx
// =======================
// Vista de gestión de pacientes: buscar, ver, editar y eliminar

// 🔽 Importaciones
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ModalNuevoPaciente from "../components/ModalNuevoPaciente";
import { EyeIcon, ClipboardDocumentListIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config.js";

const url = (path) => `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

// 🔽 Componente principal
export default function PanelPacientes() {
    // ===============================
    // 1. ESTADOS
    // ===============================

    const [pacientes, setPacientes] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [debouncedBusqueda, setDebouncedBusqueda] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalPacientes, setTotalPacientes] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);
    const controllerRef = useRef(null);

    const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false);
    const [pacienteEnEdicion, setPacienteEnEdicion] = useState(null);

    // ===============================
    // 2. EFECTOS: Búsqueda y carga paginada
    // ===============================

    useEffect(() => {
        const delay = busqueda.length > 2 ? 220 : 320;
        const handler = setTimeout(() => {
            setDebouncedBusqueda(busqueda.trim());
            setPage(1);
        }, delay);
        return () => clearTimeout(handler);
    }, [busqueda]);

    useEffect(() => {
        let activo = true;

        if (controllerRef.current) {
            controllerRef.current.abort();
        }
        const controller = new AbortController();
        controllerRef.current = controller;

        setLoading(true);
        setError(null);

        const params = { page, page_size: pageSize };
        if (debouncedBusqueda) params.search = debouncedBusqueda;

        axios
            .get(url("/pacientes/"), { params, signal: controller.signal })
            .then(({ data }) => {
                if (!activo) return;
                const items = Array.isArray(data?.items) ? data.items : [];
                setPacientes(items);
                setTotalPacientes(data?.total ?? items.length);
            })
            .catch((err) => {
                if (!activo) return;
                if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") return;
                setError("No se pudieron cargar los pacientes.");
                setPacientes([]);
                setTotalPacientes(0);
                console.error("Error al cargar pacientes:", err);
            })
            .finally(() => {
                if (controllerRef.current === controller) {
                    controllerRef.current = null;
                }
                if (activo) setLoading(false);
            });

        return () => {
            activo = false;
            controller.abort();
        };
    }, [page, pageSize, debouncedBusqueda, reloadToken]);

    // ===============================
    // 3. HANDLERS
    // ===============================

    const totalPages = useMemo(() => {
        if (pageSize <= 0) return 1;
        return Math.max(1, Math.ceil(totalPacientes / pageSize));
    }, [totalPacientes, pageSize]);

    const showingFrom = totalPacientes === 0 ? 0 : (page - 1) * pageSize + 1;
    const showingTo = totalPacientes === 0 ? 0 : Math.min(totalPacientes, page * pageSize);

    const refreshPacientes = () => setReloadToken((prev) => prev + 1);

    const handleBuscar = (e) => {
        setBusqueda(e.target.value);
    };

    const abrirModalEdicion = (paciente) => {
        setPacienteEnEdicion(paciente);
        setModalEdicionAbierto(true);
    };

    const cerrarModalEdicion = () => {
        setModalEdicionAbierto(false);
        setPacienteEnEdicion(null);
    };

    const eliminarPaciente = async (id) => {
        if (!window.confirm("¿Estás seguro que querés eliminar este paciente?")) return;
        try {
            await axios.delete(url(`/pacientes/${id}`));
            refreshPacientes();
        } catch (error) {
            console.error("Error al eliminar paciente:", error);
        }
    };
    // ===============================
    // 5. Navigate para desplazar por la app con botones
    // ===============================
    const navigate = useNavigate();

    // ===============================
    // 6. RENDER
    // ===============================

    return (
        <div className="flex justify-center items-center min-h-screen bg-slate-900 dark:bg-slate-900">
            {/* Contenedor tipo "tarjeta" */}
            <div className="bg-slate-900 dark:bg-slate-900 shadow-lg rounded-xl py-10 px-12 w-full max-w-4xl text-white">
                <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 dark:text-white">
                    PACIENTES
                </h2>

                <div className="flex justify-between items-center mb-6">
                    {/* 🔍 Input de búsqueda */}
                    <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={busqueda}
                        onChange={handleBuscar}
                        className="w-full sm:w-2/3 lg:w-1/2 bg-slate-900 text-white font-bold placeholder-gray-400 border border-slate-600 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => window.location.href = "/"}
                        className="ml-4 bg-black border border-blue-400 text-blue-400 hover:border-blue-300 hover:text-blue-300 text-sm px-5 py-2 rounded-full font-medium"
                    >
                        Volver
                    </button>
                </div>

                {/* 📋 Tabla de pacientes */}
                <div className="overflow-x-auto">
                    <table className="table-auto w-full text-left border-collapse">
                        <thead className="bg-slate-950 text-white">
                            <tr>
                                <th className="px-4 py-2 text-left text-white font-bold">Paciente</th>
                                <th className="px-4 py-2 text-center text-white font-bold">DNI</th>
                                <th className="px-4 py-2 text-white font-bold"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-slate-300">Cargando pacientes...</td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-red-300">{error}</td>
                                </tr>
                            ) : pacientes.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-slate-300">No se encontraron pacientes.</td>
                                </tr>
                            ) : (
                                pacientes.map(p => (
                                    <tr
                                        key={p.id_paciente}
                                        className="border-b dark:border-slate-700 hover:bg-green-800 cursor-pointer"
                                    >
                                        <td className="px-4 py-3 text-left text-white font-bold">{p.nombre}</td>
                                        <td className="px-4 py-3 text-left text-white font-bold">{p.dni}</td>
                                        <td className="px-6 py-3 text-white font-bold">
                                            <div className="flex justify-between gap-4 w-full max-w-xs mx-auto">
                                                <button
                                                    onClick={() => abrirModalEdicion(p)}
                                                    className="bg-black border border-yellow-400 text-yellow-400 hover:border-yellow-300 hover:text-yellow-300 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        navigate("/hc", { state: { paciente: p } });
                                                    }}
                                                    className="bg-black border border-emerald-400 text-emerald-400 hover:border-emerald-300 hover:text-emerald-300 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                                                >
                                                    <ClipboardDocumentListIcon className="h-4 w-4" />
                                                    Historia Clínica
                                                </button>
                                                <button
                                                    onClick={() => eliminarPaciente(p.id_paciente)}
                                                    className="bg-black border border-rose-400 text-rose-400 hover:border-rose-300 hover:text-rose-300 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-slate-200 sm:flex-row">
                    <div>
                        {loading ? "Actualizando lista..." : `Mostrando ${showingFrom}-${showingTo} de ${totalPacientes}`}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(prev => Math.max(1, prev - 1))}
                            disabled={page === 1 || loading}
                            className={`rounded-full border px-3 py-1 ${page === 1 || loading ? "border-slate-700 text-slate-600" : "border-emerald-400 text-emerald-200 hover:bg-emerald-400/20"}`}
                        >
                            ◀
                        </button>
                        <span className="px-2 font-semibold">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(prev => (prev < totalPages ? prev + 1 : prev))}
                            disabled={page >= totalPages || loading}
                            className={`rounded-full border px-3 py-1 ${page >= totalPages || loading ? "border-slate-700 text-slate-600" : "border-emerald-400 text-emerald-200 hover:bg-emerald-400/20"}`}
                        >
                            ▶
                        </button>
                    </div>
                    <label className="flex items-center gap-2">
                        <span>Tamaño</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                const size = Number(e.target.value);
                                if (!Number.isNaN(size)) {
                                    setPageSize(size);
                                    setPage(1);
                                }
                            }}
                            className="rounded-md bg-slate-900 border border-slate-600 px-2 py-1 focus:border-emerald-400 focus:outline-none"
                        >
                            {[10, 25, 50, 100].map(size => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <ModalNuevoPaciente
                open={modalEdicionAbierto}
                onClose={cerrarModalEdicion}
                onSaved={() => {
                    cerrarModalEdicion();
                    refreshPacientes();
                }}
                mode="edit"
                patient={pacienteEnEdicion}
            />
        </div>
    );
}
