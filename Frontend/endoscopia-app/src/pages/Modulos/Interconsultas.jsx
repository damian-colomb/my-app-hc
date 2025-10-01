// Componente Interconsultas:
// Permite registrar, visualizar, editar y eliminar interconsultas para un paciente.
// Incluye subida de archivos (PDF/JPG/PNG), selector de especialidad, y soporte para edición en línea.
import React, { useState, useEffect, useRef, useMemo } from "react";
import { BsPersonLinesFill } from "react-icons/bs";
import { FiEdit, FiTrash2, FiSave } from "react-icons/fi";
import { FaPlus, FaMinus, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import ModalMensaje from "../../components/ModalMensaje";
import ModalListaEditable from "../../components/ModalListaEditable";
import { SelectConCrud } from "./elementosPartes/Campos.jsx";
import axios from "axios";

const parseFecha = (valor) => {
    if (!valor) return null;
    if (valor instanceof Date) {
        return Number.isNaN(valor.getTime()) ? null : valor;
    }
    if (typeof valor === "string") {
        const trimmed = valor.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return new Date(`${trimmed}T00:00:00`);
        }
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
            const [d, m, y] = trimmed.split("/").map(Number);
            if (d && m && y) {
                const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                return new Date(`${iso}T00:00:00`);
            }
        }
    }
    return null;
};

const formatearFechaParaInput = (valor) => {
    const fecha = parseFecha(valor);
    if (fecha) {
        return fecha.toISOString().split("T")[0];
    }
    return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : "";
};

const formatearFechaParaMostrar = (valor) => {
    const fecha = parseFecha(valor);
    if (fecha) {
        try {
            return fecha.toLocaleDateString("es-AR");
        } catch (error) {
            console.warn("No se pudo formatear fecha", error);
            return fecha.toISOString().split("T")[0];
        }
    }
    return valor ?? "";
};

const DateField = ({
    value,
    onChange,
    onBlur,
    onFocus,
    className = "",
    placeholder = "Fecha",
    ...rest
}) => {
    const [mode, setMode] = useState(value ? "date" : "text");
    const inputRef = useRef(null);

    useEffect(() => {
        setMode(value ? "date" : "text");
    }, [value]);

    useEffect(() => {
        if (mode === "date" && inputRef.current && document.activeElement === inputRef.current) {
            requestAnimationFrame(() => {
                if (inputRef.current && typeof inputRef.current.showPicker === "function") {
                    try {
                        inputRef.current.showPicker();
                    } catch (error) {
                        /* noop: algunos navegadores no soportan showPicker */
                    }
                }
            });
        }
    }, [mode]);

    const handleFocus = (event) => {
        setMode("date");
        if (typeof onFocus === "function") {
            onFocus(event);
        }
    };

    return (
        <input
            ref={inputRef}
            type={mode}
            value={value || ""}
            placeholder={placeholder}
            className={className}
            onFocus={handleFocus}
            onChange={(e) => onChange && onChange(e.target.value, e)}
            onBlur={(e) => {
                if (!e.target.value) {
                    setMode("text");
                }
                onBlur && onBlur(e.target.value, e);
            }}
            {...rest}
        />
    );
};

