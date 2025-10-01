// ===============================
// Importaciones y setup
// ===============================
// --- Imports de React ---
import { useState, useEffect, useRef, useCallback } from "react";
// --- Librerías externas ---
import axios from "axios";
// --- Constantes de entorno ---
import { API_BASE } from "../../config.js";
const url = (path) => `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
// --- Componentes y íconos reutilizables ---
import ModalMensaje from "../../components/ModalMensaje";
import { SelectConCrud } from "./elementosPartes/Campos.jsx";
import { FaRegEdit, FaTrash, FaSpinner, FaChevronUp, FaChevronDown, FaAngleDown, FaSave, FaPlus, FaMinus } from "react-icons/fa";
import { FiCopy } from "react-icons/fi";
import { copyToClipboard } from "../../utils/clipboard";
import { buildPrimeraVezText, buildEvolucionText } from "../../utils/clipboardBuilders";



// ===============================
// Definición del componente principal Consultas
// ===============================
function Consultas({
    mostrarConsultas,
    setMostrarConsultas,
    motivos,
    setMotivos,
    actualizarMotivos,
    setActualizarMotivos,
    expandedMotivo,
    setExpandedMotivo,
    handleAbrirModal,
    pacienteAntecedentes = {},
    ...props
}) {
    const { paciente } = props;
    const pacienteId = paciente?.id_paciente ?? null;

    // --- Estados locales ---

    // Estado para controlar si se está borrando una evolución o consulta (por id)
    const [borrandoEvolucionId, setBorrandoEvolucionId] = useState(null);
    const [borrandoConsultaId, setBorrandoConsultaId] = useState(null);
    // Fecha actual en formato ISO (ajustada a zona horaria local)
    const today = new Date().toISOString().split("T")[0]; // → "2025-07-19"

    // Estado para el nuevo motivo de consulta a cargar
    const [nuevoMotivo, setNuevoMotivo] = useState({ fecha: today, id_motivo: "", descripcion: "" });

    // Estados para edición de evoluciones
    const [modoEdicionEvolucion, setModoEdicionEvolucion] = useState({});
    const [textoEvolucionEditado, setTextoEvolucionEditado] = useState({});
    const [fechaEvolucionEditada, setFechaEvolucionEditada] = useState({});
    const [originalEvoluciones, setOriginalEvoluciones] = useState({});
    // Estado para controlar la expansión de evoluciones
    const [evolucionExpandida, setEvolucionExpandida] = useState({});

    // Estado para expandir/cerrar motivos de consulta en el listado
    const [motivosExpandido, setMotivosExpandido] = useState({});

    // Estado para mostrar todas las evoluciones por consulta
    // Estado para el modal de confirmación y control de borrado
    const [modalMensaje, setModalMensaje] = useState({ mostrar: false });

    // Estados de guardado para bloquear botones
    const [guardandoConsulta, setGuardandoConsulta] = useState(false);
    const [guardandoEvolucion, setGuardandoEvolucion] = useState({});
    const [guardandoActualizacion, setGuardandoActualizacion] = useState({});
    const [cargandoMotivos, setCargandoMotivos] = useState(false);
    const [cargandoConsultas, setCargandoConsultas] = useState(false);
    const [cargandoEvoluciones, setCargandoEvoluciones] = useState({});
    const [alerta, setAlerta] = useState(null);
    const [resaltadoConsultaId, setResaltadoConsultaId] = useState(null);

    // Lista de motivos de consulta disponibles (traídos del backend)
    const [listaMotivos, setListaMotivos] = useState([]);
    const highlightTimerRef = useRef(null);

    const [primeraEvolucionPorConsulta, setPrimeraEvolucionPorConsulta] = useState({});
    const primeraEvolucionCacheRef = useRef({});
    const primeraEvolucionCargandoRef = useRef(new Set());

    const antecedentesNormalizados = {
        medicos: pacienteAntecedentes?.medicos ?? pacienteAntecedentes?.medicos_texto ?? "",
        quirurgicos: pacienteAntecedentes?.quirurgicos ?? pacienteAntecedentes?.quirurgicos_texto ?? "",
        alergicos: pacienteAntecedentes?.alergicos ?? pacienteAntecedentes?.alergias ?? "",
        toxicos:
            pacienteAntecedentes?.toxicos ??
            pacienteAntecedentes?.habitos ??
            pacienteAntecedentes?.otros ??
            "",
        ginecoobstetricos:
            pacienteAntecedentes?.ginecoobstetricos ??
            pacienteAntecedentes?.gineco ??
            pacienteAntecedentes?.gineco_obstetricos ??
            "",
        familiares: pacienteAntecedentes?.familiares ?? pacienteAntecedentes?.comorbilidades ?? "",
    };

    const formatearFecha = useCallback((fechaISO) => {
        if (!fechaISO || typeof fechaISO !== "string") return "";
        const [año, mes, día] = fechaISO.split("-");
        return año && mes && día ? `${día}/${mes}/${año}` : fechaISO;
    }, []);

    const mapEvolucion = useCallback((item) => {
        if (!item) {
            return { fecha: "", texto: "" };
        }
        const fechaCruda = item?.fecha_evolucion || item?.fecha || "";
        const textoCrudo = item?.contenido ?? item?.texto ?? item?.descripcion ?? "";
        const fecha = typeof fechaCruda === "string" ? fechaCruda : "";
        const texto = typeof textoCrudo === "string" ? textoCrudo : "";
        return { fecha, texto };
    }, []);

    const extraerPrimeraEvolucion = useCallback((lista) => {
        if (!Array.isArray(lista) || lista.length === 0) {
            return null;
        }
        const ordenadas = [...lista].sort((a, b) => {
            const fechaA = new Date(a.fecha_evolucion || a.fecha || 0);
            const fechaB = new Date(b.fecha_evolucion || b.fecha || 0);
            return fechaA - fechaB;
        });
        const normalizada = mapEvolucion(ordenadas[0]);
        return {
            fecha: normalizada.fecha ? formatearFecha(normalizada.fecha) : "",
            texto: normalizada.texto,
        };
    }, [formatearFecha, mapEvolucion]);

    const registrarPrimeraEvolucion = useCallback((idConsulta, evolucion) => {
        if (!idConsulta) return;
        const existe = Object.prototype.hasOwnProperty.call(primeraEvolucionCacheRef.current, idConsulta);
        if (existe && primeraEvolucionCacheRef.current[idConsulta] === evolucion) {
            return;
        }
        primeraEvolucionCacheRef.current[idConsulta] = evolucion ?? null;
        setPrimeraEvolucionPorConsulta((prev) => ({
            ...prev,
            [idConsulta]: evolucion ?? null,
        }));
    }, []);

    const cargarPrimeraEvolucion = useCallback(async (consulta) => {
        const idConsulta = consulta?.id_consulta;
        if (!idConsulta) return;
        if (Object.prototype.hasOwnProperty.call(primeraEvolucionCacheRef.current, idConsulta)) return;
        if (primeraEvolucionCargandoRef.current.has(idConsulta)) return;

        primeraEvolucionCargandoRef.current.add(idConsulta);
        try {
            let evoluciones = Array.isArray(consulta?.evoluciones) ? consulta.evoluciones : null;
            if (!evoluciones || evoluciones.length === 0) {
                const { data } = await axios.get(url(`/evoluciones/consulta/${idConsulta}`));
                evoluciones = Array.isArray(data) ? data : [];
            }
            const primera = extraerPrimeraEvolucion(evoluciones);
            registrarPrimeraEvolucion(idConsulta, primera);
        } catch (error) {
            console.error("Error al precargar primera evolución:", error);
        } finally {
            primeraEvolucionCargandoRef.current.delete(idConsulta);
        }
    }, [extraerPrimeraEvolucion, registrarPrimeraEvolucion]);

    const handleCopyPrimeraVez = async (motivoItem) => {
        const idConsulta = motivoItem?.id_consulta;
        if (!idConsulta) {
            setAlerta({ tipo: "error", mensaje: "Consulta inválida." });
            return;
        }

        const tienePrimera = Object.prototype.hasOwnProperty.call(
            primeraEvolucionPorConsulta,
            idConsulta,
        );
        let primeraEvolucion = tienePrimera ? primeraEvolucionPorConsulta[idConsulta] : null;

        if (!tienePrimera && Array.isArray(motivoItem?.evoluciones) && motivoItem.evoluciones.length > 0) {
            const calculada = extraerPrimeraEvolucion(motivoItem.evoluciones);
            if (calculada) {
                registrarPrimeraEvolucion(idConsulta, calculada);
                primeraEvolucion = calculada;
            }
        }

        if (!tienePrimera && !primeraEvolucion) {
            cargarPrimeraEvolucion(motivoItem);
            setAlerta({ tipo: "info", mensaje: "Preparando datos de la primera evolución. Intentá copiar nuevamente." });
            return;
        }

        if (tienePrimera && !primeraEvolucion) {
            setAlerta({ tipo: "error", mensaje: "La consulta no tiene evoluciones registradas." });
            return;
        }

        const texto = buildPrimeraVezText({
            motivo: motivoItem?.texto || motivoItem?.nombre_motivo || motivoItem?.descripcion || "",
            evolucionMasVieja: primeraEvolucion,
            antecedentes: antecedentesNormalizados,
        });

        if (!texto.trim()) {
            setAlerta({ tipo: "error", mensaje: "No hay evolución de primera vez para copiar." });
            return;
        }

        try {
            await copyToClipboard(texto);
            setAlerta({ tipo: "ok", mensaje: "Copiado al portapapeles." });
        } catch (error) {
            console.error("Error al copiar primera vez:", error);
            const detalle = error instanceof Error && error.message ? ` Detalle: ${error.message}` : "";
            setAlerta({ tipo: "error", mensaje: `No se pudo copiar al portapapeles.${detalle}` });
        }
    };

    const handleCopyEvolucion = async (evolucion) => {
        const fechaFormateada = formatearFecha(evolucion?.fecha_evolucion || evolucion?.fecha || "");
        const texto = buildEvolucionText({
            fecha: fechaFormateada,
            texto: evolucion?.contenido ?? evolucion?.texto ?? "",
        });

        if (!texto.trim()) {
            setAlerta({ tipo: "error", mensaje: "No hay contenido para copiar." });
            return;
        }

        try {
            await copyToClipboard(texto);
            setAlerta({ tipo: "ok", mensaje: "Copiado" });
        } catch (error) {
            console.error("Error al copiar evolución:", error);
            setAlerta({ tipo: "error", mensaje: "No se pudo copiar al portapapeles." });
        }
    };

    // --- Función utilitaria ---
    // Función auxiliar para formatear fechas a "dd/mm/yyyy"
    useEffect(() => {
        if (!alerta) return;
        const timer = setTimeout(() => setAlerta(null), 4000);
        return () => clearTimeout(timer);
    }, [alerta]);

    useEffect(() => () => {
        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
        }
    }, []);

    // --- Funciones de API: fetch, delete, update, create ---
    // Borrar evolución y refrescar evoluciones
    const borrarEvolucion = async (idEvolucion) => {
        setBorrandoEvolucionId(idEvolucion);
        setAlerta(null);
        try {
            await axios.delete(url(`/evoluciones/${idEvolucion}`));
            // Buscar a qué consulta pertenece para refrescar
            // Buscamos el id_consulta al que pertenece la evolución
            let idConsulta = null;
            Object.entries(evolucionesPorMotivo).forEach(([consultaId, evoluciones]) => {
                if (Array.isArray(evoluciones) && evoluciones.some(ev => ev.id_evolucion === idEvolucion)) {
                    idConsulta = consultaId;
                }
            });
            if (idConsulta) {
                await fetchEvoluciones(Number(idConsulta));
                setAlerta({ tipo: "ok", mensaje: "Evolución eliminada." });
            }
        } catch (error) {
            console.error("Error al borrar evolución:", error);
            setAlerta({ tipo: "error", mensaje: "No se pudo eliminar la evolución." });
        } finally {
            setBorrandoEvolucionId(null);
        }
    };

    // Función para actualizar una evolución
    const actualizarEvolucion = async (id_consulta, id_evolucion) => {
        const nuevoContenido = textoEvolucionEditado[id_evolucion];
        const nuevaFecha = fechaEvolucionEditada[id_evolucion];
        setAlerta(null);
        if (!nuevoContenido?.trim() || !nuevaFecha) {
            setAlerta({ tipo: "error", mensaje: "Debes completar fecha y contenido." });
            return;
        }
        try {
            setGuardandoActualizacion(prev => ({ ...prev, [id_evolucion]: true }));
            // Asume PUT /evoluciones/{id_evolucion}
            await axios.put(url(`/evoluciones/${id_evolucion}`), {
                id_consulta,
                fecha_evolucion: nuevaFecha,
                contenido: nuevoContenido
            });
            fetchEvoluciones(id_consulta);
            setModoEdicionEvolucion(prev => ({ ...prev, [id_evolucion]: false }));
            setOriginalEvoluciones(prev => ({
                ...prev,
                [id_evolucion]: {
                    contenido: nuevoContenido,
                    fecha: nuevaFecha,
                },
            }));
            setAlerta({ tipo: "ok", mensaje: "Evolución actualizada." });
        } catch (error) {
            console.error("Error al actualizar evolución:", error);
            setAlerta({ tipo: "error", mensaje: "No se pudo actualizar la evolución." });
        } finally {
            setGuardandoActualizacion(prev => ({ ...prev, [id_evolucion]: false }));
        }
    };

    // Carga de motivos de consulta desde backend cuando se actualiza
    useEffect(() => {
        /**
         * Trae la lista de motivos de consulta desde el backend.
         */
        const fetchMotivos = async () => {
            setAlerta(null);
            setCargandoMotivos(true);
            try {
                const res = await axios.get(url(`/bases/motivos_consulta/`));
                setListaMotivos(res.data);
            } catch (error) {
                console.error("Error al cargar motivos de consulta:", error);
                setAlerta({ tipo: "error", mensaje: "No se pudieron cargar los motivos de consulta." });
            } finally {
                setCargandoMotivos(false);
            }
        };
        fetchMotivos();
    }, [actualizarMotivos]);

    // Función para traer las consultas del paciente desde el backend
    const pacienteActivoRef = useRef(null);

    const fetchConsultas = useCallback(async (idPaciente) => {
        if (!idPaciente) return;
        setCargandoConsultas(true);
        try {
            const res = await axios.get(url(`/consultas/${idPaciente}`));

            if (pacienteActivoRef.current !== idPaciente) {
                return;
            }

            if (Array.isArray(res.data)) {
                const consultasOrdenadas = res.data.sort((a, b) =>
                    new Date(b.fecha_consulta) - new Date(a.fecha_consulta)
                );
                setMotivos(consultasOrdenadas);
            } else {
                console.error("❌ La respuesta no es un array:", res.data);
            }
        } catch (error) {
            console.error("Error al traer consultas:", error);
            if (pacienteActivoRef.current === idPaciente) {
                setAlerta({ tipo: "error", mensaje: "No se pudieron cargar las consultas." });
            }
        } finally {
            if (pacienteActivoRef.current === idPaciente) {
                setCargandoConsultas(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!Array.isArray(motivos) || motivos.length === 0) return;
        motivos.forEach((consulta) => {
            if (!consulta?.id_consulta) return;
            if (Object.prototype.hasOwnProperty.call(primeraEvolucionCacheRef.current, consulta.id_consulta)) return;
            cargarPrimeraEvolucion(consulta);
        });
    }, [motivos, cargarPrimeraEvolucion]);

    // Borrar consulta y refrescar consultas
    const borrarConsulta = async (idConsulta) => {
        setBorrandoConsultaId(idConsulta);
        try {
            await axios.delete(url(`/consultas/${idConsulta}`));
            await fetchConsultas(paciente?.id_paciente ?? null);
        } catch (error) {
            console.error("Error al borrar consulta:", error);
        } finally {
            setBorrandoConsultaId(null);
        }
    };

    // Función para confirmar y eliminar una consulta (motivo)
    const handleConfirmarEliminarMotivo = async (indice) => {
        const consultaAEliminar = motivos[indice];
        if (!consultaAEliminar?.id_consulta) return;
        setModalMensaje(prev => ({ ...prev, mostrar: false }));
        borrarConsulta(consultaAEliminar.id_consulta);
    };

    /**
     * Cierra el modal de confirmación de borrado de consulta.
     */
    const handleCancelarEliminarMotivo = () => {
        setModalMensaje(prev => ({ ...prev, mostrar: false }));
    };

    /**
     * Expande o colapsa la evolución seleccionada.
     */
    const toggleExpandirEvolucion = (id) => {
        setEvolucionExpandida(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Función para guardar una nueva evolución para una consulta
    const guardarEvolucion = async (id_consulta) => {
        const contenido = nuevoContenidoEvolucion[id_consulta] || "";
        const fecha = nuevaFechaEvolucion[id_consulta] || today;

        setAlerta(null);
        if (!fecha || !contenido.trim()) {
            setAlerta({ tipo: "error", mensaje: "Completá fecha y contenido para guardar la evolución." });
            return;
        }

        const payload = {
            id_consulta,
            fecha_evolucion: fecha,
            contenido,
        };

        try {
            setGuardandoEvolucion(prev => ({ ...prev, [id_consulta]: true }));
            setCargandoEvoluciones(prev => ({ ...prev, [id_consulta]: true }));

            await axios.post(url(`/evoluciones/`), payload);

            // Limpia el formulario
            setNuevoContenidoEvolucion((prev) => ({ ...prev, [id_consulta]: "" }));
            setNuevaFechaEvolucion((prev) => ({ ...prev, [id_consulta]: today }));

            // Refrescá la lista directamente sin usar handleExpandirMotivo
            const resEvo = await axios.get(url(`/evoluciones/consulta/${id_consulta}`));
            const dataOrdenada = Array.isArray(resEvo.data)
                ? [...resEvo.data].sort((a, b) => new Date(b.fecha_evolucion) - new Date(a.fecha_evolucion))
                : [];
            setEvolucionesPorMotivo((prev) => ({
                ...prev,
                [id_consulta]: dataOrdenada,
            }));
            setOriginalEvoluciones((prev) => {
                const next = { ...prev };
                dataOrdenada.forEach((ev) => {
                    if (ev?.id_evolucion != null) {
                        next[ev.id_evolucion] = {
                            contenido: ev.contenido,
                            fecha: ev.fecha_evolucion,
                        };
                    }
                });
                return next;
            });
            setAlerta({ tipo: "ok", mensaje: "Evolución guardada." });

        } catch (error) {
            console.error("❌ Error al guardar evolución:", error);
            setAlerta({ tipo: "error", mensaje: "No se pudo guardar la evolución." });
        } finally {
            setGuardandoEvolucion(prev => ({ ...prev, [id_consulta]: false }));
            setCargandoEvoluciones(prev => ({ ...prev, [id_consulta]: false }));
        }
    };

    // Función para expandir o colapsar el motivo de consulta seleccionado
    const toggleMotivoExpandido = (id) => {
        setMotivosExpandido(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const solicitarEliminarConsulta = (indice) => {
        setModalMensaje({
            mostrar: true,
            tipo: "confirmar_borrado",
            titulo: "¿Eliminar consulta?",
            mensaje: "¿Estás seguro que querés eliminar esta consulta junto con todas sus evoluciones?",
            onConfirm: () => handleConfirmarEliminarMotivo(indice),
            onClose: handleCancelarEliminarMotivo
        });
    };

    const solicitarEliminarEvolucion = (idEvolucion) => {
        setModalMensaje({
            mostrar: true,
            tipo: "confirmar_borrado",
            titulo: "Eliminar evolución",
            mensaje: "¿Estás seguro que querés eliminar esta evolución?",
            onConfirm: () => {
                setModalMensaje(prev => ({ ...prev, mostrar: false }));
                borrarEvolucion(idEvolucion);
            },
            onClose: () => setModalMensaje(prev => ({ ...prev, mostrar: false }))
        });
    };

    // Función para guardar una nueva consulta (motivo) para el paciente actual
    const guardarConsulta = async () => {
        try {
            if (!nuevoMotivo.fecha || !nuevoMotivo.id_motivo) return;

            setGuardandoConsulta(true);

            const data = {
                id_paciente: Number(pacienteId),
                motivo: Number(nuevoMotivo.id_motivo), // OJO: se usa 'motivo', no 'id_motivo'
                fecha_consulta: nuevoMotivo.fecha
            };

            const res = await axios.post(url(`/consultas/`), data);

            // Nueva lógica para agregar la consulta formateada con nombre_motivo y fecha
            const motivoSeleccionado = listaMotivos.find(
                (m) => m.id_motivo === data.motivo
            );

            const consultaFormateada = {
                id_consulta: res.data.id_consulta,
                motivo: res.data.motivo,
                nombre_motivo: motivoSeleccionado?.motivo_consulta || "Motivo desconocido",
                fecha_consulta: res.data.fecha_consulta,
                fecha: res.data.fecha_consulta,
                evoluciones: []
            };

            const nuevaLista = [...motivos, consultaFormateada].sort((a, b) =>
                b.fecha.localeCompare(a.fecha)
            );
            setMotivos(nuevaLista);
            setMotivosExpandido({ 0: true });
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
            setResaltadoConsultaId(consultaFormateada.id_consulta);
            highlightTimerRef.current = setTimeout(() => {
                setResaltadoConsultaId(null);
            }, 2500);

            // Reinicia el estado del formulario
            setNuevoMotivo({ fecha: today, id_motivo: "", descripcion: "", prequirurgico: {} });
        } catch (error) {
            console.error("❌ Error al guardar consulta:", error);
            console.error("📛 Detalle del error:", error.response?.data?.detail);
        } finally {
            setGuardandoConsulta(false);
        }
    };

    // --- Estados y funciones para manejo de evoluciones por motivo ---
    // Estado para evoluciones agrupadas por motivo
    const [evolucionesPorMotivo, setEvolucionesPorMotivo] = useState({});

    // Función para obtener evoluciones de una consulta desde el backend
    const fetchEvoluciones = useCallback(async (id_consulta) => {
        setCargandoEvoluciones(prev => ({ ...prev, [id_consulta]: true }));
        try {
            const res = await axios.get(url(`/evoluciones/consulta/${id_consulta}`));
            const dataOrdenada = Array.isArray(res.data)
                ? [...res.data].sort((a, b) => new Date(b.fecha_evolucion) - new Date(a.fecha_evolucion))
                : [];
            setEvolucionesPorMotivo(prev => ({
                ...prev,
                [id_consulta]: dataOrdenada
            }));
            setOriginalEvoluciones(prev => {
                const next = { ...prev };
                dataOrdenada.forEach((ev) => {
                    if (ev?.id_evolucion != null) {
                        next[ev.id_evolucion] = {
                            contenido: ev.contenido,
                            fecha: ev.fecha_evolucion,
                        };
                    }
                });
                return next;
            });
        } catch (error) {
            console.error("❌ Error al obtener evoluciones:", error);
        } finally {
            setCargandoEvoluciones(prev => ({ ...prev, [id_consulta]: false }));
        }
    }, []);

    // Función para cargar evoluciones al expandir motivo
    const handleExpandirMotivo = async (id_consulta) => {
        if (expandedMotivo === id_consulta) {
            setExpandedMotivo(null);
            return;
        }
        await fetchEvoluciones(id_consulta);
        setExpandedMotivo(id_consulta);
    };

    // Estados para nueva evolución por motivo
    const [nuevoContenidoEvolucion, setNuevoContenidoEvolucion] = useState({});
    const [nuevaFechaEvolucion, setNuevaFechaEvolucion] = useState({});

    // Función para manejar el cambio de la fecha de una nueva evolución temporal
    const handleChangeFechaNuevaEvolucion = (id_motivo, nuevaFecha) => {
        setEvolucionesPorMotivo(prev => {
            const evoluciones = prev[id_motivo] || [];
            const ultima = evoluciones.find(e => e.id_evolucion === null);
            const restantes = evoluciones.filter(e => e.id_evolucion !== null);
            if (!ultima) return prev; // No hay evolución temporal, no modificar
            const nuevaTemporal = {
                ...ultima,
                fecha_evolucion: nuevaFecha
            };
            return {
                ...prev,
                [id_motivo]: [...restantes, nuevaTemporal]
            };
        });
    };

    // --- useEffect: carga inicial de datos ---
    // useEffect para traer consultas cuando cambia el paciente y limpiar estados previos
    useEffect(() => {
        const idPaciente = pacienteId ?? null;
        pacienteActivoRef.current = idPaciente;

        setMotivos([]);
        setEvolucionesPorMotivo({});
        setMotivosExpandido({});
        setEvolucionExpandida({});
        setNuevoContenidoEvolucion({});
        setNuevaFechaEvolucion({});
        setAlerta(null);

        if (!idPaciente) {
            setCargandoConsultas(false);
            return () => {
                pacienteActivoRef.current = null;
            };
        }

        fetchConsultas(idPaciente);

        return () => {
            pacienteActivoRef.current = null;
        };
    }, [pacienteId, fetchConsultas]);

    // --- Renderizado JSX ---
    return (
        <>
        <div className="max-w-4xl mx-auto w-full px-4 ">
            {/* ===============================
                Sección: Título y toggle de consultas
                Botón para mostrar/ocultar el bloque de consultas
            =============================== */}
            <div
                className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 border border-slate-800/70 px-5 py-4 hover:from-slate-800/90 hover:to-slate-950/90 cursor-pointer flex items-center justify-between text-slate-100 font-semibold transition-shadow shadow-xl mb-4"
                onClick={() => setMostrarConsultas(!mostrarConsultas)}
            >
                <span className="flex items-center gap-2 text-slate-100 text-lg font-semibold">
                    🩺 Consultas
                </span>
                <span className="text-emerald-300 text-lg">
                    {mostrarConsultas ? <FaMinus /> : <FaPlus />}
                </span>
            </div>

            {mostrarConsultas && (
                <div className="p-6 bg-slate-900/75 border border-slate-700/60 rounded-3xl mb-6 text-sm shadow-2xl backdrop-blur">
                    {alerta && (
                        <div
                            role="status"
                            aria-live="polite"
                            aria-atomic="true"
                            className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold shadow ${
                                alerta.tipo === "error"
                                    ? "bg-rose-900/40 text-rose-100 border border-rose-700/40"
                                    : "bg-emerald-900/30 text-emerald-200 border border-emerald-700/40"
                            }`}
                        >
                            {alerta.mensaje}
                        </div>
                    )}
                    {/* ===============================
                        Sección: Formulario para nueva consulta
                        Permite seleccionar fecha y motivo, y crear una nueva consulta
                    =============================== */}
                    <div className="mb-4 border-b border-slate-800/60 pb-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                            <div className="flex flex-col text-slate-200 text-xs font-semibold">
                                <span className="mb-1 uppercase tracking-wide text-[10px] text-slate-300">Fecha</span>
                                <input
                                    type="date"
                                    value={nuevoMotivo.fecha}
                                    onChange={(e) => {
                                        setNuevoMotivo({ ...nuevoMotivo, fecha: e.target.value });
                                        e.target.blur();
                                    }}
                                    className={`w-[130px] p-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${guardandoConsulta ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={guardandoConsulta}
                                />
                            </div>

                            <div className="flex-1 w-full sm:min-w-[360px] sm:max-w-2xl sm:mx-auto">
                                <SelectConCrud
                                    searchable
                                    placeholder={cargandoMotivos ? "Cargando motivos..." : "Seleccioná un motivo"}
                                    label="Motivo de consulta"
                                    options={Array.isArray(listaMotivos)
                                        ? listaMotivos.map((motivo) => ({
                                              id: String(motivo.id_motivo),
                                              label: motivo.motivo_consulta || "",
                                          }))
                                        : []}
                                    value={nuevoMotivo.id_motivo ? String(nuevoMotivo.id_motivo) : ""}
                                    onChange={(valorSeleccionado) => {
                                        if (!valorSeleccionado) {
                                            setNuevoMotivo(prev => ({ ...prev, id_motivo: "", descripcion: "" }));
                                            return;
                                        }
                                        const idNormalizado = Number(valorSeleccionado);
                                        const motivoSeleccionado = Array.isArray(listaMotivos)
                                            ? listaMotivos.find(m => Number(m.id_motivo) === idNormalizado)
                                            : undefined;
                                        setNuevoMotivo(prev => ({
                                            ...prev,
                                            id_motivo: motivoSeleccionado?.id_motivo ?? idNormalizado,
                                            descripcion: motivoSeleccionado?.motivo_consulta ?? "",
                                        }));
                                    }}
                                    titleForValue={nuevoMotivo.descripcion || ""}
                                    readOnly={guardandoConsulta || cargandoMotivos}
                                    onOpenCrud={() => {
                                        handleAbrirModal("motivos_consulta", "Editar motivos de consulta");
                                        setActualizarMotivos(prev => !prev);
                                    }}
                                    showCrud={!guardandoConsulta && !cargandoMotivos}
                                    crudAlign="right"
                                    selectClassName="bg-slate-800 border border-slate-600 text-slate-100 hover:border-sky-500 focus:border-sky-500"
                                    showSearchInput
                                />
                            </div>

                            <button
                                onClick={guardarConsulta}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-emerald-400/70 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-400/20 hover:border-emerald-300 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm backdrop-blur"
                                aria-label="Guardar nueva consulta"
                                title="Guardar consulta"
                                disabled={guardandoConsulta || !nuevoMotivo.fecha || !nuevoMotivo.id_motivo}
                                aria-busy={guardandoConsulta ? "true" : "false"}
                            >
                                {guardandoConsulta ? <FaSpinner className="animate-spin" /> : <FaSave />}
                                <span>{guardandoConsulta ? "Guardando" : "Guardar consulta"}</span>
                            </button>
                        </div>
                    </div>

                    {/* ===============================
                        Sección: Listado de consultas cargadas
                        Lista todas las consultas y permite expandir para ver evoluciones
                    =============================== */}
                    <div className="mt-4">
                        {cargandoConsultas && (
                            <div className="flex items-center justify-center gap-2 text-sky-200 text-sm py-3" role="status">
                                <FaSpinner className="animate-spin" />
                                <span>Cargando consultas...</span>
                            </div>
                        )}
                        <div
                            className={`space-y-5 transition-opacity ${cargandoConsultas ? "opacity-50 pointer-events-none" : ""}`}
                            aria-busy={cargandoConsultas ? "true" : "false"}
                        >
                        {!cargandoConsultas && motivos.length === 0 ? (
                            <div className="text-center text-slate-400 py-6 border border-dashed border-slate-700 rounded-xl bg-slate-900/60">
                                No hay consultas registradas.
                            </div>
                        ) : (
                            <MotivoList
                                motivos={motivos}
                                motivosExpandido={motivosExpandido}
                                onToggleExpand={toggleMotivoExpandido}
                                onLoadEvoluciones={fetchEvoluciones}
                                formatearFecha={formatearFecha}
                                evolucionesPorMotivo={evolucionesPorMotivo}
                                today={today}
                                nuevaFechaEvolucion={nuevaFechaEvolucion}
                                setNuevaFechaEvolucion={setNuevaFechaEvolucion}
                                nuevoContenidoEvolucion={nuevoContenidoEvolucion}
                                setNuevoContenidoEvolucion={setNuevoContenidoEvolucion}
                                handleChangeFechaNuevaEvolucion={handleChangeFechaNuevaEvolucion}
                                guardandoEvolucion={guardandoEvolucion}
                                cargandoEvoluciones={cargandoEvoluciones}
                                guardandoActualizacion={guardandoActualizacion}
                                evolucionExpandida={evolucionExpandida}
                                toggleExpandirEvolucion={toggleExpandirEvolucion}
                                modoEdicionEvolucion={modoEdicionEvolucion}
                                setModoEdicionEvolucion={setModoEdicionEvolucion}
                                fechaEvolucionEditada={fechaEvolucionEditada}
                                setFechaEvolucionEditada={setFechaEvolucionEditada}
                                textoEvolucionEditado={textoEvolucionEditado}
                                setTextoEvolucionEditado={setTextoEvolucionEditado}
                                actualizarEvolucion={actualizarEvolucion}
                                guardarEvolucion={guardarEvolucion}
                                borrandoConsultaId={borrandoConsultaId}
                                onSolicitarEliminarConsulta={solicitarEliminarConsulta}
                                borrandoEvolucionId={borrandoEvolucionId}
                                onSolicitarEliminarEvolucion={solicitarEliminarEvolucion}
                                setOriginalEvoluciones={setOriginalEvoluciones}
                                resaltadoConsultaId={resaltadoConsultaId}
                                onCopyPrimeraVez={handleCopyPrimeraVez}
                                onCopyEvolucion={handleCopyEvolucion}
                            />
                        )}
                        </div>
                    </div>
                </div>
            )}
        </div>
        {/* ===============================
            Sección: Modal de confirmación de borrado
        =============================== */}
        {modalMensaje.mostrar && (
            <ModalMensaje
                tipo={modalMensaje.tipo}
                titulo={modalMensaje.titulo}
                mensaje={modalMensaje.mensaje}
                onConfirm={modalMensaje.onConfirm}
                onClose={modalMensaje.onClose}
            />
        )}
        </>
    );
}

function MotivoList({
    motivos,
    motivosExpandido,
    onToggleExpand,
    onLoadEvoluciones,
    formatearFecha,
    evolucionesPorMotivo,
    today,
    nuevaFechaEvolucion,
    setNuevaFechaEvolucion,
    nuevoContenidoEvolucion,
    setNuevoContenidoEvolucion,
    handleChangeFechaNuevaEvolucion,
    guardandoEvolucion,
    cargandoEvoluciones,
    guardandoActualizacion,
    evolucionExpandida,
    toggleExpandirEvolucion,
    modoEdicionEvolucion,
    setModoEdicionEvolucion,
    fechaEvolucionEditada,
    setFechaEvolucionEditada,
    textoEvolucionEditado,
    setTextoEvolucionEditado,
    actualizarEvolucion,
    guardarEvolucion,
    borrandoConsultaId,
    onSolicitarEliminarConsulta,
    borrandoEvolucionId,
    onSolicitarEliminarEvolucion,
    setOriginalEvoluciones,
    resaltadoConsultaId,
    onCopyPrimeraVez,
    onCopyEvolucion,
}) {
    return motivos.map((motivo, index) => {
        const idConsulta = motivo.id_consulta;
        const evolucionesData = evolucionesPorMotivo[idConsulta];
        const hasEvolucionesData = Object.prototype.hasOwnProperty.call(evolucionesPorMotivo, idConsulta);
        return (
            <MotivoItem
                key={idConsulta ?? `motivo-${index}`}
                motivo={motivo}
                index={index}
                isExpanded={motivosExpandido[index] || false}
                onToggleExpand={onToggleExpand}
                onLoadEvoluciones={onLoadEvoluciones}
                hasEvolucionesData={hasEvolucionesData}
                formatearFecha={formatearFecha}
                evoluciones={Array.isArray(evolucionesData) ? evolucionesData : []}
                today={today}
                nuevaFechaEvolucion={nuevaFechaEvolucion}
                setNuevaFechaEvolucion={setNuevaFechaEvolucion}
                nuevoContenidoEvolucion={nuevoContenidoEvolucion}
                setNuevoContenidoEvolucion={setNuevoContenidoEvolucion}
                handleChangeFechaNuevaEvolucion={handleChangeFechaNuevaEvolucion}
                guardandoEvolucion={guardandoEvolucion}
                cargandoEvoluciones={cargandoEvoluciones}
                guardandoActualizacion={guardandoActualizacion}
                evolucionExpandida={evolucionExpandida}
                toggleExpandirEvolucion={toggleExpandirEvolucion}
                modoEdicionEvolucion={modoEdicionEvolucion}
                setModoEdicionEvolucion={setModoEdicionEvolucion}
                fechaEvolucionEditada={fechaEvolucionEditada}
                setFechaEvolucionEditada={setFechaEvolucionEditada}
                textoEvolucionEditado={textoEvolucionEditado}
                setTextoEvolucionEditado={setTextoEvolucionEditado}
                actualizarEvolucion={actualizarEvolucion}
                guardarEvolucion={guardarEvolucion}
                borrandoConsultaId={borrandoConsultaId}
                onSolicitarEliminarConsulta={onSolicitarEliminarConsulta}
                borrandoEvolucionId={borrandoEvolucionId}
                onSolicitarEliminarEvolucion={onSolicitarEliminarEvolucion}
                setOriginalEvoluciones={setOriginalEvoluciones}
                resaltadoConsultaId={resaltadoConsultaId}
                onCopyPrimeraVez={onCopyPrimeraVez}
                onCopyEvolucion={onCopyEvolucion}
            />
        );
    });
}

function MotivoItem({
    motivo,
    index,
    isExpanded,
    onToggleExpand,
    onLoadEvoluciones,
    hasEvolucionesData,
    formatearFecha,
    evoluciones,
    today,
    nuevaFechaEvolucion,
    setNuevaFechaEvolucion,
    nuevoContenidoEvolucion,
    setNuevoContenidoEvolucion,
    handleChangeFechaNuevaEvolucion,
    guardandoEvolucion,
    cargandoEvoluciones,
    guardandoActualizacion,
    evolucionExpandida,
    toggleExpandirEvolucion,
    modoEdicionEvolucion,
    setModoEdicionEvolucion,
    fechaEvolucionEditada,
    setFechaEvolucionEditada,
    textoEvolucionEditado,
    setTextoEvolucionEditado,
    actualizarEvolucion,
    guardarEvolucion,
    borrandoConsultaId,
    onSolicitarEliminarConsulta,
    borrandoEvolucionId,
    onSolicitarEliminarEvolucion,
    setOriginalEvoluciones,
    resaltadoConsultaId,
    onCopyPrimeraVez,
    onCopyEvolucion,
}) {
    const idConsulta = motivo.id_consulta;
    const nombreMotivo =
        motivo.nombre_motivo || motivo.motivo_consulta || motivo.descripcion || "Motivo sin título";
    const guardandoEvolucionActual = !!guardandoEvolucion[idConsulta];
    const isCargandoEvoluciones = !!cargandoEvoluciones[idConsulta];
    const isHighlighted = idConsulta === resaltadoConsultaId;
    const containerRef = useRef(null);
    const prevExpandedRef = useRef(isExpanded);

    useEffect(() => {
        if (isExpanded && !prevExpandedRef.current && containerRef.current) {
            containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        prevExpandedRef.current = isExpanded;
    }, [isExpanded]);

    useEffect(() => {
        if (isHighlighted && containerRef.current) {
            containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [isHighlighted]);

    const handleHeaderClick = () => {
        onToggleExpand(index);
        if (!hasEvolucionesData) {
            onLoadEvoluciones(idConsulta);
        }
    };

    const handleCopyPrimeraVezClick = (event) => {
        event.stopPropagation();
        if (typeof onCopyPrimeraVez === "function") {
            onCopyPrimeraVez(motivo);
        }
    };

    const cardClasses = `rounded-xl p-5 transition-all duration-200 border ${
        isHighlighted ? "border-sky-400/60 ring-2 ring-sky-500/30 shadow-xl" : "border-slate-500/30 shadow-lg"
    } bg-slate-800/95 text-slate-50 backdrop-blur`;

    return (
        <div ref={containerRef} className={cardClasses}>
            <div
                className="flex items-center justify-between gap-2 text-sm text-slate-300 cursor-pointer"
                onClick={handleHeaderClick}
            >
                <div className="flex items-center gap-2 w-full">
                    <span className="text-xs">{isExpanded ? "▴" : "▸"}</span>
                    <span className="text-slate-100 font-semibold text-sm w-[130px] text-left">
                        {formatearFecha(motivo.fecha_consulta)}
                    </span>
                    <div className="flex-1 flex justify-center">
                        <span className="text-amber-300 font-semibold text-lg mx-auto tracking-wide">
                            {nombreMotivo}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyPrimeraVezClick}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-sky-400/70 text-sky-200 rounded-lg hover:bg-sky-500/10 transition"
                            title="Copiar primera vez"
                        >
                            <FiCopy size={14} />
                            <span>1era vez</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSolicitarEliminarConsulta(index);
                            }}
                            disabled={borrandoConsultaId === idConsulta}
                            className="p-1 text-rose-400 hover:text-rose-300 disabled:opacity-50"
                            title="Eliminar motivo de consulta"
                        >
                            {borrandoConsultaId === idConsulta ? (
                                <FaSpinner className="animate-spin" />
                            ) : (
                                <FaTrash />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <EvolucionesPanel
                    motivo={motivo}
                    evoluciones={evoluciones}
                    today={today}
                    nuevaFechaEvolucion={nuevaFechaEvolucion}
                    setNuevaFechaEvolucion={setNuevaFechaEvolucion}
                    nuevoContenidoEvolucion={nuevoContenidoEvolucion}
                    setNuevoContenidoEvolucion={setNuevoContenidoEvolucion}
                    handleChangeFechaNuevaEvolucion={handleChangeFechaNuevaEvolucion}
                    guardandoEvolucionActual={guardandoEvolucionActual}
                    isCargandoEvoluciones={isCargandoEvoluciones}
                    guardarEvolucion={guardarEvolucion}
                    formatearFecha={formatearFecha}
                    evolucionExpandida={evolucionExpandida}
                    toggleExpandirEvolucion={toggleExpandirEvolucion}
                    modoEdicionEvolucion={modoEdicionEvolucion}
                    setModoEdicionEvolucion={setModoEdicionEvolucion}
                    fechaEvolucionEditada={fechaEvolucionEditada}
                    setFechaEvolucionEditada={setFechaEvolucionEditada}
                    textoEvolucionEditado={textoEvolucionEditado}
                    setTextoEvolucionEditado={setTextoEvolucionEditado}
                    guardandoActualizacion={guardandoActualizacion}
                    actualizarEvolucion={actualizarEvolucion}
                    borrandoEvolucionId={borrandoEvolucionId}
                    onSolicitarEliminarEvolucion={onSolicitarEliminarEvolucion}
                    setOriginalEvoluciones={setOriginalEvoluciones}
                    onCopyEvolucion={onCopyEvolucion}
                />
            )}
        </div>
    );
}

function EvolucionesPanel({
    motivo,
    evoluciones,
    today,
    nuevaFechaEvolucion,
    setNuevaFechaEvolucion,
    nuevoContenidoEvolucion,
    setNuevoContenidoEvolucion,
    handleChangeFechaNuevaEvolucion,
    guardandoEvolucionActual,
    isCargandoEvoluciones,
    guardarEvolucion,
    formatearFecha,
    evolucionExpandida,
    toggleExpandirEvolucion,
    modoEdicionEvolucion,
    setModoEdicionEvolucion,
    fechaEvolucionEditada,
    setFechaEvolucionEditada,
    textoEvolucionEditado,
    setTextoEvolucionEditado,
    guardandoActualizacion,
    actualizarEvolucion,
    borrandoEvolucionId,
    onSolicitarEliminarEvolucion,
    setOriginalEvoluciones,
    onCopyEvolucion,
}) {
    const idConsulta = motivo.id_consulta;
    const fechaNueva = nuevaFechaEvolucion[idConsulta] || today;
    const contenidoNuevo = nuevoContenidoEvolucion[idConsulta] || "";
    const panelRef = useRef(null);

    const evolucionesOrdenadas = [...evoluciones].sort(
        (a, b) => new Date(b.fecha_evolucion) - new Date(a.fecha_evolucion)
    );
    const ultima = evolucionesOrdenadas.slice(0, 1);
    const restantes = evolucionesOrdenadas.slice(1);
    const restantesKey = `restantes-${idConsulta}`;
    const mostrarRestantes = evolucionExpandida[restantesKey];

    useEffect(() => {
        if (mostrarRestantes && panelRef.current) {
            panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [mostrarRestantes]);

    const renderEvolucion = (ev, containerClass) => {
        const id = ev.id_evolucion;
        const expanded = evolucionExpandida[id];
        const guardandoActualizacionEvolucion = !!guardandoActualizacion[id];
        const editable = !!modoEdicionEvolucion[id];
        const textoEditado = textoEvolucionEditado[id] ?? ev.contenido;
        const fechaEditada = fechaEvolucionEditada[id] || ev.fecha_evolucion;
        const textareaId = `evolucion-textarea-${id}`;

        return (
            <div
                key={id}
                className={`border-t border-slate-800/60 pt-2 mt-2 ${containerClass} rounded-lg flex items-start justify-between shadow-inner`}
            >
                <div className="flex-1">
                    <div className="flex items-center text-sm text-sky-300 mb-1">
                        <span>{formatearFecha(ev.fecha_evolucion)}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandirEvolucion(id);
                            }}
                            className="p-1 h-6 w-6 flex items-center justify-center text-sm text-slate-200 hover:text-sky-300 transition duration-200"
                            style={{ background: "transparent" }}
                        >
                            {expanded ? (
                                <FaChevronUp className="text-sm text-sky-400" />
                            ) : (
                                <FaAngleDown className="text-sm text-sky-400" />
                            )}
                        </button>
                    </div>

                    {editable ? (
                        <div className="flex flex-col gap-2">
                            <input
                                type="date"
                                value={fechaEditada}
                                onChange={(e) => {
                                    setFechaEvolucionEditada(prev => ({ ...prev, [id]: e.target.value }));
                                    e.target.blur();
                                }}
                                className={`w-28 p-1 rounded border border-slate-700 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 ${(guardandoActualizacionEvolucion || isCargandoEvoluciones) ? "opacity-60 cursor-not-allowed" : ""}`}
                                disabled={guardandoActualizacionEvolucion || isCargandoEvoluciones}
                            />
                            <textarea
                                id={textareaId}
                                value={textoEditado}
                                onChange={(e) => setTextoEvolucionEditado(prev => ({ ...prev, [id]: e.target.value }))}
                                className={`w-full bg-slate-800 text-slate-100 p-3 rounded border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 ${(guardandoActualizacionEvolucion || isCargandoEvoluciones) ? "opacity-60 cursor-not-allowed" : ""}`}
                                rows={3}
                                disabled={guardandoActualizacionEvolucion || isCargandoEvoluciones}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => actualizarEvolucion(idConsulta, id)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed shadow"
                                    aria-label="Guardar cambios de evolución"
                                    title="Guardar"
                                    disabled={guardandoActualizacionEvolucion || isCargandoEvoluciones}
                                    aria-busy={guardandoActualizacionEvolucion ? "true" : "false"}
                                >
                                    {guardandoActualizacionEvolucion ? <FaSpinner className="animate-spin" /> : <FaSave />}
                                    <span>{guardandoActualizacionEvolucion ? "Guardando" : "Guardar"}</span>
                                </button>
                                <button
                                    onClick={() => setModoEdicionEvolucion(prev => ({ ...prev, [id]: false }))}
                                    className="px-3 py-1.5 bg-slate-700 rounded-md text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition"
                                    disabled={guardandoActualizacionEvolucion}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div
                                    className={`text-slate-100 bg-slate-800/90 px-3 py-2 rounded-xl transition-all duration-300 ease-in-out shadow-sm leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}
                                    style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                                >
                                    {ev.contenido}
                                </div>
                </div>
                <div className="flex flex-col items-center gap-1 ml-4">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (typeof onCopyEvolucion === "function") {
                                onCopyEvolucion(ev);
                            }
                        }}
                        className="text-sky-300 hover:text-sky-200 text-xs p-1"
                        title="Copiar evolución"
                    >
                        <FiCopy size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setModoEdicionEvolucion(prev => ({ ...prev, [id]: true }));
                            setTextoEvolucionEditado(prev => ({ ...prev, [id]: ev.contenido }));
                                        setFechaEvolucionEditada(prev => ({ ...prev, [id]: ev.fecha_evolucion }));
                                        setOriginalEvoluciones(prev => ({
                                            ...prev,
                                            [id]: {
                                                contenido: ev.contenido,
                                                fecha: ev.fecha_evolucion,
                                            },
                                        }));
                                        requestAnimationFrame(() => {
                                            const el = document.getElementById(textareaId);
                                            if (el) {
                                                el.focus({ preventScroll: true });
                                                const length = el.value.length;
                                                el.setSelectionRange(length, length);
                                            }
                                        });
                                    }}
                                    className={`text-slate-200 hover:text-sky-300 text-xs p-1 ${isCargandoEvoluciones ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    disabled={isCargandoEvoluciones}
                                >
                                    <FaRegEdit size={14} />
                                    </button>
                    <button
                        onClick={() => onSolicitarEliminarEvolucion(id)}
                        disabled={borrandoEvolucionId === id || guardandoActualizacionEvolucion || isCargandoEvoluciones}
                        className="p-1 text-rose-400 hover:text-rose-300 disabled:opacity-50"
                        title="Eliminar evolución"
                                    >
                                        {borrandoEvolucionId === id ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                                    </button>
                                </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div ref={panelRef} className="bg-slate-900/90 border border-slate-600/50 rounded-2xl mt-4 p-5 shadow-xl">
            {isCargandoEvoluciones && (
                <div className="flex items-center justify-center gap-2 text-sky-200 text-xs mb-3" role="status">
                    <FaSpinner className="animate-spin" />
                    <span>Cargando evoluciones...</span>
                </div>
            )}

            <div className="p-4 rounded-xl border border-slate-500/25 bg-slate-800/90 shadow-inner mt-2">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <label className="text-slate-300 whitespace-nowrap text-sm font-medium">Fecha:</label>
                        <input
                            type="date"
                            value={fechaNueva}
                            onChange={(e) => {
                                const nuevaFecha = e.target.value;
                                setNuevaFechaEvolucion(prev => ({
                                    ...prev,
                                    [idConsulta]: nuevaFecha,
                                }));
                                handleChangeFechaNuevaEvolucion(idConsulta, nuevaFecha);
                                e.target.blur();
                            }}
                            className={`bg-slate-800 text-slate-100 p-2 rounded border border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${(guardandoEvolucionActual || isCargandoEvoluciones) ? "opacity-60 cursor-not-allowed" : ""}`}
                            disabled={guardandoEvolucionActual || isCargandoEvoluciones}
                        />
                    </div>
                </div>
                <textarea
                    placeholder="Evolución"
                    value={contenidoNuevo}
                    onChange={(e) =>
                        setNuevoContenidoEvolucion(prev => ({ ...prev, [idConsulta]: e.target.value }))
                    }
                    className={`w-full bg-slate-800 text-slate-50 border border-slate-500 p-3 rounded-lg text-base mb-2 ${(guardandoEvolucionActual || isCargandoEvoluciones) ? "opacity-60 cursor-not-allowed" : ""}`}
                    rows={3}
                    disabled={guardandoEvolucionActual || isCargandoEvoluciones}
                />
                <div className="flex justify-end">
                    <button
                        onClick={() => guardarEvolucion(idConsulta)}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow"
                        aria-label="Guardar evolución"
                        title="Guardar"
                        disabled={guardandoEvolucionActual || isCargandoEvoluciones}
                        aria-busy={guardandoEvolucionActual ? "true" : "false"}
                    >
                        {guardandoEvolucionActual ? <FaSpinner className="animate-spin" /> : <FaSave />}
                        <span>{guardandoEvolucionActual ? "Guardando" : "Guardar"}</span>
                    </button>
                </div>
            </div>

            {evolucionesOrdenadas.length > 0 && (
                <div>
                    {ultima.map((ev) => renderEvolucion(ev, "bg-slate-800/85"))}

                    {restantes.length > 0 && (
                        <div className="flex items-center mt-2">
                            <button
                                className="text-sky-300 hover:text-sky-200 text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => toggleExpandirEvolucion(restantesKey)}
                                disabled={isCargandoEvoluciones}
                                title={mostrarRestantes ? "Ocultar evoluciones anteriores" : "Mostrar evoluciones anteriores"}
                            >
                                {mostrarRestantes ? (
                                    <>
                                        <FaChevronUp className="mr-1" /> Ocultar anteriores
                                    </>
                                ) : (
                                    <>
                                        <FaChevronDown className="mr-1" /> {restantes.length} más
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {mostrarRestantes && restantes.map((ev) => renderEvolucion(ev, "bg-slate-900/75"))}
                </div>
            )}
        </div>
    );
}

export default Consultas;

// ===============================
// Fin del componente Consultas
// ===============================
