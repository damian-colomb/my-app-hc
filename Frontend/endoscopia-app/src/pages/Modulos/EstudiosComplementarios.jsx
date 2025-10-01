// ============================================
// EstudiosComplementarios.jsx
// Página de gestión de exámenes complementarios:
// Laboratorio, Imágenes y Otros estudios
// ============================================

// ----------------------------
// Imports
// ----------------------------
import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { FaFlask, FaVial, FaFileAlt, FaPlus, FaMinus } from "react-icons/fa";
import { FiEdit, FiTrash2, FiSave } from "react-icons/fi";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import ModalListaEditable from "../../components/ModalListaEditable";
import ModalMensaje from "../../components/ModalMensaje";
import { SelectConCrud } from "./elementosPartes/Campos.jsx";

// Pequeño icono RX en SVG para evitar dependencias problemáticas
const RxIcon = ({ className = "" }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className={className}
    >
        {/* Marco del visor */}
        <rect x="3" y="3" width="18" height="18" rx="2.5" ry="2.5" strokeWidth="1.8" />
        {/* Cabecera del visor */}
        <rect x="3" y="3" width="18" height="3.5" fill="currentColor" opacity="0.25" />
        {/* Líneas simulando costillas */}
        <path d="M7 11h10M6.5 13.5h11M7 16h10" strokeWidth="1.6" strokeLinecap="round" />
        {/* Columna/esternón */}
        <path d="M12 9v8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);


// ----------------------------
// Constants
// ----------------------------

const EstudiosComplementarios = ({ idPaciente }) => {
    
    // ----------------------------
    // Refs
    // ----------------------------
    const fileInputRefLab = useRef(null);
    const fileInputRefImg = useRef(null);
    const fileInputRefOtro = useRef(null);

    // ----------------------------
    // State declarations
    // ----------------------------
    // Catálogo de tipos de laboratorio desde backend
    // Estado para el modal genérico
    const [modal, setModal] = useState(null);
    const [catalogoLaboratorios, setCatalogoLaboratorios] = useState([]);
    const [catalogoImagenes, setCatalogoImagenes] = useState([]);
    const [catalogoOtrosEstudios, setCatalogoOtrosEstudios] = useState([]);
    // Estado para laboratorios, imágenes y otros desde backend
    const [laboratorios, setLaboratorios] = useState([]);
    const [imagenes, setImagenes] = useState([]);
    const [otrosEstudios, setOtrosEstudios] = useState([]);




    // ----------------------------
    // Effects: cargar datos iniciales
    // ----------------------------
    // useEffect para cargar laboratorios, imágenes y otros desde backend
    useEffect(() => {
        if (!idPaciente) return;
        axios.get(`/api/examenes/laboratorio/${idPaciente}`)
            .then((response) => {
                setLaboratorios(ordenarPorFechaDesc(response.data));
            })
            .catch((error) => {
                console.error("Error al cargar laboratorios:", error);
            });

        axios.get(`/api/examenes/imagenes/${idPaciente}`)
            .then(res => setImagenes(ordenarPorFechaDesc(res.data)))
            .catch(err => console.error("Error al cargar imágenes:", err));
        axios.get(`/api/examenes/otros/${idPaciente}`)
            .then(res => setOtrosEstudios(ordenarPorFechaDesc(res.data)))
            .catch(err => console.error("Error al cargar otros estudios:", err));
    }, [idPaciente]);
    
    // ----------------------------
    // Effects: cargar catálogos
    // ----------------------------
    // Cargar catálogos de laboratorios, imágenes y otros (tipos)
    useEffect(() => {
        axios.get('/api/bases/laboratorio/')
            .then(res => setCatalogoLaboratorios(res.data))
            .catch(err => console.error("Error al cargar catálogo de laboratorio:", err));
        axios.get('/api/bases/imagenes/')
            .then(res => setCatalogoImagenes(res.data))
            .catch(err => console.error("Error al cargar catálogo de imágenes:", err));
        axios.get('/api/bases/otros/')
            .then(res => setCatalogoOtrosEstudios(res.data))
            .catch(err => console.error("Error al cargar catálogo de otros estudios:", err));
    }, []);
    
    //    // Estado para los archivos adjuntos por bloque
    //    const [archivosAdjuntos, setArchivosAdjuntos] = useState({});

    const    [mostrarLaboratorio, setMostrarLaboratorio] = useState(false);
    const [mostrarImagenes, setMostrarImagenes] = useState(false);
    const [mostrarOtros, setMostrarOtros] = useState(false);

    // Estado para edición de laboratorio
    const [editandoIndice, setEditandoIndice] = useState(null);

    // Estados para edición de imágenes y otros
    const [editandoIndiceImg, setEditandoIndiceImg] = useState(null);
    const [editandoIndiceOtro, setEditandoIndiceOtro] = useState(null);

    // Las opciones de subtipo para laboratorio e imágenes serán cargadas desde el backend próximamente.
    const [mostrarEstudios, setMostrarEstudios] = useState(false);
    // Estado para mostrar todos los estudios de cada tipo
    const [mostrarTodos, setMostrarTodos] = useState({});

    // Expand/collapse state for description line clamp
    const [expandedLabIndices, setExpandedLabIndices] = useState([]);
    const [expandedImgIndices, setExpandedImgIndices] = useState([]);
    const [expandedOtroIndices, setExpandedOtroIndices] = useState([]);

    // Estados para el modal de lista editable
    const [mostrarModalLista, setMostrarModalLista] = useState(false);
    const [variableModal, setVariableModal] = useState("");
    const [tituloModal, setTituloModal] = useState("");

    // Estados de nuevo estudio de laboratorio
    const [nuevoFechaLab, setNuevoFechaLab] = useState("");
    const [nuevoIdLaboratorio, setNuevoIdLaboratorio] = useState("");
    const [nuevaDescLab, setNuevaDescLab] = useState("");
    const [archivoLab, setArchivoLab] = useState(null);

    // Estados de nuevo estudio de imagen
    const [nuevoFechaImg, setNuevoFechaImg] = useState("");
    const [nuevoIdImagen, setNuevoIdImagen] = useState("");
    const [nuevaDescImg, setNuevaDescImg] = useState("");
    const [archivoImg, setArchivoImg] = useState(null);

    // Estados de nuevo estudio otros
    const [nuevoFechaOtro, setNuevoFechaOtro] = useState("");
    const [nuevoIdOtro, setNuevoIdOtro] = useState("");
    const [nuevaDescOtro, setNuevaDescOtro] = useState("");
    const [archivoOtro, setArchivoOtro] = useState(null);
    const [isSubmittingLab, setIsSubmittingLab] = useState(false);
    const [isSubmittingImg, setIsSubmittingImg] = useState(false);
    const [isSubmittingOtro, setIsSubmittingOtro] = useState(false);
    const [isDeletingLabId, setIsDeletingLabId] = useState(null);
    const [isDeletingImgId, setIsDeletingImgId] = useState(null);
    const [isDeletingOtroId, setIsDeletingOtroId] = useState(null);
    const [isSavingLab, setIsSavingLab] = useState(false);
    const [isSavingImg, setIsSavingImg] = useState(false);
    const [isSavingOtro, setIsSavingOtro] = useState(false);

    const laboratorioOptions = useMemo(() => (
        (Array.isArray(catalogoLaboratorios) ? catalogoLaboratorios : [])
            .map((item) => ({
                id: item?.id != null ? String(item.id) : "",
                label: item?.laboratorio ?? item?.nombre ?? "",
            }))
            .filter((opt) => opt.id && opt.label)
    ), [catalogoLaboratorios]);

    const imagenOptions = useMemo(() => (
        (Array.isArray(catalogoImagenes) ? catalogoImagenes : [])
            .map((item) => ({
                id: item?.id != null ? String(item.id) : "",
                label: item?.imagen ?? item?.nombre ?? "",
            }))
            .filter((opt) => opt.id && opt.label)
    ), [catalogoImagenes]);

    const otrosOptions = useMemo(() => (
        (Array.isArray(catalogoOtrosEstudios) ? catalogoOtrosEstudios : [])
            .map((item) => ({
                id: item?.id != null ? String(item.id) : "",
                label: item?.estudio ?? item?.nombre ?? "",
            }))
            .filter((opt) => opt.id && opt.label)
    ), [catalogoOtrosEstudios]);

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
        return (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) ? valor : "";
    };

    const formatearFechaParaMostrar = (valor) => {
        const fecha = parseFecha(valor);
        if (fecha) {
            try {
                return fecha.toLocaleDateString("es-AR");
            } catch (error) {
                console.warn("No se pudo formatear la fecha", error);
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
                            // algunos navegadores no permiten showPicker; ignoramos
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
                onChange={(e) => {
                    onChange && onChange(e.target.value, e);
                }}
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

    const ordenarPorFechaDesc = (lista = []) => (
        [...lista].sort((a, b) => {
            const fechaA = parseFecha(a?.fecha);
            const fechaB = parseFecha(b?.fecha);
            const timeA = fechaA ? fechaA.getTime() : Number.NEGATIVE_INFINITY;
            const timeB = fechaB ? fechaB.getTime() : Number.NEGATIVE_INFINITY;
            return timeB - timeA;
        })
    );

    // ----------------------------
    // Handlers: Crear estudios
    // ----------------------------
    // Función para crear un laboratorio
    const crearLaboratorio = async () => {
        if (isSubmittingLab) return;
        if (!idPaciente) {
            console.error("crearLaboratorio: falta idPaciente");
            setModal({
                tipo: "error",
                titulo: "Paciente no seleccionado",
                mensaje: "Seleccioná un paciente antes de cargar estudios de laboratorio.",
                onClose: () => setModal(null),
            });
            return;
        }
        if (!nuevoIdLaboratorio) {
            setModal({
                tipo: "error",
                titulo: "Laboratorio requerido",
                mensaje: "Elegí un tipo de laboratorio antes de guardar.",
                onClose: () => setModal(null),
            });
            return;
        }
        if (!nuevoFechaLab) {
            setModal({
                tipo: "error",
                titulo: "Fecha requerida",
                mensaje: "Ingresá la fecha del estudio de laboratorio.",
                onClose: () => setModal(null),
            });
            return;
        }
        setIsSubmittingLab(true);
        try {
            const formData = new FormData();
            formData.append("id_paciente", String(idPaciente));
            formData.append("fecha", nuevoFechaLab);
            formData.append("id_laboratorio", String(nuevoIdLaboratorio));
            formData.append("descripcion", nuevaDescLab);
            if (archivoLab) formData.append("archivo", archivoLab);

            if (import.meta.env && import.meta.env.DEV) {
                console.debug("crearLaboratorio payload", Object.fromEntries(formData.entries()));
            }

            const res = await axios.post(
                '/api/examenes/laboratorio',
                formData
            );
            setLaboratorios(prev => ordenarPorFechaDesc([res.data, ...prev]));
            setNuevoFechaLab("");
            setNuevoIdLaboratorio("");
            setNuevaDescLab("");
            setArchivoLab(null);
            if (fileInputRefLab.current) fileInputRefLab.current.value = "";
        } catch (err) {
            const detalle = err?.response?.data?.detail;
            console.error("Error al crear laboratorio:", err.response?.data || err);
            if (detalle) {
                const mensaje = Array.isArray(detalle)
                    ? detalle.map(d => d?.msg).filter(Boolean).join(" \n")
                    : (typeof detalle === "string" ? detalle : JSON.stringify(detalle));
                setModal({
                    tipo: "error",
                    titulo: "No se pudo guardar",
                    mensaje: mensaje || "Revisá los campos obligatorios del laboratorio.",
                    onClose: () => setModal(null),
                });
            }
        } finally {
            setIsSubmittingLab(false);
        }
    };

    // Función para crear una imagen
    const crearImagen = async () => {
        if (isSubmittingImg) return;
        if (!idPaciente) {
            console.error("crearImagen: falta idPaciente");
            setModal({
                tipo: "error",
                titulo: "Paciente no seleccionado",
                mensaje: "Seleccioná un paciente antes de cargar estudios de imágenes.",
                onClose: () => setModal(null),
            });
            return;
        }
        if (!nuevoIdImagen) {
            setModal({
                tipo: "error",
                titulo: "Imagen requerida",
                mensaje: "Elegí un tipo de estudio de imágenes antes de guardar.",
                onClose: () => setModal(null),
            });
            return;
        }
        if (!nuevoFechaImg) {
            setModal({
                tipo: "error",
                titulo: "Fecha requerida",
                mensaje: "Ingresá la fecha del estudio de imágenes.",
                onClose: () => setModal(null),
            });
            return;
        }
        setIsSubmittingImg(true);
        try {
            const formData = new FormData();
            formData.append("id_paciente", String(idPaciente));
            formData.append("fecha", nuevoFechaImg);
            formData.append("id_imagen", String(nuevoIdImagen));
            formData.append("descripcion", nuevaDescImg);
            if (archivoImg) formData.append("archivo", archivoImg);

            if (import.meta.env && import.meta.env.DEV) {
                console.debug("crearImagen payload", Object.fromEntries(formData.entries()));
            }

            const res = await axios.post(
                '/api/examenes/imagenes',
                formData
            );
            setImagenes(prev => ordenarPorFechaDesc([res.data, ...prev]));
            setNuevoFechaImg("");
            setNuevoIdImagen("");
            setNuevaDescImg("");
            setArchivoImg(null);
            if (fileInputRefImg.current) fileInputRefImg.current.value = "";
        } catch (err) {
            const detalle = err?.response?.data?.detail;
            console.error("Error al crear imagen:", err.response?.data || err);
            if (detalle) {
                const mensaje = Array.isArray(detalle)
                    ? detalle.map(d => d?.msg).filter(Boolean).join(" \n")
                    : (typeof detalle === "string" ? detalle : JSON.stringify(detalle));
                setModal({
                    tipo: "error",
                    titulo: "No se pudo guardar",
                    mensaje: mensaje || "Revisá los campos obligatorios del estudio de imágenes.",
                    onClose: () => setModal(null),
                });
            }
        } finally {
            setIsSubmittingImg(false);
        }
    };

    // Función para crear otro estudio
    const crearOtro = async () => {
        if (isSubmittingOtro) return;
        if (!idPaciente) {
            console.error("crearOtro: falta idPaciente");
            setModal({
                tipo: "error",
                titulo: "Paciente no seleccionado",
                mensaje: "Seleccioná un paciente antes de cargar otros estudios.",
                onClose: () => setModal(null),
            });
            return;
        }
        if (!nuevoIdOtro) {
            setModal({
                tipo: "error",
                titulo: "Tipo de estudio requerido",
                mensaje: "Elegí un tipo de estudio antes de guardar.",
                onClose: () => setModal(null),
            });
            return;
        }
        if (!nuevoFechaOtro) {
            setModal({
                tipo: "error",
                titulo: "Fecha requerida",
                mensaje: "Ingresá la fecha del estudio.",
                onClose: () => setModal(null),
            });
            return;
        }
        setIsSubmittingOtro(true);
        try {
            const formData = new FormData();
            formData.append("id_paciente", String(idPaciente));
            formData.append("fecha", nuevoFechaOtro);
            formData.append("id_otro", String(nuevoIdOtro));
            formData.append("descripcion", nuevaDescOtro);
            if (archivoOtro) formData.append("archivo", archivoOtro);

            if (import.meta.env && import.meta.env.DEV) {
                console.debug("crearOtro payload", Object.fromEntries(formData.entries()));
            }

            const res = await axios.post(
                '/api/examenes/otros',
                formData
            );
            setOtrosEstudios(prev => ordenarPorFechaDesc([res.data, ...prev]));
            setNuevoFechaOtro("");
            setNuevoIdOtro("");
            setNuevaDescOtro("");
            setArchivoOtro(null);
            if (fileInputRefOtro.current) fileInputRefOtro.current.value = "";
        } catch (err) {
            const detalle = err?.response?.data?.detail;
            console.error("Error al crear otro estudio:", err.response?.data || err);
            if (detalle) {
                const mensaje = Array.isArray(detalle)
                    ? detalle.map(d => d?.msg).filter(Boolean).join(" \n")
                    : (typeof detalle === "string" ? detalle : JSON.stringify(detalle));
                setModal({
                    tipo: "error",
                    titulo: "No se pudo guardar",
                    mensaje: mensaje || "Revisá los campos obligatorios del estudio.",
                    onClose: () => setModal(null),
                });
            }
        } finally {
            setIsSubmittingOtro(false);
        }
    };

    // ----------------------------
    // Handlers: Recargar catálogo
    // ----------------------------
    // Refrescar catálogo luego de editar/agregar en el modal
    const recargarCatalogo = () => {
        if (variableModal === "laboratorio") {
            axios.get('/api/bases/laboratorio/')
            .then(res => setCatalogoLaboratorios(res.data))
            .catch(err => console.error("Error recargando catálogo laboratorio:", err));
        } else if (variableModal === "imagenes") {
            axios.get('/api/bases/imagenes/')
            .then(res => setCatalogoImagenes(res.data))
            .catch(err => console.error("Error recargando catálogo imágenes:", err));
        } else {
            axios.get('/api/bases/otros/')
            .then(res => setCatalogoOtrosEstudios(res.data))
            .catch(err => console.error("Error recargando catálogo otros estudios:", err));
        }
    };
    
    // ----------------------------
    // Render
    // ----------------------------
    return (
        <>
            <div className="max-w-4xl mx-auto w-full px-4">
                <div
                    className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 border border-slate-800/70 px-5 py-4 hover:from-slate-800/90 hover:to-slate-950/90 cursor-pointer flex items-center justify-between text-slate-100 font-semibold transition-shadow shadow-xl mb-4"
                    onClick={() => setMostrarEstudios(!mostrarEstudios)}
                >
                    <span className="flex items-center gap-2 text-slate-100 text-lg font-semibold">
                        <FaFlask className="text-sky-400" />
                        Estudios Complementarios
                    </span>
                    <span className="text-emerald-300 text-lg">
                        {mostrarEstudios ? <FaMinus /> : <FaPlus />}
                    </span>
                </div>

                {mostrarEstudios && (
                    <div className="p-6 bg-slate-900/75 border border-slate-700/60 rounded-3xl mb-6 text-sm shadow-2xl backdrop-blur flex flex-col gap-6">
                        {/* LABORATORIO */}
                        <div
                            className="rounded-xl border border-slate-500/25 bg-slate-800/90 px-4 py-3 cursor-pointer flex items-center justify-between text-slate-200 font-semibold shadow-sm"
                            onClick={() => setMostrarLaboratorio(!mostrarLaboratorio)}
                        >
                            <div className="flex items-center gap-2 text-sky-300">
                                <FaVial />
                                <span>Laboratorio</span>
                            </div>
                            <span className="text-emerald-300 text-lg">{mostrarLaboratorio ? "−" : "+"}</span>
                        </div>
                        {mostrarLaboratorio && (
                        <div className="border border-slate-500/20 rounded-2xl p-4 bg-slate-900/80 mb-6 shadow-lg flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-slate-300 text-sm uppercase tracking-wide">
                                <div className="text-sky-300 font-semibold">Laboratorio</div>
                            </div>
                            <div className="flex flex-col gap-3 text-sm text-slate-200">
                                <div className="flex items-center gap-2 w-full max-w-md">
                                    <SelectConCrud
                                        placeholder="Seleccionar laboratorio"
                                        selectClassName="bg-slate-800 border border-slate-600 text-slate-100"
                                        options={laboratorioOptions}
                                        value={nuevoIdLaboratorio ?? ""}
                                        onChange={(id) => setNuevoIdLaboratorio(id != null ? String(id) : "")}
                                        onOpenCrud={() => {
                                            setVariableModal("laboratorio");
                                            setTituloModal("Nuevo estudio de laboratorio");
                                            setMostrarModalLista(true);
                                        }}
                                        showCrud
                                        crudAlign="right"
                                        searchable
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <DateField
                                        value={nuevoFechaLab}
                                        onChange={(val) => setNuevoFechaLab(val)}
                                        className="bg-slate-800 text-slate-100 rounded-md px-3 py-2 w-32 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <button
                                        onClick={crearLaboratorio}
                                        disabled={isSubmittingLab}
                                        className={`border border-emerald-400/70 bg-emerald-500/15 text-emerald-200 px-3 py-2 rounded-lg hover:bg-emerald-400/20 hover:border-emerald-300 transition text-sm mt-auto shadow-sm
                                            ${isSubmittingLab ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span className="inline-flex items-center gap-1"><FiSave /> {isSubmittingLab ? "Guardando..." : "Guardar"}</span>
                                    </button>
                                </div>
                                <textarea
                                    placeholder="Descripción"
                                    className="bg-slate-800 text-slate-100 rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    rows={2}
                                    value={nuevaDescLab}
                                    onChange={e => setNuevaDescLab(e.target.value)}
                                />
                                <div className="mb-4">
                                    <label className="block text-slate-300 text-sm mb-1">Archivo (PDF o JPG)</label>
                                    <input
                                        ref={fileInputRefLab}
                                        type="file"
                                        accept=".pdf,.jpg"
                                        onChange={e => setArchivoLab(e.target.files[0])}
                                        className="file:bg-slate-900/80 file:border file:border-sky-400 file:text-sky-300 file:px-3 file:py-1 file:rounded file:cursor-pointer text-slate-300"
                                    />
                                </div>
                            </div>
                            {/* Listado de estudios de laboratorio */}
                            <ul className="space-y-2 mt-2">
                                {laboratorios.length > 0 ? (
                                    laboratorios.map((lab, i) => {
                                        const isEditing = editandoIndice === i;
                                        const expanded = expandedLabIndices.includes(i);
                                        const labName = catalogoLaboratorios.find(op => op.id === lab.id_laboratorio)?.laboratorio
                                            || lab.laboratorio_rel?.laboratorio
                                            || "";
                                        const slugLabName = (labName || "")
                                            .toLowerCase()
                                            .normalize("NFD")
                                            .replace(/[\u0300-\u036f]/g, "")
                                            .replace(/\s+/g, "_");
                                        const dateSlug = (formatearFechaParaInput(lab.fecha) || "").replace(/-/g, "_");

                                        if (isEditing) {
                                            return (
                                                <li key={lab.id || i} className="rounded-xl px-4 py-3 text-slate-100 border border-sky-500/50 bg-slate-900/65 shadow-sm">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex-1 min-w-[10rem]">
                                                                <SelectConCrud
                                                                    placeholder="Seleccionar laboratorio"
                                                                    options={laboratorioOptions}
                                                                    value={lab.id_laboratorio != null ? String(lab.id_laboratorio) : ""}
                                                                    onChange={(id) => {
                                                                        const copia = [...laboratorios];
                                                                        copia[i].id_laboratorio = id != null ? Number(id) : null;
                                                                        setLaboratorios(copia);
                                                                    }}
                                                                    onOpenCrud={() => {
                                                                        setVariableModal("laboratorio");
                                                                        setTituloModal("Nuevo estudio de laboratorio");
                                                                        setMostrarModalLista(true);
                                                                    }}
                                                                    showCrud
                                                                    crudAlign="right"
                                                                    selectClassName="bg-slate-800 border border-slate-600 text-slate-100"
                                                                    searchable
                                                                />
                                                            </div>
                                                            <DateField
                                                                value={formatearFechaParaInput(lab.fecha)}
                                                                onChange={(val) => {
                                                                    const copia = [...laboratorios];
                                                                    copia[i].fecha = val;
                                                                    setLaboratorios(ordenarPorFechaDesc(copia));
                                                                }}
                                                                className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                            />
                                                        </div>
                                                        <textarea
                                                            value={lab.descripcion || ""}
                                                            onChange={e => {
                                                                const copia = [...laboratorios];
                                                                copia[i].descripcion = e.target.value;
                                                                setLaboratorios(copia);
                                                            }}
                                                            className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                            rows={2}
                                                        />
                                                        <input
                                                            type="file"
                                                            accept=".pdf,.jpg"
                                                            onChange={e => {
                                                                const copia = [...laboratorios];
                                                                copia[i].nuevoArchivo = e.target.files[0];
                                                                setLaboratorios(copia);
                                                            }}
                                                            className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                disabled={isSavingLab}
                                                                className={`text-emerald-400 text-xs px-2 py-1 border border-emerald-400 rounded ${isSavingLab ? 'opacity-50 cursor-not-allowed' : 'hover:text-emerald-300'}`}
                                                                onClick={async () => {
                                                                    try {
                                                                        setIsSavingLab(true);
                                                                        const formData = new FormData();
                                                                        formData.append("fecha", lab.fecha);
                                                                        formData.append("id_laboratorio", lab.id_laboratorio);
                                                                        formData.append("descripcion", lab.descripcion || "");
                                                                        if (lab.nuevoArchivo) {
                                                                            formData.append("archivo", lab.nuevoArchivo);
                                                                        }
                                                                        await axios.put(`/api/examenes/laboratorio/${lab.id}`, formData);
                                                                        const response = await axios.get(`/api/examenes/laboratorio/${idPaciente}`);
                                                                        setLaboratorios(ordenarPorFechaDesc(response.data));
                                                                        setEditandoIndice(null);
                                                                    } catch (error) {
                                                                        console.error("Error al actualizar laboratorio", error);
                                                                    } finally {
                                                                        setIsSavingLab(false);
                                                                    }
                                                                }}
                                                            >
                                                                {isSavingLab ? 'Guardando...' : 'Guardar'}
                                                            </button>
                                                            <button
                                                                className="text-rose-300 hover:text-red-300 text-xs px-2 py-1 border border-rose-400/70 rounded"
                                                                onClick={() => setEditandoIndice(null)}
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        }

                                        return (
                                            <li key={lab.id || i} className="rounded-2xl px-4 py-4 text-slate-100 border border-slate-700/40 bg-slate-900/85 shadow-lg">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center gap-3 text-left text-slate-100 font-semibold bg-slate-800/90 border border-slate-700/60 rounded-xl px-4 py-3 hover:border-slate-500 transition"
                                                            onClick={() => {
                                                                setExpandedLabIndices(prev => (
                                                                    prev.includes(i)
                                                                        ? prev.filter(x => x !== i)
                                                                        : [...prev, i]
                                                                ));
                                                            }}
                                                            aria-label={expanded ? "Colapsar resultado" : "Expandir resultado"}
                                                        >
                                                            <span className="text-slate-300 text-sm font-medium whitespace-nowrap">{formatearFechaParaMostrar(lab.fecha)}</span>
                                                            <span className="text-sky-300 font-semibold truncate" title={labName}>
                                                                {labName || "Sin título"}
                                                            </span>
                                                            <span className="ml-auto flex items-center justify-center text-sky-300">
                                                                {expanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
                                                            </span>
                                                        </button>
                                                        {expanded && (
                                                            <div className="mt-3 space-y-2">
                                                                <div className="bg-slate-900/75 border border-slate-700/50 rounded-xl px-4 py-3 shadow-inner">
                                                                    <span className="block text-xs uppercase tracking-wide text-sky-300/80 mb-1">Resultado</span>
                                                                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                                                        {lab.descripcion?.trim() ? lab.descripcion : "Sin descripción"}
                                                                    </p>
                                                                </div>
                                                                {lab.ruta_archivo && (
                                                                    <a
                                                                        href={lab.ruta_archivo}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 underline"
                                                                    >
                                                                        {`${slugLabName}_${dateSlug}`}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                                                        <button
                                                            className="text-slate-100 hover:text-sky-300 text-xs p-1"
                                                            title="Editar"
                                                            onClick={() => setEditandoIndice(i)}
                                                        >
                                                            <FiEdit />
                                                        </button>
                                                        <button
                                                            className={`text-slate-100 text-xs p-1 ${isDeletingLabId === lab.id ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-300'}`}
                                                            title="Eliminar"
                                                            disabled={isDeletingLabId === lab.id}
                                                            onClick={() => {
                                                                if (isDeletingLabId) return;
                                                                setModal({
                                                                    tipo: "confirmar_borrado",
                                                                    titulo: "¿Eliminar laboratorio?",
                                                                    mensaje: "¿Estás seguro que querés eliminar este estudio de laboratorio? Esta acción no se puede deshacer.",
                                                                    onConfirm: async () => {
                                                                        try {
                                                                            setIsDeletingLabId(lab.id);
                                                                            await axios.delete(`/api/examenes/laboratorio/${lab.id}`);
                                                                            const response = await axios.get(`/api/examenes/laboratorio/${idPaciente}`);
                                                                            setLaboratorios(ordenarPorFechaDesc(response.data));
                                                                        } catch (err) {
                                                                            console.error("Error al eliminar laboratorio", err);
                                                                        } finally {
                                                                            setIsDeletingLabId(null);
                                                                            setModal(null);
                                                                        }
                                                                    },
                                                                    onClose: () => setModal(null),
                                                                });
                                                            }}
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })
                                ) : (
                                    <li className="text-slate-400 italic">No hay estudios de laboratorio cargados aún.</li>
                                )}
                            </ul>
                        </div>
                        )}
                        {/* IMÁGENES */}
                        <div
                            className="rounded-xl border border-slate-500/25 bg-slate-800/90 px-4 py-3 cursor-pointer flex items-center justify-between text-slate-200 font-semibold shadow-sm"
                            onClick={() => setMostrarImagenes(!mostrarImagenes)}
                        >
                            <div className="flex items-center gap-2 text-amber-200">
                                <RxIcon className="text-amber-200 h-[18px] w-[18px]" />
                                <span>Imágenes</span>
                            </div>
                            <span className="text-emerald-300 text-lg">{mostrarImagenes ? "−" : "+"}</span>
                        </div>
                        {mostrarImagenes && (
                        <div className="border border-slate-500/20 rounded-2xl p-4 bg-slate-900/80 mb-6 shadow-lg flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-slate-300 text-sm uppercase tracking-wide">
                                <div className="text-amber-200 font-semibold">Imágenes</div>
                            </div>
                            {/* Formulario para nueva imagen */}
                            <div className="flex flex-col gap-3 text-sm text-slate-200 mb-4">
                                <div className="flex items-center gap-2 w-full max-w-md">
                                    <SelectConCrud
                                        placeholder="Seleccionar imagen"
                                        options={imagenOptions}
                                        value={nuevoIdImagen ?? ""}
                                        onChange={(id) => setNuevoIdImagen(id != null ? String(id) : "")}
                                        onOpenCrud={() => {
                                            setVariableModal("imagenes");
                                            setTituloModal("Nuevo estudio de imagen");
                                            setMostrarModalLista(true);
                                        }}
                                        showCrud
                                        crudAlign="right"
                                        selectClassName="bg-slate-800 border border-slate-600 text-slate-100"
                                        searchable
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <DateField
                                        value={nuevoFechaImg}
                                        onChange={(val) => setNuevoFechaImg(val)}
                                        className="bg-slate-800 text-slate-100 rounded-md px-3 py-2 w-32 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <button
                                        onClick={crearImagen}
                                        disabled={isSubmittingImg}
                                        className={`border border-amber-400/70 bg-amber-400/10 text-amber-200 px-3 py-2 rounded-lg hover:bg-amber-400/15 hover:border-amber-300 transition text-sm mt-auto shadow-sm
                                            ${isSubmittingImg ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span className="inline-flex items-center gap-1"><FiSave /> {isSubmittingImg ? "Guardando..." : "Guardar"}</span>
                                    </button>
                                </div>
                                <textarea
                                    placeholder="Descripción"
                                    className="bg-slate-800 text-slate-100 rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    rows={2}
                                    value={nuevaDescImg}
                                    onChange={e => setNuevaDescImg(e.target.value)}
                                />
                                <input
                                    ref={fileInputRefImg}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setArchivoImg(e.target.files[0])}
                                    className="file:bg-slate-900/80 file:border file:border-amber-400/70 file:text-amber-200 file:px-3 file:py-1 file:rounded file:cursor-pointer text-slate-300"
                                />
                            </div>
                            {/* Listado de estudios de imágenes */}
                            <ul className="space-y-2 mt-2">
                                {imagenes && Array.isArray(imagenes) && imagenes.length > 0 ? (
                                    imagenes.map((img, idx) => {
                                        if (editandoIndiceImg === idx) {
                                            return (
                                                <li key={img.id || idx} className="rounded-2xl px-4 py-4 text-slate-100 border border-slate-700/40 bg-slate-900/85 shadow-lg">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex-1 min-w-[10rem]">
                                                                <SelectConCrud
                                                                    placeholder="Seleccionar imagen"
                                                                    options={imagenOptions}
                                                                    value={img.id_imagen != null ? String(img.id_imagen) : ""}
                                                                    onChange={(id) => {
                                                                        const copia = [...imagenes];
                                                                        copia[idx].id_imagen = id != null ? Number(id) : null;
                                                                        setImagenes(copia);
                                                                    }}
                                                                    onOpenCrud={() => {
                                                                        setVariableModal("imagenes");
                                                                        setTituloModal("Nuevo estudio de imagen");
                                                                        setMostrarModalLista(true);
                                                                    }}
                                                                    showCrud
                                                                    crudAlign="right"
                                                                    selectClassName="bg-slate-800 border border-slate-600 text-slate-100"
                                                                    searchable
                                                                />
                                                            </div>
                                                            <DateField
                                                                value={formatearFechaParaInput(img.fecha)}
                                                                onChange={(val) => {
                                                                    const copia = [...imagenes];
                                                                    copia[idx].fecha = val;
                                                                    setImagenes(ordenarPorFechaDesc(copia));
                                                                }}
                                                                className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400 w-fit"
                                                            />
                                                        </div>
                                                        <textarea
                                                            rows={2}
                                                            className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                            value={img.descripcion || ''}
                                                            onChange={e => {
                                                                const copia = [...imagenes];
                                                                copia[idx].descripcion = e.target.value;
                                                                setImagenes(copia);
                                                            }}
                                                        />
                                                        <input
                                                            type="file"
                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                            className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                            onChange={e => {
                                                                const copia = [...imagenes];
                                                                copia[idx].nuevoArchivo = e.target.files[0];
                                                                setImagenes(copia);
                                                            }}
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                disabled={isSavingImg}
                                                                className={`text-emerald-400 text-xs px-2 py-1 border border-emerald-400 rounded ${isSavingImg ? 'opacity-50 cursor-not-allowed' : 'hover:text-emerald-300'}`}
                                                                onClick={async () => {
                                                                    try {
                                                                        setIsSavingImg(true);
                                                                        const formData = new FormData();
                                                                        formData.append("fecha", imagenes[idx].fecha);
                                                                        formData.append("id_imagen", imagenes[idx].id_imagen);
                                                                        formData.append("descripcion", imagenes[idx].descripcion || "");
                                                                        if (imagenes[idx].nuevoArchivo) {
                                                                            formData.append("archivo", imagenes[idx].nuevoArchivo);
                                                                        }
                                                                        await axios.put(
                                                                            `/api/examenes/imagenes/${img.id}`,
                                                                            formData
                                                                        );
                                                                        const res = await axios.get(`/api/examenes/imagenes/${idPaciente}`);
                                                                        setImagenes(ordenarPorFechaDesc(res.data));
                                                                        setEditandoIndiceImg(null);
                                                                    } catch (e) {
                                                                        console.error("Error al actualizar imagen:", e);
                                                                    } finally {
                                                                        setIsSavingImg(false);
                                                                    }
                                                                }}
                                                            >{isSavingImg ? 'Guardando...' : 'Guardar'}</button>
                                                            <button
                                                                className="text-rose-300 hover:text-red-300 text-xs px-2 py-1 border border-rose-400/70 rounded"
                                                                onClick={() => setEditandoIndiceImg(null)}
                                                            >Cancelar</button>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        }
                                        const isExpanded = expandedImgIndices.includes(idx);
                                        const nombreImagen = catalogoImagenes.find(o => o.id === img.id_imagen)?.imagen || img.nombre || "";
                                        const slugImagen = (nombreImagen || "")
                                            .toLowerCase()
                                            .normalize("NFD")
                                            .replace(/[\u0300-\u036f]/g, "")
                                            .replace(/\s+/g, "_");
                                        const fechaSlug = (formatearFechaParaInput(img.fecha) || "").replace(/-/g, "_");
                                        return (
                                            <li key={img.id || idx} className="rounded-2xl px-4 py-4 text-slate-100 border border-slate-700/40 bg-slate-900/85 shadow-lg">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center gap-3 text-left text-slate-100 font-semibold bg-slate-800/90 border border-slate-700/60 rounded-xl px-4 py-3 hover:border-slate-500 transition"
                                                            onClick={() => {
                                                                setExpandedImgIndices(prev => (
                                                                    prev.includes(idx)
                                                                        ? prev.filter(x => x !== idx)
                                                                        : [...prev, idx]
                                                                ));
                                                            }}
                                                            aria-label={isExpanded ? "Colapsar informe" : "Expandir informe"}
                                                        >
                                                            <span className="text-slate-300 text-sm font-medium whitespace-nowrap">{formatearFechaParaMostrar(img.fecha)}</span>
                                                            <span className="text-amber-200 font-semibold truncate" title={nombreImagen}>
                                                                {nombreImagen || "Sin título"}
                                                            </span>
                                                            <span className="ml-auto flex items-center justify-center text-amber-200">
                                                                {isExpanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
                                                            </span>
                                                        </button>
                                                        {isExpanded && (
                                                            <div className="mt-3 space-y-2">
                                                                <div className="bg-slate-900/75 border border-slate-700/50 rounded-xl px-4 py-3 shadow-inner">
                                                                    <span className="block text-xs uppercase tracking-wide text-amber-200/80 mb-1">Informe</span>
                                                                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                                                        {img.descripcion?.trim() ? img.descripcion : "Sin descripción"}
                                                                    </p>
                                                                </div>
                                                                {img.ruta_archivo && (
                                                                    <a
                                                                        href={img.ruta_archivo}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-xs text-amber-200 hover:text-amber-100 underline"
                                                                    >
                                                                        {`${slugImagen}_${fechaSlug}`}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                                                        <button
                                                            className="text-slate-100 hover:text-amber-200 text-xs p-1"
                                                            title="Editar"
                                                            onClick={() => setEditandoIndiceImg(idx)}
                                                        >
                                                            <FiEdit />
                                                        </button>
                                                        <button
                                                            className={`text-slate-100 text-xs p-1 ${isDeletingImgId === img.id ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-300'}`}
                                                            title="Eliminar"
                                                            disabled={isDeletingImgId === img.id}
                                                            onClick={() => {
                                                                if (isDeletingImgId) return;
                                                                setModal({
                                                                    tipo: "confirmar_borrado",
                                                                    titulo: "¿Eliminar estudio de imágenes?",
                                                                    mensaje: "¿Estás seguro que querés eliminar este estudio? Esta acción no se puede deshacer.",
                                                                    onConfirm: async () => {
                                                                        try {
                                                                            setIsDeletingImgId(img.id);
                                                                            await axios.delete(`/api/examenes/imagenes/${img.id}`);
                                                                            const res = await axios.get(`/api/examenes/imagenes/${idPaciente}`);
                                                                            setImagenes(ordenarPorFechaDesc(res.data));
                                                                        } catch (err) {
                                                                            console.error("Error al eliminar imagen", err);
                                                                        } finally {
                                                                            setIsDeletingImgId(null);
                                                                            setModal(null);
                                                                        }
                                                                    },
                                                                    onClose: () => setModal(null),
                                                                });
                                                            }}
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })
                                ) : (
                                    <li className="text-slate-400 italic">No hay estudios de imágenes cargados aún.</li>
                                )}
                            </ul>
                        </div>
                        )}
                        {/* OTROS */}
                        <div
                            className="rounded-xl border border-slate-500/25 bg-slate-800/90 px-4 py-3 cursor-pointer flex items-center justify-between text-slate-200 font-semibold shadow-sm"
                            onClick={() => setMostrarOtros(!mostrarOtros)}
                        >
                            <div className="flex items-center gap-2 text-rose-300">
                                <FaFileAlt />
                                <span>Otros</span>
                            </div>
                            <span className="text-emerald-300 text-lg">{mostrarOtros ? "−" : "+"}</span>
                        </div>
                            {mostrarOtros && (
                            <div className="border border-slate-500/20 rounded-2xl p-4 bg-slate-900/80 mb-6 shadow-lg flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-slate-300 text-sm uppercase tracking-wide">
                                    <div className="text-rose-300 font-semibold">Otros</div>
                                </div>
                                {/* Formulario para nuevo otro estudio */}
                                <div className="flex flex-col gap-3 text-sm text-slate-200 mb-4">
                                <div className="flex items-center gap-2 w-full max-w-md">
                                    <SelectConCrud
                                        placeholder="Seleccionar estudio"
                                        options={otrosOptions}
                                        value={nuevoIdOtro ?? ""}
                                        onChange={(id) => setNuevoIdOtro(id != null ? String(id) : "")}
                                        onOpenCrud={() => {
                                            setVariableModal("otros");
                                            setTituloModal("Nuevo otro estudio");
                                            setMostrarModalLista(true);
                                        }}
                                        showCrud
                                        crudAlign="right"
                                        selectClassName="bg-slate-800 border border-slate-600 text-slate-100"
                                        searchable
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <DateField
                                        value={nuevoFechaOtro}
                                        onChange={(val) => setNuevoFechaOtro(val)}
                                        className="bg-slate-800 text-slate-100 rounded-md px-3 py-2 w-32 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <button
                                        onClick={crearOtro}
                                        disabled={isSubmittingOtro}
                                        className={`border border-rose-400/70 bg-rose-500/10 text-rose-200 px-3 py-2 rounded-lg hover:bg-rose-500/15 hover:border-rose-300 transition text-sm mt-auto shadow-sm
                                            ${isSubmittingOtro ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span className="inline-flex items-center gap-1"><FiSave /> {isSubmittingOtro ? "Guardando..." : "Guardar"}</span>
                                    </button>
                                </div>
                                <textarea
                                    placeholder="Descripción"
                                    className="bg-slate-800 text-slate-100 rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    rows={2}
                                    value={nuevaDescOtro}
                                    onChange={e => setNuevaDescOtro(e.target.value)}
                                />
                                <input
                                    ref={fileInputRefOtro}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setArchivoOtro(e.target.files[0])}
                                    className="file:bg-slate-900/80 file:border file:border-rose-400/70 file:text-rose-300 file:px-3 file:py-1 file:rounded file:cursor-pointer text-slate-300"
                                />
                                </div>
                                {/* Listado de otros estudios */}
                                <ul className="space-y-2 mt-2">
            {otrosEstudios.length > 0 ? (
                otrosEstudios.map((otro, idx) => {
                    const isEditing = editandoIndiceOtro === idx;
                    const isExpanded = expandedOtroIndices.includes(idx);
                    const estudioNombre = catalogoOtrosEstudios.find(o => o.id === otro.id_otro)?.estudio || "";
                                        const dateSlug = (formatearFechaParaInput(otro.fecha) || "").replace(/-/g, "_");

                    if (isEditing) {
                        return (
                            <li key={otro.id} className="rounded-2xl px-4 py-4 text-slate-100 border border-slate-700/40 bg-slate-900/85 shadow-lg">
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1 min-w-[10rem]">
                                            <SelectConCrud
                                                placeholder="Seleccionar estudio"
                                                options={otrosOptions}
                                                value={otro.id_otro != null ? String(otro.id_otro) : ""}
                                                onChange={(id) => {
                                                    const copia = [...otrosEstudios];
                                                    copia[idx].id_otro = id != null ? Number(id) : null;
                                                    setOtrosEstudios(copia);
                                                }}
                                                onOpenCrud={() => {
                                                    setVariableModal("otros");
                                                    setTituloModal("Nuevo otro estudio");
                                                    setMostrarModalLista(true);
                                                }}
                                                showCrud
                                                crudAlign="right"
                                                selectClassName="bg-slate-800 border border-slate-600 text-slate-100"
                                                searchable
                                            />
                                        </div>
                                        <DateField
                                            value={formatearFechaParaInput(otro.fecha)}
                                            onChange={(val) => {
                                                const copia = [...otrosEstudios];
                                                copia[idx].fecha = val;
                                                setOtrosEstudios(ordenarPorFechaDesc(copia));
                                            }}
                                            className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                        />
                                    </div>
                                    <textarea
                                        rows={2}
                                        className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                        value={otro.descripcion || ''}
                                        onChange={e => {
                                            const copia = [...otrosEstudios];
                                            copia[idx].descripcion = e.target.value;
                                            setOtrosEstudios(copia);
                                        }}
                                    />
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                        onChange={e => {
                                            const copia = [...otrosEstudios];
                                            copia[idx].nuevoArchivo = e.target.files[0];
                                            setOtrosEstudios(copia);
                                        }}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            disabled={isSavingOtro}
                                            className={`text-emerald-400 text-xs px-2 py-1 border border-emerald-400 rounded ${isSavingOtro ? 'opacity-50 cursor-not-allowed' : 'hover:text-emerald-300'}`}
                                            onClick={async () => {
                                                try {
                                                    setIsSavingOtro(true);
                                                    const fd = new FormData();
                                                    fd.append("fecha", otro.fecha);
                                                    fd.append("id_otro", otro.id_otro);
                                                    fd.append("descripcion", otro.descripcion || "");
                                                    if (otro.nuevoArchivo) fd.append("archivo", otro.nuevoArchivo);
                                                    await axios.put(`/api/examenes/otros/${otro.id}`, fd);
                                                    const res = await axios.get(`/api/examenes/otros/${idPaciente}`);
                                                    setOtrosEstudios(ordenarPorFechaDesc(res.data));
                                                    setEditandoIndiceOtro(null);
                                                } catch (e) {
                                                    console.error("Error al actualizar otro estudio:", e);
                                                } finally {
                                                    setIsSavingOtro(false);
                                                }
                                            }}
                                        >{isSavingOtro ? 'Guardando...' : 'Guardar'}</button>
                                        <button
                                            className="text-rose-300 hover:text-red-300 text-xs px-2 py-1 border border-rose-400/70 rounded"
                                            onClick={() => setEditandoIndiceOtro(null)}
                                        >Cancelar</button>
                                    </div>
                                </div>
                            </li>
                        );
                    }

                    return (
                        <li key={otro.id} className="rounded-2xl px-4 py-4 text-slate-100 border border-slate-700/40 bg-slate-900/85 shadow-lg">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 text-left text-slate-100 font-semibold bg-slate-800/90 border border-slate-700/60 rounded-xl px-4 py-3 hover:border-slate-500 transition"
                                        onClick={() => {
                                            setExpandedOtroIndices(prev => (
                                                prev.includes(idx)
                                                    ? prev.filter(x => x !== idx)
                                                    : [...prev, idx]
                                            ));
                                        }}
                                        aria-label={isExpanded ? "Colapsar detalle" : "Expandir detalle"}
                                    >
                                        <span className="text-slate-300 text-sm font-medium whitespace-nowrap">{formatearFechaParaMostrar(otro.fecha)}</span>
                                        <span className="text-rose-300 font-semibold truncate" title={estudioNombre}>
                                            {estudioNombre || "Sin título"}
                                        </span>
                                        <span className="ml-auto flex items-center justify-center text-rose-300">
                                            {isExpanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
                                        </span>
                                    </button>
                                    {isExpanded && (
                                        <div className="mt-3 space-y-2">
                                            <div className="bg-slate-900/75 border border-slate-700/50 rounded-xl px-4 py-3 shadow-inner">
                                                <span className="block text-xs uppercase tracking-wide text-rose-200/80 mb-1">Detalle</span>
                                                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                                    {otro.descripcion?.trim() ? otro.descripcion : "Sin descripción"}
                                                </p>
                                            </div>
                                            {otro.ruta_archivo && (
                                                <a
                                                    href={otro.ruta_archivo}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200 underline"
                                                >
                                                    {`${(estudioNombre || '').replace(/\s+/g, '_')}_${dateSlug}`}
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                                    <button
                                        className="text-slate-100 hover:text-rose-200 text-xs p-1"
                                        title="Editar"
                                        onClick={() => setEditandoIndiceOtro(idx)}
                                    >
                                        <FiEdit />
                                    </button>
                                    <button
                                        className={`text-slate-100 text-xs p-1 ${isDeletingOtroId === otro.id ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-300'}`}
                                        title="Eliminar"
                                        disabled={isDeletingOtroId === otro.id}
                                        onClick={() => {
                                            if (isDeletingOtroId) return;
                                            setModal({
                                                tipo: "confirmar_borrado",
                                                titulo: "¿Eliminar otro estudio?",
                                                mensaje: "¿Estás seguro que querés eliminar este estudio? Esta acción no se puede deshacer.",
                                                onConfirm: async () => {
                                                    try {
                                                        setIsDeletingOtroId(otro.id);
                                                        await axios.delete(`/api/examenes/otros/${otro.id}`);
                                                        const res = await axios.get(`/api/examenes/otros/${idPaciente}`);
                                                        setOtrosEstudios(ordenarPorFechaDesc(res.data));
                                                    } catch (err) {
                                                        console.error("Error al eliminar otro estudio", err);
                                                    } finally {
                                                        setIsDeletingOtroId(null);
                                                        setModal(null);
                                                    }
                                                },
                                                onClose: () => setModal(null),
                                            });
                                        }}
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>
                        </li>
                    );
                })
            ) : (
                <li className="text-slate-400 italic">No hay otros estudios cargados aún.</li>
            )}
        </ul>
                            </div>
                            )}
                    </div>
                )}
            </div>
            {mostrarModalLista && (
                <ModalListaEditable
                    endpoint={
                        variableModal === "laboratorio"
                            ? "bases/laboratorio"
                            : variableModal === "imagenes"
                                ? "bases/imagenes"
                                : "bases/otros"
                    }
                    campoNombre={
                        variableModal === "laboratorio"
                            ? "laboratorio"
                            : variableModal === "imagenes"
                                ? "imagen"
                                : "estudio"
                    }
                    idCampo="id"
                    actualizarLista={recargarCatalogo}
                    variable={variableModal}
                    titulo={tituloModal}
                    items={
                        variableModal === "laboratorio"
                            ? catalogoLaboratorios
                            : variableModal === "imagenes"
                                ? catalogoImagenes
                                : catalogoOtrosEstudios
                    }
                    onClose={() => setMostrarModalLista(false)}
                />
            )}
            {modal && (
                <ModalMensaje
                    tipo={modal.tipo || "info"}
                    titulo={modal.titulo}
                    mensaje={modal.mensaje}
                    onConfirm={modal.onConfirm}
                    onClose={modal.onClose}
                />
            )}
        </>
    );
};

export default EstudiosComplementarios; 