function Interconsultas({ paciente }) {
    // Estados generales
    const [mostrarInterconsultas, setMostrar] = useState(false);

    // Estados del formulario
    const [fecha, setFecha] = useState("");
    const [idEspecialidad, setIdEspecialidad] = useState("");
    const [listaEspecialidades, setListaEspecialidades] = useState([]);
    const [descripcion, setDescripcion] = useState("");
    const [archivo, setArchivo] = useState(null);
    const fileInputRef = useRef(null);
    const [listaInterconsultas, setListaInterconsultas] = useState([]);
    const [editandoIndice, setEditandoIndice] = useState(null);
    const [expandedIndices, setExpandedIndices] = useState([]);

    const especialidadOptions = useMemo(() => (
        Array.isArray(listaEspecialidades)
            ? listaEspecialidades
                .map((esp) => ({
                    id: esp?.id != null ? String(esp.id) : "",
                    label: esp?.especialidad ?? esp?.nombre ?? "",
                }))
                .filter((opt) => opt.id && opt.label)
            : []
    ), [listaEspecialidades]);

    // Estados de UI (guardar/borrar y confirmación)
    const [guardandoCreacion, setGuardandoCreacion] = useState(false);
    const [guardandoEdicion, setGuardandoEdicion] = useState(null); // índice que está guardando
    const [eliminandoId, setEliminandoId] = useState(null);
    const [archivoEdicion, setArchivoEdicion] = useState(null);

    // Modal de confirmación de borrado
    const [mostrarConfirm, setMostrarConfirm] = useState(false);
    const [confirmarInterconsulta, setConfirmarInterconsulta] = useState(null);

    // Estados del modal
    const [mostrarModal, setMostrarModal] = useState(false);
    const [tituloModal, setTituloModal] = useState("");
    const [variableModal, setVariableModal] = useState("");

    const handleAbrirModal = (variable, titulo) => {
        setVariableModal(variable);
        setTituloModal(titulo);
        setMostrarModal(true);
    };

    // Obtener lista de interconsultas del paciente actual
    const fetchInterconsultas = async () => {
        try {
            const res = await axios.get(`/api/interconsultas/${paciente.id_paciente}`);
            setListaInterconsultas(res.data);
        } catch (err) {
            console.error("Error al cargar interconsultas", err);
        }
    };

    // Cargar interconsultas cuando cambia el paciente
    useEffect(() => {
        if (paciente?.id_paciente) {
            fetchInterconsultas();
        }
    }, [paciente]);

    // Solicita URL firmada al backend y abre el archivo asociado a una interconsulta
    const abrirArchivoInterconsulta = async (id_interconsulta) => {
    try {
        const { data } = await axios.get(`/api/interconsultas/archivo-url/${id_interconsulta}`);
        if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        } else {
        alert("No se pudo obtener el enlace del archivo.");
        }
    } catch (err) {
        console.error("No se pudo obtener URL firmada", err);
        alert("No se pudo abrir el archivo.");
    }
    };

    // Maneja la carga de una nueva interconsulta (formulario superior)
    const manejarCarga = async () => {
        if (guardandoCreacion) return;
        if (!paciente?.id_paciente) {
            console.error("No hay paciente seleccionado. No se puede crear interconsulta.");
            return;
        }
        if (!fecha || !descripcion) {
            alert("Fecha y descripción son obligatorios para crear una interconsulta.");
            return;
        }
        const idPaciente = paciente.id_paciente;
        const fd = new FormData();
        fd.append("id_paciente", idPaciente);
        fd.append("fecha", fecha);
        fd.append("especialidad", idEspecialidad);
        fd.append("descripcion", descripcion);
        if (archivo) fd.append("archivo", archivo);
        try {
            setGuardandoCreacion(true);
            await axios.post(`/api/interconsultas/`, fd);
            await fetchInterconsultas();
            setFecha("");
            setIdEspecialidad("");
            setDescripcion("");
            setArchivo(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (err) {
            console.error("Error al crear interconsulta", err.response?.data || err);
            alert("Error al crear interconsulta: " + (err.response?.data?.detail || err.message));
        } finally {
            setGuardandoCreacion(false);
        }
    };

    // Obtiene la lista de especialidades para el combobox
    const actualizarEspecialidades = () => {
        fetch(`/api/bases/especialidad/`)
            .then(res => res.json())
            .then(data => setListaEspecialidades(data))
            .catch(err => console.error("Error al cargar especialidades", err));
    };

    useEffect(() => {
        actualizarEspecialidades();
    }, []);

    // Renderiza el panel de interconsultas: formulario + listado
    return (
        <>
            <div className="max-w-4xl mx-auto w-full px-4">
                <div
                    className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 border border-slate-800/70 px-5 py-4 hover:from-slate-800/90 hover:to-slate-950/90 cursor-pointer flex items-center justify-between text-slate-100 font-semibold transition-shadow shadow-xl mb-4"
                    onClick={() => setMostrar(!mostrarInterconsultas)}
                >
                    <span className="flex items-center gap-2 text-slate-100 text-lg font-semibold">
                        <BsPersonLinesFill className="text-emerald-300" />
                        Interconsultas
                    </span>
                    <span className="text-emerald-300 text-lg">
                        {mostrarInterconsultas ? <FaMinus /> : <FaPlus />}
                    </span>
                </div>
                {mostrarInterconsultas && (
                    <>
                        <div className="bg-slate-900/75 border border-slate-700/60 p-6 rounded-3xl mb-6 shadow-2xl backdrop-blur flex flex-col gap-4">
                            <div className="flex flex-wrap gap-4 text-sm text-slate-200">
                                <div className="flex-1 max-w-[140px]">
                                    <label className="block text-slate-300 text-xs uppercase tracking-wide mb-1">Fecha</label>
                                    <DateField
                                        value={formatearFechaParaInput(fecha)}
                                        onChange={(val) => setFecha(val)}
                                        className="w-full rounded-md px-3 py-2 text-sm bg-slate-900/80 text-slate-100 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                </div>
                                <div className="flex items-end gap-2 max-w-[280px] w-full">
                                    <div className="flex-1">
                                        <label className="block text-slate-300 text-xs uppercase tracking-wide mb-1">Especialidad</label>
                                        <SelectConCrud
                                            placeholder="Seleccionar especialidad"
                                            options={especialidadOptions}
                                            value={idEspecialidad ?? ""}
                                            onChange={(id) => setIdEspecialidad(id != null ? String(id) : "")}
                                            onOpenCrud={() => handleAbrirModal("especialidad", "Editar especialidades")}
                                            showCrud
                                            crudAlign="right"
                                            selectClassName="bg-slate-900/80 border border-slate-600 text-slate-100"
                                            searchable
                                        />
                                    </div>
                                </div>
                                <div className="ml-auto">
                                    <button
                                        onClick={manejarCarga}
                                        disabled={guardandoCreacion}
                                        className={`border px-3 py-1 rounded transition text-sm mt-auto ${
                                            guardandoCreacion
                                                ? "border-gray-500 text-slate-400 cursor-not-allowed"
                                                : "border-emerald-400 text-emerald-400 hover:border-emerald-300 hover:text-emerald-300 bg-transparent"
                                        }`}
                                        title="Guardar interconsulta"
                                    >
                                        {guardandoCreacion ? (
                                            <span className="inline-flex items-center gap-2">
                                                <AiOutlineLoading3Quarters className="animate-spin" />
                                                Guardando…
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-2">
                                                <FiSave />
                                                Guardar
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-300 text-sm mb-1">Descripción</label>
                                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Resumen o indicación" rows={4} className="w-full rounded-lg px-3 py-3 bg-slate-900/80 text-slate-100 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none shadow-inner" />
                            </div>
                            <div className="mb-4">
                                <label className="block text-slate-300 text-sm mb-1">Archivo (PDF o JPG)</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setArchivo(e.target.files[0])}
                                    className="file:bg-slate-900/80 file:border file:border-sky-400/70 file:text-sky-300 file:px-3 file:py-1 file:rounded file:cursor-pointer text-slate-300"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-900/75 rounded-2xl border border-slate-700/50 text-sm">
                            {listaInterconsultas.length === 0 ? (
                                <p className="text-slate-400 italic">No hay interconsultas registradas.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {listaInterconsultas.map((c, i) => {
                                        const isEditing = i === editandoIndice;
                                        const isExpanded = expandedIndices.includes(i);
                                        const especialidadNombre =
                                            c.especialidad_rel?.especialidad ||
                                            listaEspecialidades.find((esp) => esp.id === c.especialidad)?.especialidad ||
                                            "Sin especialidad";

                                        if (isEditing) {
                                            return (
                                                <li
                                                    key={c.id_interconsulta ?? i}
                                                    className="rounded-2xl px-4 py-4 text-slate-100 border border-sky-500/50 bg-slate-900/85 shadow-lg"
                                                >
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex flex-wrap gap-3 text-sm text-slate-200">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs uppercase tracking-wide text-slate-300">Fecha</span>
                                                                <DateField
                                                                    value={formatearFechaParaInput(c.fecha)}
                                                                    onChange={(val) => {
                                                                        const nuevaLista = [...listaInterconsultas];
                                                                        nuevaLista[i].fecha = val;
                                                                        setListaInterconsultas(nuevaLista);
                                                                    }}
                                                                    className="rounded px-3 py-2 text-sm bg-slate-900/80 text-slate-100 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1 min-w-[200px] flex-1">
                                                                <span className="text-xs uppercase tracking-wide text-slate-300">Especialidad</span>
                                                                <SelectConCrud
                                                                    placeholder="Seleccionar especialidad"
                                                                    options={especialidadOptions}
                                                                    value={listaInterconsultas[i].especialidad != null && listaInterconsultas[i].especialidad !== ""
                                                                        ? String(listaInterconsultas[i].especialidad)
                                                                        : ""}
                                                                    onChange={(id) => {
                                                                        const nuevaLista = [...listaInterconsultas];
                                                                        nuevaLista[i].especialidad = id != null && id !== "" ? Number(id) : "";
                                                                        setListaInterconsultas(nuevaLista);
                                                                    }}
                                                                    onOpenCrud={() => handleAbrirModal("especialidad", "Editar especialidades")}
                                                                    showCrud
                                                                    crudAlign="right"
                                                                    selectClassName="bg-slate-900/80 border border-slate-600 text-slate-100"
                                                                    searchable
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs uppercase tracking-wide text-slate-300">Descripción</span>
                                                            <textarea
                                                                value={c.descripcion}
                                                                onChange={(e) => {
                                                                    const nuevaLista = [...listaInterconsultas];
                                                                    nuevaLista[i].descripcion = e.target.value;
                                                                    setListaInterconsultas(nuevaLista);
                                                                }}
                                                                rows={4}
                                                                className="w-full rounded-lg px-3 py-2 bg-slate-900/80 text-slate-100 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-y whitespace-pre-wrap"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs uppercase tracking-wide text-slate-300">Reemplazar archivo (PDF/JPG/PNG)</span>
                                                            <input
                                                                type="file"
                                                                accept=".pdf,.jpg,.jpeg,.png"
                                                                onChange={(e) => setArchivoEdicion(e.target.files[0] || null)}
                                                                className="file:bg-slate-900/80 file:border file:border-sky-400/70 file:text-sky-300 file:px-3 file:py-1 file:rounded file:cursor-pointer text-slate-300"
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 justify-end">
                                                            <button
                                                                onClick={() => {
                                                                    setEditandoIndice(null);
                                                                    setArchivoEdicion(null);
                                                                }}
                                                                className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-sm hover:border-slate-400"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (guardandoEdicion === i) return;
                                                                    try {
                                                                        setGuardandoEdicion(i);
                                                                        const formData = new FormData();
                                                                        formData.append("fecha", listaInterconsultas[i].fecha || "");
                                                                        formData.append("especialidad", listaInterconsultas[i].especialidad || "");
                                                                        formData.append("descripcion", listaInterconsultas[i].descripcion || "");
                                                                        if (archivoEdicion) {
                                                                            formData.append("archivo", archivoEdicion);
                                                                        }
                                                                        await axios.put(
                                                                            `/api/interconsultas/${listaInterconsultas[i].id_interconsulta}`,
                                                                            formData
                                                                        );
                                                                        setEditandoIndice(null);
                                                                        setArchivoEdicion(null);
                                                                        await fetchInterconsultas();
                                                                    } catch (err) {
                                                                        console.error("Error al actualizar interconsulta", err);
                                                                        alert("No se pudo actualizar la interconsulta.");
                                                                    } finally {
                                                                        setGuardandoEdicion(null);
                                                                    }
                                                                }}
                                                                disabled={guardandoEdicion === i}
                                                                className={`px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-2 ${
                                                                    guardandoEdicion === i
                                                                        ? "bg-emerald-900 text-emerald-200 cursor-not-allowed"
                                                                        : "bg-emerald-600 hover:bg-emerald-500 text-emerald-50"
                                                                }`}
                                                            >
                                                                {guardandoEdicion === i ? (
                                                                    <>
                                                                        <AiOutlineLoading3Quarters className="animate-spin" /> Guardando…
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FiSave /> Guardar
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        }

                                        return (
                                            <li
                                                key={c.id_interconsulta ?? i}
                                                className="rounded-2xl px-4 py-4 text-slate-100 border border-slate-700/40 bg-slate-900/85 shadow-lg"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center gap-3 text-left text-slate-100 font-semibold bg-slate-800/90 border border-slate-700/60 rounded-xl px-4 py-3 hover:border-slate-500 transition"
                                                            onClick={() => {
                                                                setExpandedIndices((prev) =>
                                                                    prev.includes(i)
                                                                        ? prev.filter((idx) => idx !== i)
                                                                        : [...prev, i]
                                                                );
                                                            }}
                                                            aria-label={isExpanded ? "Colapsar interconsulta" : "Expandir interconsulta"}
                                                        >
                                                            <span className="text-slate-300 text-sm font-medium whitespace-nowrap">{formatearFechaParaMostrar(c.fecha)}</span>
                                                            <span className="text-emerald-200 font-semibold truncate" title={especialidadNombre}>
                                                                {especialidadNombre}
                                                            </span>
                                                            <span className="ml-auto flex items-center justify-center text-emerald-200">
                                                                {isExpanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
                                                            </span>
                                                        </button>
                                                        {isExpanded && (
                                                            <div className="mt-3 space-y-2">
                                                                <div className="bg-slate-900/75 border border-slate-700/50 rounded-xl px-4 py-3 shadow-inner">
                                                                    <span className="block text-xs uppercase tracking-wide text-slate-300/80 mb-1">Descripción</span>
                                                                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                                                        {c.descripcion?.trim() ? c.descripcion : "Sin descripción"}
                                                                    </p>
                                                                </div>
                                                                {c.nombre_archivo && (
                                                                    <a
                                                                        href="#"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            abrirArchivoInterconsulta(c.id_interconsulta);
                                                                        }}
                                                                        className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 underline"
                                                                        title="Abrir archivo"
                                                                    >
                                                                        {c.nombre_archivo}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                                                        <button
                                                            className="text-slate-100 hover:text-sky-300 text-xs p-1"
                                                            title="Editar interconsulta"
                                                            onClick={() => {
                                                                setEditandoIndice(i);
                                                                setArchivoEdicion(null);
                                                            }}
                                                        >
                                                            <FiEdit />
                                                        </button>
                                                        <button
                                                            className={`text-xs p-1 ${
                                                                eliminandoId === c.id_interconsulta
                                                                    ? "text-slate-500 cursor-not-allowed"
                                                                    : "text-slate-100 hover:text-rose-300"
                                                            }`}
                                                            title="Eliminar interconsulta"
                                                            disabled={eliminandoId === c.id_interconsulta}
                                                            onClick={() => {
                                                                setConfirmarInterconsulta(c);
                                                                setMostrarConfirm(true);
                                                            }}
                                                        >
                                                            {eliminandoId === c.id_interconsulta ? (
                                                                <AiOutlineLoading3Quarters className="animate-spin" />
                                                            ) : (
                                                                <FiTrash2 />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </>
                )}
            </div>
            {mostrarConfirm && confirmarInterconsulta && (
                <ModalMensaje
                    tipo="confirmar_borrado"
                    titulo="¿Eliminar interconsulta?"
                    mensaje="Se eliminará la interconsulta y su archivo asociado. Esta acción no se puede deshacer."
                    onClose={() => {
                        setMostrarConfirm(false);
                        setConfirmarInterconsulta(null);
                    }}
                    onConfirm={async () => {
                        try {
                            setEliminandoId(confirmarInterconsulta.id_interconsulta);
                            await axios.delete(`/api/interconsultas/${confirmarInterconsulta.id_interconsulta}`);
                            await fetchInterconsultas();
                        } catch (err) {
                            console.error("Error al eliminar interconsulta", err);
                            alert("No se pudo eliminar la interconsulta.");
                        } finally {
                            setEliminandoId(null);
                            setMostrarConfirm(false);
                            setConfirmarInterconsulta(null);
                        }
                    }}
                />
            )}
            {mostrarModal && (
                <ModalListaEditable
                    titulo={tituloModal}
                    endpoint="bases/especialidad"
                    campoNombre="especialidad"
                    idCampo="id"
                    actualizarLista={actualizarEspecialidades}
                    onClose={() => setMostrarModal(false)}
                />
            )}
        </>
    );
}

// Exportar componente
export default Interconsultas;
