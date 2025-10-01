import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { API_BASE } from "../config.js";

const url = (ep) => `${API_BASE.replace(/\/+$/, "")}/${ep.replace(/^\/+/, "")}/`;

function useLockBodyScroll(active) {
    useEffect(() => {
        if (!active) return;
        const body = document.body;
        const prevCount = Number(body.dataset.lockCount || "0");
        if (prevCount === 0) {
            body.dataset.prevOverflow = body.style.overflow;
            body.dataset.prevPaddingRight = body.style.paddingRight;
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            body.style.overflow = "hidden";
            if (scrollBarWidth > 0) {
                body.style.paddingRight = `${scrollBarWidth}px`;
            }
        }
        body.dataset.lockCount = String(prevCount + 1);

        return () => {
            const currentCount = Number(body.dataset.lockCount || "1") - 1;
            if (currentCount <= 0) {
                delete body.dataset.lockCount;
                body.style.overflow = body.dataset.prevOverflow || "";
                body.style.paddingRight = body.dataset.prevPaddingRight || "";
                delete body.dataset.prevOverflow;
                delete body.dataset.prevPaddingRight;
            } else {
                body.dataset.lockCount = String(currentCount);
            }
        };
    }, [active]);
}

// Componente ModalListaEditable: Permite editar una lista de elementos (agregar, editar, eliminar) de forma dinámica.
// Este componente muestra un modal que permite gestionar una lista de elementos obtenidos de un endpoint, con validaciones y manejo de errores.
export default function ModalListaEditable({
    titulo,
    endpoint,
    campoNombre,
    idCampo,
    onClose,
    actualizarLista
}) {
    useLockBodyScroll(true);
    // Estados para controlar los elementos de la lista, entrada nueva, modo de edición, errores y carga
    const [items, setItems] = useState([]);
    const [nuevo, setNuevo] = useState("");
    const [editandoId, setEditandoId] = useState(null);
    const [editandoValor, setEditandoValor] = useState("");
    const [error, setError] = useState("");
    const [accionEnCurso, setAccionEnCurso] = useState(false);

    // Cargar elementos desde el backend y ordenarlos alfabéticamente
    const cargarItems = async () => {
        try {
            // DEBUG: Mostrar información detallada
            const urlCompleta = url(endpoint);
            console.log("🔍 [ModalListaEditable] DEBUG INFO:");
            console.log("  - API_BASE:", API_BASE);
            console.log("  - endpoint:", endpoint);
            console.log("  - URL completa:", urlCompleta);
            console.log("  - ¿Es HTTPS?", urlCompleta.startsWith("https://"));
            console.log("  - hostname:", window.location.hostname);
            
            const res = await api.get(urlCompleta);
            const datosOrdenados = res.data.sort((a, b) =>
                a[campoNombre].localeCompare(b[campoNombre])
            );
            setItems(datosOrdenados);
        } catch (err) {
            console.error("❌ [ModalListaEditable] Error al cargar lista:", err);
            console.error("  - Error details:", err.response?.data);
            console.error("  - Status:", err.response?.status);
            console.error("  - URL que falló:", err.config?.url);
            
            // Mostrar error más específico en el frontend
            let errorMessage = "No se pudo cargar la lista. ";
            if (err.response?.status === 302) {
                errorMessage += "Error 302: Redirección detectada. ";
            }
            if (err.config?.url?.startsWith("http://")) {
                errorMessage += "⚠️ Usando HTTP en lugar de HTTPS. ";
            }
            errorMessage += `URL: ${err.config?.url || url(endpoint)}`;
            
            setError(errorMessage);
        }
    };

    useEffect(() => {
        cargarItems();
    }, []);

    // Agregar un nuevo elemento a la lista con validación de duplicados
    const handleAgregar = async () => {
        const nombre = nuevo.trim();
        if (!nombre) return;
        if (items.some(i => i[campoNombre].toLowerCase() === nombre.toLowerCase())) {
            setError(`No se puede usar de nuevo el nombre "${nombre}" porque ya está cargado en la base de datos.`);
            return;
        }
        try {
            setAccionEnCurso(true);
            console.log("Enviando a backend:", { [campoNombre]: nombre });
            await api.post(url(endpoint), { [campoNombre]: nombre });
            const res = await api.get(endpoint);
            const datosOrdenados = res.data.sort((a, b) =>
                a[campoNombre].localeCompare(b[campoNombre])
            );
            setItems(datosOrdenados);
            setNuevo("");
            setAccionEnCurso(false);
        } catch (err) {
            console.error("Error al agregar:", err);
            setError("No se pudo agregar. Verifica conexión o duplicados.");
            setAccionEnCurso(false);
        }
    };

    // Editar el nombre de un elemento existente, validando duplicados
    const handleEditar = async (id) => {
        const nuevoNombre = editandoValor.trim();
        if (!nuevoNombre) return;
        if (items.some(i => i[campoNombre].toLowerCase() === nuevoNombre.toLowerCase())) {
            setError(`No se puede usar de nuevo el nombre "${nuevoNombre}" porque ya está cargado en la base de datos.`);
            return;
        }
        try {
            setAccionEnCurso(true);
            console.log("Payload enviado:", { [campoNombre]: nuevoNombre });
            await api.put(url(`${endpoint}/${id}`), { [campoNombre]: nuevoNombre });
            setEditandoId(null);
            setEditandoValor("");
            cargarItems();
            setAccionEnCurso(false);
        } catch (err) {
            console.error("Error al editar:", err);
            setError("No se pudo editar. Intenta nuevamente.");
            setAccionEnCurso(false);
        }
    };

    // Eliminar un elemento, mostrando un mensaje si está en uso en pacientes
    const handleEliminar = async (id) => {
        try {
            setAccionEnCurso(true);
            await api.delete(url(`${endpoint}/${id}`));
            cargarItems();
            setAccionEnCurso(false);
        } catch (err) {
            // Mostrar mensaje solo si el servidor retornó 400 (motivo en uso)
            if (err.response?.status === 400) {
                setError(
                    `No se puede eliminar "${items.find(i => i[idCampo] === id)?.[campoNombre]}" porque ya se está usando en algún paciente.`
                );
            } else {
                setError("No se pudo eliminar. Intenta nuevamente.");
            }
            setAccionEnCurso(false);
        }
    };

    // Renderizado del modal: entrada para agregar, listado editable y botón de cierre
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4 text-center">
                    {titulo.toUpperCase()}
                </h3>

                {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}

                <div className="mb-4 flex gap-2">
                    <input
                        type="text"
                        value={nuevo}
                        onChange={(e) => setNuevo(e.target.value)}
                        className="w-full px-3 py-1 rounded text-sm shadow bg-gray-800 text-white placeholder:text-gray-400"
                        placeholder={`Nueva ${titulo.toLowerCase()}`}
                    />
                    <button
                        onClick={handleAgregar}
                        className="bg-black border border-green-600 text-green-600 px-3 rounded shadow text-sm flex items-center justify-center gap-1"
                        disabled={accionEnCurso}
                    >
                        {accionEnCurso ? (
                            <svg className="animate-spin h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                        ) : "Agregar"}
                    </button>
                </div>

                <ul className="space-y-2 max-h-64 overflow-auto">
                    {items.map((item) => (
                        <li key={item[idCampo]} className="flex justify-between items-center text-white hover:bg-green-700 rounded px-2 py-1">
                            {editandoId === item[idCampo] ? (
                                <div className="flex gap-2 w-full">
                                    <input
                                        value={editandoValor}
                                        onChange={(e) => setEditandoValor(e.target.value)}
                                        className="flex-grow px-2 py-1 rounded text-sm bg-gray-800 text-white placeholder:text-gray-400"
                                    />
                                    <button
                                        onClick={() => handleEditar(item[idCampo])}
                                        className="bg-black border border-blue-600 text-blue-600 text-sm px-2 py-1 rounded flex items-center justify-center gap-1"
                                        disabled={accionEnCurso}
                                    >
                                        {accionEnCurso ? (
                                            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                        ) : "Guardar"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditandoId(null);
                                            setEditandoValor("");
                                        }}
                                        className="bg-black border border-gray-400 text-gray-400 text-sm px-2 py-1 rounded"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="truncate w-full">{item[campoNombre]}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setEditandoId(item[idCampo]);
                                                setEditandoValor(item[campoNombre]);
                                                setError("");
                                            }}
                                            className="text-yellow-500 hover:text-yellow-300 text-xs p-0.5"
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(item[idCampo])}
                                            className="text-red-500 hover:text-red-300 text-xs p-0.5"
                                            title="Eliminar"
                                            disabled={accionEnCurso}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => {
                            setError("");
                            setEditandoId(null);
                            setEditandoValor("");
                            setNuevo("");
                            if (actualizarLista) {
                                actualizarLista();
                            }
                            onClose();
                        }}
                        className="text-sm text-gray-400 hover:text-white px-3 py-1 border border-gray-400 rounded"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
