import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PiMicroscopeLight } from "react-icons/pi";
import { MdPhotoLibrary, MdSave, MdCancel } from "react-icons/md";
import { FiEdit, FiTrash2, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { FaPlus, FaMinus, FaChevronDown, FaChevronUp } from "react-icons/fa";
import ModalVisor from "../../components/modalVisor";
import ModalPatologiaNueva from "../../components/ModalPatologiaNueva";
import axios from "axios";
import ModalMensaje from "../../components/ModalMensaje";

// Punto base de la API
import { API_BASE } from "../../config.js";

const toBool = (value) => {
    if (value === true || value === false) return value;
    if (value === 1 || value === 0) return Boolean(value);
    if (value === "1" || value === "0") return value === "1";
    if (value == null) return false;
    const normalized = String(value).trim().toLowerCase();
    return ["1", "true", "t", "s", "si", "sí", "yes"].includes(normalized);
};

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
                        /* algunos navegadores no soportan showPicker */
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

function Patologia({ paciente, onProcedimientosUpdate }) {
    // --------------------------- Utilidades ---------------------------
    const formatearFecha = (fechaStr) => formatearFechaParaMostrar(fechaStr);

    // ----------------------------- Estado ----------------------------
    const [mostrarPatologia, setMostrarPatologia] = useState(false);
    const [mostrarArchivosCargados, setMostrarArchivosCargados] = useState(false);

    const [listaPatologia, setListaPatologia] = useState([]); // listado renderizado
    const [expandedIndices, setExpandedIndices] = useState([]);
    const idPaciente = paciente?.id_paciente;

    // Pendientes y base para el modal de alta
    const [procedimientosPendientes, setProcedimientosPendientes] = useState([]);
    const pendientesPatologia = useMemo(
        () => procedimientosPendientes.filter((p) => p.tipo === "patologia"),
        [procedimientosPendientes]
    );
    const pendientesCultivo = useMemo(
        () => procedimientosPendientes.filter((p) => p.tipo === "cultivo"),
        [procedimientosPendientes]
    );

    const [pendienteEnModal, setPendienteEnModal] = useState(null);

    const getProcedimientoNombre = useCallback((item) => {
        if (!item) return "Procedimiento";
        return (
            item.procedimiento_nombre ||
            item?.nombre_procedimiento ||
            item?.procedimiento ||
            "Procedimiento"
        );
    }, []);

    const getProcedimientoTecnica = useCallback(
        (item) => {
            if (!item) return "";
            const principal = getProcedimientoNombre(item);
            const candidate =
                item?.procedimiento_tecnica ||
                item?.nombre_tecnica ||
                item?.tecnica ||
                item?.tecnica_detalle ||
                "";
            if (candidate && candidate !== principal) {
                return candidate;
            }
            return "";
        },
        [getProcedimientoNombre]
    );

    const abrirModalPatologiaPendiente = useCallback((pendiente, tipo = "patologia") => {
        const relacionadoId = pendiente?.id_procedimiento_paciente ?? null;
        setPendienteEnModal(pendiente ? { tipo, item: pendiente } : null);
        setModalDefaults({ relId: relacionadoId, sinRelacion: false });
        setModalKey((k) => k + 1);
        setModalNuevoAbierto(true);
    }, []);
    const [listaProcedimientosBase, setListaProcedimientosBase] = useState([]);

    // Modal "Nueva patología"
    const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
    const [modalKey, setModalKey] = useState(0); // para forzar reset del modal
    const [modalDefaults, setModalDefaults] = useState({ relId: null, sinRelacion: false });

    // Visor de fotos
    const [modalAbierto, setModalAbierto] = useState(false);
    const [fotosSeleccionadas, setFotosSeleccionadas] = useState([]);

    // Forzar refresco de enlaces (evitar cache al reemplazar PDF)
    const [cacheBust, setCacheBust] = useState(0);

    // Control de guardado para deshabilitar botones
    const [savingIdx, setSavingIdx] = useState(null);

    // Confirmación genérica (ModalMensaje)
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitulo, setConfirmTitulo] = useState("");
    const [confirmMensaje, setConfirmMensaje] = useState("");
    const confirmActionRef = useRef(null);

    const abrirConfirm = (titulo, mensaje, onConfirm) => {
        setConfirmTitulo(titulo || "¿Eliminar elemento?");
        setConfirmMensaje(mensaje || "¿Estás seguro que querés eliminar este elemento?");
        confirmActionRef.current = onConfirm;
        setConfirmOpen(true);
    };

    // --------------------------- Cargas (API) --------------------------
    const fetchPatologiasGuardadas = async () => {
        if (!idPaciente) return;
        try {
            const respuesta = await fetch(`${API_BASE}/patologias/paciente/${idPaciente}`);
            if (!respuesta.ok) throw new Error("Error al obtener patologías");
            const data = await respuesta.json();

            const procesadas = data.map((item) => {
                const procedNombre =
                    item.procedimiento_nombre ||
                    item.procedimiento_rel?.procedimiento ||
                    "";
                const procedTecnica =
                    item.procedimiento_tecnica ||
                    item.procedimiento_rel?.tecnica_detalle ||
                    "";
                const fechaCirugia = item.fecha_procedimiento || item.procedimiento_fecha || null;
                const tipoRegistro = (item.tipoRegistro || item.tipo_registro || "patologia").toLowerCase();
                const archivos = [];

                        // PDF como archivo (si existe)
                        if (item.informe_pdf_url) {
                            archivos.push({
                        id: item.id_patologia, // para poder borrar por id_patologia
                        tipo: "pdf",
                        nombre: "Informe PDF",
                        url: item.informe_pdf_url,
                    });
                }

                // Fotos (cada una con su id)
                if (Array.isArray(item.fotos) && item.fotos.length > 0) {
                    const fotosOrdenadas = [...item.fotos].sort((a, b) => a.id - b.id);
                    fotosOrdenadas.forEach((foto, idx) => {
                        archivos.push({
                            id: foto.id,
                            tipo: "foto",
                            nombre: `Foto ${idx + 1}`,
                            url: foto.file_url,
                        });
                    });
                }

                // De-duplicar por URL (defensivo)
                const archivosUnicos = Array.from(new Map(archivos.map((a) => [a.url, a])).values());

                const informeTexto = item.informe_texto || "";

                return {
                    id_patologia: item.id_patologia ?? item.id,
                    fecha: item.fecha,
                    descripcion: informeTexto,
                    procedimiento_nombre: procedNombre,
                    procedimiento_tecnica: procedTecnica,
                    fecha_procedimiento: fechaCirugia,
                    fechaProcedimiento: fechaCirugia,
                    tipo_registro: tipoRegistro,
                    tipoRegistro,
                    archivos: archivosUnicos,
                    editando: false,
                    fechaEdit: item.fecha,
                    descripcionEdit: informeTexto,
                    nuevoPdf: null, // para reemplazar PDF en edición
                };
            });

            setListaPatologia(procesadas);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchProcedimientosPendientes = async () => {
        if (!idPaciente) return;
        const url = `${API_BASE}/procedimientos/pacientes/${idPaciente}`;
        try {
            const resp = await axios.get(url, {
                validateStatus: (status) => status === 200 || status === 404,
                withCredentials: false,
                headers: { Accept: "application/json" },
            });

            if (resp.status === 404) {
                setProcedimientosPendientes([]);
                return;
            }

            const data = Array.isArray(resp.data) ? resp.data : [];
            const pendientes = [];

            data.forEach((proc) => {
                const baseNombre =
                    proc?.procedimiento_base_nombre ||
                    proc?.procedimiento_base ||
                    proc?.procedimiento ||
                    proc?.nombre_tecnica ||
                    "";

                const tecnicaNombre =
                    proc?.nombre_tecnica ||
                    proc?.tecnica_detalle ||
                    proc?.procedimiento_tecnica ||
                    "";

                const entryBase = {
                    id_procedimiento_paciente: proc.id_procedimiento_paciente,
                    id_procedimiento_base: proc.id_procedimiento_base || null,
                    fecha: proc.fecha,
                    procedimiento_nombre: baseNombre,
                    procedimiento_tecnica: tecnicaNombre,
                    institucion_nombre: proc.institucion_nombre || proc.institucion || null,
                };

                if (toBool(proc.patologia)) {
                    pendientes.push({ ...entryBase, tipo: "patologia" });
                }
                if (toBool(proc.cultivo)) {
                    pendientes.push({ ...entryBase, tipo: "cultivo" });
                }
            });

            setProcedimientosPendientes(pendientes);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error("Error axios procedimientos:", {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                });
            } else {
                console.error("Excepción procedimientos:", error);
            }
            setProcedimientosPendientes([]);
        }
    };

    const fetchProcedimientosBase = async () => {
        try {
            const res = await axios.get(`${API_BASE}/patologias/procedimientos-base`);
            setListaProcedimientosBase(res.data);
        } catch (error) {
            console.error("Error al obtener procedimientos base:", error);
            setListaProcedimientosBase([]);
        }
    };

    const marcarCultivoComoCargado = async (pendiente) => {
        if (!pendiente?.id_procedimiento_paciente) return;
        try {
            const resp = await fetch(`${API_BASE}/patologias/procedimientos/${pendiente.id_procedimiento_paciente}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cultivo: false }),
            });
            if (!resp.ok) {
                const text = await resp.text().catch(() => "");
                throw new Error(text || "No se pudo actualizar el cultivo");
            }
            await fetchProcedimientosPendientes();
            if (typeof onProcedimientosUpdate === "function") {
                onProcedimientosUpdate();
            }
        } catch (error) {
            console.error("Error marcando cultivo cargado:", error);
            alert(error?.message || "No se pudo marcar el cultivo como cargado.");
        }
    };

    // ----------------------------- Efectos -----------------------------
    useEffect(() => {
        if (!idPaciente) return;
        fetchProcedimientosPendientes();
        fetchProcedimientosBase();
    }, [idPaciente]);

    useEffect(() => {
        fetchPatologiasGuardadas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idPaciente]);

    useEffect(() => {
        setExpandedIndices([]);
    }, [listaPatologia.length]);

    // ---------------------------- Acciones -----------------------------
    const doDeletePatologia = async (id_patologia) => {
        try {
            const resp = await fetch(`${API_BASE}/patologias/${id_patologia}`, {
                method: "DELETE",
            });
            if (!resp.ok) {
                const txt = await resp.text().catch(() => "");
                console.error("Error al eliminar patología", txt);
                alert("No se pudo eliminar la patología.");
                return;
            }
            await fetchPatologiasGuardadas();
            await fetchProcedimientosPendientes();
            if (typeof onProcedimientosUpdate === "function") {
                onProcedimientosUpdate();
            }
        } catch (e) {
            console.error(e);
            alert("Error de red eliminando la patología.");
        }
    };

    const solicitarDeletePatologia = (id_patologia) => {
        abrirConfirm(
            "Eliminar patología",
            "¿Querés eliminar esta patología y todos sus archivos?",
            () => doDeletePatologia(id_patologia)
        );
    };

    const doDeleteArchivo = async (item, file) => {
        try {
            if (file.tipo === "foto") {
                const resp = await fetch(`${API_BASE}/patologias/fotos/${file.id}`, {
                    method: "DELETE",
                });
                if (!resp.ok) {
                    console.error("Error al eliminar foto");
                    alert("No se pudo eliminar la foto.");
                    return;
                }
            } else if (file.tipo === "pdf") {
                const resp = await fetch(`${API_BASE}/patologias/pdf/${item.id_patologia}`, {
                    method: "DELETE",
                });
                if (!resp.ok) {
                    console.error("Error al eliminar PDF");
                    alert("No se pudo eliminar el PDF.");
                    return;
                }
                // Forzamos refresco de enlace del PDF
                setCacheBust(Date.now());
            }
            await fetchPatologiasGuardadas();
        } catch (e) {
            console.error(e);
            alert("Error de red al eliminar archivo.");
        }
    };

    const solicitarDeleteArchivo = (item, file) => {
        const what = file.tipo === "foto" ? "la FOTO" : "el PDF";
        abrirConfirm(
            "Eliminar archivo",
            `¿Querés eliminar ${what}?`,
            () => doDeleteArchivo(item, file)
        );
    };

    const toggleEditar = (idx, flag) => {
        setListaPatologia((prev) => prev.map((p, i) => (i === idx ? { ...p, editando: flag } : p)));
    };

    const updateEditField = (idx, field, value) => {
        setListaPatologia((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
    };

    const handleSaveEdit = async (idx) => {
        setSavingIdx(idx);
        const item = listaPatologia[idx];
        const formData = new FormData();
        formData.append("fecha", item.fechaEdit);
        formData.append("informe_texto", item.descripcionEdit || "");
        if (item.nuevoPdf) {
            formData.append("informe_pdf", item.nuevoPdf);
        }
        try {
            const resp = await fetch(`${API_BASE}/patologias/${item.id_patologia}`, {
                method: "PUT",
                body: formData,
            });
            if (!resp.ok) {
                console.error("Error al actualizar patología");
                alert("No se pudo actualizar la patología.");
                return;
            }
            await fetchPatologiasGuardadas();
            if (item.nuevoPdf) setCacheBust(Date.now());
            toggleEditar(idx, false);
        } catch (e) {
            console.error(e);
            alert("Error de red actualizando la patología.");
        } finally {
            setSavingIdx(null);
        }
    };

    // ----------------------------- Render -----------------------------
    const tienePendPat = pendientesPatologia.length > 0;
    const tienePendCult = pendientesCultivo.length > 0;

    return (
        <div className="max-w-4xl mx-auto w-full px-4">
            {/* Header */}
            <div
                className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 border border-slate-800/70 px-5 py-4 hover:from-slate-800/90 hover:to-slate-950/90 cursor-pointer flex items-center justify-between text-slate-100 font-semibold transition-shadow shadow-xl mb-4"
                onClick={() => setMostrarPatologia(!mostrarPatologia)}
            >
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-2 text-slate-100 text-lg font-semibold">
                        <PiMicroscopeLight className="text-emerald-300" />
                        Patología y cultivos
                    </span>
                    {(tienePendPat || tienePendCult) && (
                        <div className="flex items-center gap-2 text-xs">
                            {tienePendPat && (
                                <span className="rounded-full bg-amber-500/15 border border-amber-400/40 px-3 py-1 text-amber-200/90 uppercase tracking-[0.18em]">
                                    Patología pendiente
                                </span>
                            )}
                            {tienePendCult && (
                                <span className="rounded-full bg-sky-500/15 border border-sky-400/40 px-3 py-1 text-sky-200/90 uppercase tracking-[0.18em]">
                                    Cultivo pendiente
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-emerald-300 text-lg">{mostrarPatologia ? <FaMinus /> : <FaPlus />}</span>
                </div>
            </div>

            {mostrarPatologia && (
                <div className="p-6 bg-slate-900/75 border border-slate-700/60 rounded-3xl mb-6 text-sm shadow-2xl backdrop-blur flex flex-col gap-4">

                    <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-400">Pendientes</p>
                        {pendientesPatologia.length === 0 && pendientesCultivo.length === 0 ? (
                            <p className="mt-2 text-xs text-slate-400">
                                No hay pendientes de patología ni de cultivos.
                            </p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {pendientesPatologia.map((pendiente, idx) => {
                                    const fechaLabel = pendiente?.fecha ? formatearFecha(pendiente.fecha) : null;
                                    const tecnicaTexto = getProcedimientoTecnica(pendiente);
                                    return (
                                        <button
                                            key={`pat-pendiente-${pendiente.id_procedimiento_paciente}-${idx}`}
                                            type="button"
                                            onClick={() => abrirModalPatologiaPendiente(pendiente)}
                                            className="w-full rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-3 py-2 text-left transition hover:border-yellow-300/60 hover:bg-yellow-500/20"
                                        >
                                            <span className="text-[0.6rem] uppercase tracking-[0.25em] text-yellow-200/80 block">
                                                Patología pendiente
                                            </span>
                                            <span className="block text-sm font-semibold text-slate-100">
                                                {getProcedimientoNombre(pendiente)}
                                            </span>
                                            {tecnicaTexto ? (
                                                <span className="block text-xs text-slate-200/80">
                                                    {tecnicaTexto}
                                                </span>
                                            ) : null}
                                            {fechaLabel && (
                                                <span className="block text-xs text-slate-300/90">
                                                    {fechaLabel}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                                {pendientesCultivo.map((pendiente, idx) => {
                                    const fechaLabel = pendiente?.fecha ? formatearFecha(pendiente.fecha) : null;
                                    const tecnicaTexto = getProcedimientoTecnica(pendiente);
                                    return (
                                        <button
                                            key={`cultivo-pendiente-${pendiente.id_procedimiento_paciente}-${idx}`}
                                            type="button"
                                            onClick={() => abrirModalPatologiaPendiente(pendiente, "cultivo")}
                                            className="w-full rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-left transition hover:border-sky-300/60 hover:bg-sky-500/20"
                                        >
                                            <span className="text-[0.6rem] uppercase tracking-[0.25em] text-sky-200/80 block">
                                                Cultivo pendiente
                                            </span>
                                            <span className="block text-sm font-semibold text-slate-100">
                                                {getProcedimientoNombre(pendiente)}
                                            </span>
                                            {tecnicaTexto ? (
                                                <span className="block text-xs text-slate-200/80">
                                                    {tecnicaTexto}
                                                </span>
                                            ) : null}
                                            {fechaLabel && (
                                                <span className="block text-xs text-slate-300/90">
                                                    {fechaLabel}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Barra de acciones patología: ver archivos cargados y cargar sin relación */}
                    <div className="rounded-xl border border-slate-600/40 bg-slate-800/80 backdrop-blur px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-slate-200 shadow-sm">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-600/40 bg-slate-900/60 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition"
                            onClick={() => setMostrarArchivosCargados(!mostrarArchivosCargados)}
                            title="Ver archivos cargados"
                        >
                            <MdPhotoLibrary />
                            <span>Ver archivos cargados ({listaPatologia.length})</span>
                            {mostrarArchivosCargados ? <FiChevronDown /> : <FiChevronRight />}
                        </button>

                        <button
                            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-emerald-400/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-400/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 transition shadow-sm"
                            onClick={() => {
                                setPendienteEnModal(null);
                                setModalDefaults({ relId: null, sinRelacion: true });
                                setModalKey((k) => k + 1);
                                setModalNuevoAbierto(true);
                            }}
                            title="Cargar patología que no está asociada a un procedimiento pendiente"
                        >
                            <span className="text-lg">＋</span>
                            <span>Cargar patología</span>
                        </button>
                    </div>

                    {/* Lista de patologías */}
                    {mostrarArchivosCargados && listaPatologia.length > 0 && (
                        <div className="mt-4 border-t border-slate-700/40 pt-4 text-slate-200">
                            <ul className="space-y-3">
                                {listaPatologia.map((item, index) => {
                                    const isExpanded = expandedIndices.includes(index);
                                    const archivosListado = Array.isArray(item.archivos) ? item.archivos : [];
                                    const hayFotos = archivosListado.some((f) => /(jpe?g|png)$/i.test(f.url || ""));
                                    const resumenNombre = item.procedimiento_nombre || "";
                                    const resumenTecnica = item.procedimiento_tecnica || "";
                                    const fechaCirugiaTexto = item.fechaProcedimiento ? formatearFecha(item.fechaProcedimiento) : null;
                                    const tipoRegistro = (item.tipoRegistro || item.tipo_registro || "patologia").toLowerCase();

                                    return (
                                        <li
                                            key={item.id_patologia ?? index}
                                            className={`px-4 py-4 rounded-2xl shadow-lg ${
                                                item.editando
                                                    ? "bg-slate-900/85 border border-emerald-500/40 text-slate-100"
                                                    : "bg-slate-900/85 border border-slate-700/40 text-slate-100"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    {item.editando ? (
                                                        <div className="flex flex-col gap-3 text-sm text-slate-200">
                                                            <div className="flex flex-wrap gap-3">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-xs uppercase tracking-wide text-slate-300">Fecha</span>
                                                                    <DateField
                                                                        value={formatearFechaParaInput(item.fechaEdit)}
                                                                        onChange={(val) => updateEditField(index, "fechaEdit", val)}
                                                                        className="rounded px-3 py-2 text-sm bg-slate-900/80 text-slate-100 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs uppercase tracking-wide text-slate-300">Informe</span>
                                                                <textarea
                                                                    value={item.descripcionEdit}
                                                                    onChange={(e) => updateEditField(index, "descripcionEdit", e.target.value)}
                                                                    className="w-full rounded-lg bg-slate-900/85 text-slate-100 text-sm px-3 py-3 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-y shadow-inner"
                                                                    rows={4}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs uppercase tracking-wide text-slate-300">Reemplazar PDF (opcional)</span>
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    onChange={(e) => updateEditField(index, "nuevoPdf", e.target.files?.[0] || null)}
                                                                    className="file:bg-slate-900/80 file:border file:border-sky-400/70 file:text-sky-300 text-slate-300 file:px-3 file:py-1 file:rounded file:text-sm"
                                                                />
                                                            </div>
                                                            {archivosListado.length > 0 && (
                                                                <div className="pt-2 border-t border-slate-700/40">
                                                                    <p className="text-sm text-sky-300 mb-2">Archivos adjuntos</p>
                                                                    <ul className="list-disc ml-5 text-sm space-y-1">
                                                                        {archivosListado.map((file, i) => {
                                                                            const url =
                                                                                file.tipo === "pdf" && cacheBust
                                                                                    ? `${file.url}${file.url.includes("?") ? "&" : "?"}v=${cacheBust}`
                                                                                    : file.url;
                                                                            return (
                                                                                <li key={`${file.tipo}-${file.id}-${i}`} className="flex items-center gap-2">
                                                                                    <a
                                                                                        href={url}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-sky-300 underline"
                                                                                    >
                                                                                        {file.nombre}
                                                                                    </a>
                                                                                    <button
                                                                                        onClick={() => solicitarDeleteArchivo(item, file)}
                                                                                        className="text-slate-200 hover:text-rose-300 text-xs p-1"
                                                                                        title={`Eliminar ${file.tipo?.toUpperCase?.() || "archivo"}`}
                                                                                    >
                                                                                        <FiTrash2 />
                                                                                    </button>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {hayFotos && (
                                                                <div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const fotosDelItem = archivosListado
                                                                                .filter((f) => /(jpe?g|png)$/i.test(f.url || ""))
                                                                                .map((f, i) => ({ nombre: f.nombre || `Foto ${i + 1}`, url: f.url }));
                                                                            if (fotosDelItem.length === 0) return;
                                                                            setFotosSeleccionadas(fotosDelItem);
                                                                            setModalAbierto(true);
                                                                        }}
                                                                        className="inline-flex items-center gap-2 border border-slate-600/50 text-slate-200 hover:text-slate-50 hover:bg-slate-800/80 px-3 py-1 rounded-lg text-xs"
                                                                        title="Ver fotos de esta patología"
                                                                    >
                                                                        <MdPhotoLibrary />
                                                                        <span>Ver todas las fotos</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="flex w-full items-center gap-3 text-left text-slate-100 font-semibold bg-slate-800/90 border border-slate-700/60 rounded-xl px-4 py-3 hover:border-slate-500 transition"
                                                                onClick={() => {
                                                                    setExpandedIndices((prev) =>
                                                                        prev.includes(index)
                                                                            ? prev.filter((idx) => idx !== index)
                                                                            : [...prev, index]
                                                                    );
                                                                }}
                                                                aria-label={isExpanded ? "Colapsar detalle" : "Expandir detalle"}
                                                            >
                                                                <span className="text-slate-300 text-sm font-medium whitespace-nowrap">
                                                                    {fechaCirugiaTexto || formatearFecha(item.fecha)}
                                                                </span>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="block text-sm font-semibold text-sky-200 truncate">
                                                                        {(resumenTecnica || resumenNombre || "").trim() || "—"}
                                                                    </span>
                                                                </div>
                                                                <span
                                                                    className={`ml-3 text-[11px] uppercase tracking-[0.2em] ${
                                                                        tipoRegistro === "cultivo"
                                                                            ? "text-sky-200"
                                                                            : "text-emerald-200"
                                                                    }`}
                                                                >
                                                                    {tipoRegistro === "cultivo" ? "Cultivo" : "Patología"}
                                                                </span>
                                                                <span className="ml-auto flex items-center justify-center text-sky-300">
                                                                    {isExpanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
                                                                </span>
                                                            </button>
                                                            {isExpanded && (
                                                                <div className="mt-3 space-y-3">
                                                                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                                                                        {fechaCirugiaTexto && (
                                                                            <span>
                                                                                Cirugía: {fechaCirugiaTexto}
                                                                            </span>
                                                                        )}
                                                                        <span>
                                                                            {tipoRegistro === "cultivo" ? "Cultivo cargado" : "Patología: "}
                                                                        </span>
                                                                        <span>
                                                                             {formatearFecha(item.fecha)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-slate-900/75 border border-slate-700/50 rounded-xl px-4 py-3 shadow-inner">
                                                                        <span className="block text-xs uppercase tracking-wide text-slate-300/80 mb-1">Informe</span>
                                                                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                                                            {item.descripcion?.trim() ? item.descripcion : "Sin informe cargado."}
                                                                        </p>
                                                                    </div>
                                                                    {archivosListado.length > 0 && (
                                                                        <div className="bg-slate-900/70 border border-slate-700/40 rounded-xl px-4 py-3 shadow-inner">
                                                                            <span className="block text-xs uppercase tracking-wide text-slate-300/80 mb-1">Archivos adjuntos</span>
                                                                            <ul className="space-y-1 text-sm">
                                                                                {archivosListado.map((file, i) => {
                                                                                    const url =
                                                                                        file.tipo === "pdf" && cacheBust
                                                                                            ? `${file.url}${file.url.includes("?") ? "&" : "?"}v=${cacheBust}`
                                                                                            : file.url;
                                                                                    return (
                                                                                        <li key={`${file.tipo}-${file.id}-${i}`} className="flex items-center gap-2">
                                                                                            <a
                                                                                                href={url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-sky-300 underline"
                                                                                            >
                                                                                                {file.nombre}
                                                                                            </a>
                                                                                        </li>
                                                                                    );
                                                                                })}
                                                                            </ul>
                                                                            <p className="mt-2 text-xs text-slate-400">Para eliminar archivos, entrá a editar.</p>
                                                                        </div>
                                                                    )}
                                                                    {hayFotos && (
                                                                        <div>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const fotosDelItem = archivosListado
                                                                                        .filter((f) => /(jpe?g|png)$/i.test(f.url || ""))
                                                                                        .map((f, i) => ({ nombre: f.nombre || `Foto ${i + 1}`, url: f.url }));
                                                                                    if (fotosDelItem.length === 0) return;
                                                                                    setFotosSeleccionadas(fotosDelItem);
                                                                                    setModalAbierto(true);
                                                                                }}
                                                                                className="inline-flex items-center gap-2 border border-slate-600/50 text-slate-200 hover:text-slate-50 hover:bg-slate-800/80 px-3 py-1 rounded-lg text-xs"
                                                                                title="Ver fotos de esta patología"
                                                                            >
                                                                                <MdPhotoLibrary />
                                                                                <span>Ver todas las fotos</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                                                    {!item.editando ? (
                                                        <>
                                                            <button
                                                                className="text-slate-200 hover:text-sky-300 text-xs p-1"
                                                                title="Editar patología"
                                                                onClick={() => {
                                                                    toggleEditar(index, true);
                                                                    setExpandedIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
                                                                }}
                                                            >
                                                                <FiEdit />
                                                            </button>
                                                            <button
                                                                className="text-slate-200 hover:text-rose-300 text-xs p-1"
                                                                title="Eliminar patología"
                                                                onClick={() => solicitarDeletePatologia(item.id_patologia)}
                                                            >
                                                                <FiTrash2 />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleSaveEdit(index)}
                                                                disabled={savingIdx === index}
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition border ${
                                                                    savingIdx === index
                                                                        ? "opacity-50 cursor-not-allowed border-emerald-600/40 text-emerald-600"
                                                                        : "border-emerald-400/70 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-400/20 hover:border-emerald-300 shadow-sm"
                                                                }`}
                                                                title="Guardar cambios"
                                                            >
                                                                <MdSave size={18} />
                                                                <span className="text-sm">Guardar</span>
                                                            </button>
                                                            <button
                                                                onClick={() => toggleEditar(index, false)}
                                                                disabled={savingIdx === index}
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition border ${
                                                                    savingIdx === index
                                                                        ? "opacity-50 cursor-not-allowed border-slate-600/50 text-slate-500"
                                                                        : "border-slate-600/60 text-slate-200 hover:bg-slate-800"
                                                                }`}
                                                                title="Cancelar edición"
                                                            >
                                                                <MdCancel size={18} />
                                                                <span className="text-sm">Salir</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {mostrarArchivosCargados && listaPatologia.length === 0 && (
                        <div className="mt-6 border-t border-slate-700/40 pt-6 text-slate-500">
                            <p className="italic">No hay archivos cargados todavía. Usá “Cargar patología”.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modales */}
            <ModalVisor
                abierto={modalAbierto}
                onClose={() => setModalAbierto(false)}
                fotos={fotosSeleccionadas}
            />
            <ModalPatologiaNueva
                key={modalKey}
                open={modalNuevoAbierto}
                onClose={() => {
                    setModalNuevoAbierto(false);
                    setPendienteEnModal(null);
                }}
                pacienteId={idPaciente}
                procedimientosPendientes={
                    pendienteEnModal?.item
                        ? [pendienteEnModal.item]
                        : pendientesPatologia
                }
                procedimientosBase={listaProcedimientosBase}
                tipoRegistroDefault={pendienteEnModal?.tipo || "patologia"}
                onSaved={async () => {
                    await fetchPatologiasGuardadas();
                    if (pendienteEnModal?.tipo === "cultivo" && pendienteEnModal?.item) {
                        await marcarCultivoComoCargado(pendienteEnModal.item);
                    } else {
                        await fetchProcedimientosPendientes();
                        if (typeof onProcedimientosUpdate === "function") {
                            onProcedimientosUpdate();
                        }
                    }
                    setPendienteEnModal(null);
                }}
                defaultRelacionadoId={modalDefaults.relId}
                defaultSinRelacion={modalDefaults.sinRelacion}
                lockRelacion={Boolean(pendienteEnModal?.item)}
            />
            {confirmOpen && (
                <ModalMensaje
                    tipo="confirmar_borrado"
                    titulo={confirmTitulo}
                    mensaje={confirmMensaje}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={() => {
                        const fn = confirmActionRef.current;
                        setConfirmOpen(false);
                        if (typeof fn === "function") fn();
                    }}
                />
            )}
        </div>
    );
}

export default Patologia;
