import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GiScalpel, GiStomach } from "react-icons/gi";
import { FiX, FiFileText } from "react-icons/fi";
import { FaPlus, FaMinus } from "react-icons/fa";
import { AiOutlinePlus } from "react-icons/ai";
import ModalCargaProfesional from "../../components/ModalCargaProfesional.jsx";
import PartesQuirurgicos from "./PartesQuirurgicos.jsx";
import { API_BASE as API } from "../../config.js";

// Error boundary para aislar fallas del hijo (p.ej., hooks mal ordenados en PartesQuirurgicos)
class PartesErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        // Log detallado para diagnóstico
        // Evita que un error del hijo estalle en Procedimientos.jsx
        console.error("[PartesErrorBoundary] error:", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="rounded-md border border-red-700/60 bg-red-900/20 p-3 text-sm text-red-200">
                    Ocurrió un error al renderizar el parte. Revisá el componente hijo (PartesQuirurgicos). 
                    <div className="mt-1 text-red-300/90 text-xs">
                        {String(this.state.error?.message || "Error desconocido")}
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

/**
 * Procedimientos – flujo: selector tipo (Cirugía/Endoscopía) → botón "+" → elegir centro (HZB / INTECNUS) → form en blanco.
 * Lista unificada abajo con opciones de editar/borrar.
 */

function SegmentedTipo({ tipo, setTipo }) {
    return (
        <div className="inline-flex rounded-full border border-slate-600/60 bg-slate-900/70 overflow-hidden shadow-sm">
            <button
                onClick={() => setTipo("cirugia")}
                className={`px-4 py-1.5 text-sm font-medium transition ${
                    tipo === "cirugia"
                        ? "bg-sky-600/30 text-sky-200"
                        : "text-slate-200 hover:bg-slate-800/80"
                }`}
            >
                Cirugía
            </button>
            <button
                onClick={() => setTipo("endoscopia")}
                className={`px-4 py-1.5 text-sm font-medium border-l border-slate-600/60 transition ${
                    tipo === "endoscopia"
                        ? "bg-sky-600/30 text-sky-200"
                        : "text-slate-200 hover:bg-slate-800/80"
                }`}
            >
                Endoscopía
            </button>
        </div>
    );
}

// Badge component for colored chips
function Badge({ children, color = "slate" }) {
    const palette = {
      slate: "bg-slate-800/80 text-slate-200 border-slate-500/40",
      orange: "bg-amber-600/30 text-amber-200 border-amber-400/60",
      gray: "bg-slate-800/80 text-slate-200 border-slate-500/40",
      emerald: "bg-emerald-600/20 text-emerald-200 border-emerald-400/50",
    };
    return (
      <span className={`inline-block text-xs px-2 py-0.5 rounded border ${palette[color] || palette.slate}`}>
        {children}
      </span>
    );
}

function Modal({ open, onClose, children, title, width = "max-w-2xl", disableOutsideClose = false, align = "top" }) {
    // Un par de logs centinela para ver si la ejecución cambia de camino entre renders
    if (import.meta?.env?.MODE !== "production") {
        console.debug("[Modal] render start – open:", open, "disableOutsideClose:", disableOutsideClose);
    }
    // Hooks deben ejecutarse siempre en el mismo orden: no ponerlos después de un return condicional
    React.useEffect(() => {
        if (import.meta?.env?.MODE !== "production") {
            console.debug("[Modal] effect mount – open:", open);
        }
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !disableOutsideClose) {
                onClose?.();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            if (import.meta?.env?.MODE !== "production") {
                console.debug("[Modal] effect cleanup");
            }
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose, disableOutsideClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/70" onClick={disableOutsideClose ? undefined : onClose} />
            {/* Container to center horizontally and start at top with vertical spacing */}
            <div className={`min-h-full flex ${align === "center" ? "items-center py-12" : "items-start py-6"} justify-center px-4`}>
                <div
                    className={`relative ${width} w-full bg-slate-900/75 border border-slate-700/60 rounded-2xl p-4 text-slate-100`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-200 transition"
                            title="Cerrar"
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

function Procedimientos({ procedimientos = [], paciente = {}, refreshKey = 0 }) {
    const pacienteParte = useMemo(() => {
        const src = paciente || {};

        const nombre = src?.nombre ?? src?.paciente_nombre ?? "";
        const dni = src?.dni ?? src?.paciente_dni ?? "";
        const fecha_nacimiento = src?.fecha_nacimiento ?? src?.fechaNacimiento ?? src?.fnac ?? null;

        // Cobertura: aceptar string, id u objeto; preferir nombre legible
        let cobertura_nombre = (
            src?.cobertura_nombre ??
            src?.obra_social_nombre ??
            src?.obra_social ??
            src?.nombre_cobertura ??
            ""
        );
        const cov = (
            src?.cobertura ??
            src?.cobertura_paciente ??
            src?.obraSocial ??
            src?.os ??
            null
        );
        if (!cobertura_nombre) {
            if (cov && typeof cov === "object") {
                cobertura_nombre = (
                    cov?.nombre ||
                    cov?.nombre_cobertura ||
                    cov?.descripcion ||
                    cov?.detalle ||
                    cov?.obra_social ||
                    ""
                );
            } else if (typeof cov === "string") {
                // Evitar mostrar IDs numéricos como nombre de cobertura
                cobertura_nombre = isNaN(Number(cov)) ? cov : "";
            }
        }

        // Beneficio / Número de afiliado — múltiples alias frecuentes
        const beneficio = (
            src?.beneficio ??
            src?.numero_cobertura ??
            src?.nro_beneficio ??
            src?.paciente_beneficio ??
            src?.numero_afiliado ??
            src?.nro_afiliado ??
            src?.afiliado ??
            src?.nro_carnet ??
            src?.nro_os ??
            src?.nro_obra_social ??
            src?.numero_beneficio ??
            ""
        );

        return { nombre, dni, fecha_nacimiento, cobertura_nombre, beneficio };
    }, [paciente]);
    const [mostrar, setMostrar] = useState(false);
    const [tipo, setTipo] = useState("cirugia"); // "cirugia" | "endoscopia"

    // Lista real desde backend
    const [lista, setLista] = useState([]);
    const [cargandoLista, setCargandoLista] = useState(false);
    const [errorLista, setErrorLista] = useState(null);

    const hoyISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);

    // Obtener id paciente estable
    const pacienteId = useMemo(() => {
        return paciente?.id_paciente ?? paciente?.id ?? null;
    }, [paciente]);

    // Coerce backend flags (0/1, true/false, "t"/"f", "true"/"false") into boolean
    const asBool = (v) => {
        if (v === null || v === undefined) return false;
        if (v === true || v === false) return v;
        if (v === 1 || v === 0) return !!v;
        const s = String(v).trim().toLowerCase();
        return s === "1" || s === "true" || s === "t" || s === "si" || s === "sí";
    };

    // Fetcher lista procedimientos
    const fetchLista = useCallback(async () => {
        if (!pacienteId) return;
        setCargandoLista(true);
        setErrorLista(null);
        try {
            const res = await fetch(`${API}/partes/resumen?id_paciente=${pacienteId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const mapped = (Array.isArray(data) ? data : []).map((r, idx) => {
                const tipoLabel =
                    r?.tipo_cirugia === 2
                        ? "Urgencia"
                        : r?.tipo_cirugia === 1
                        ? "Programado"
                        : "";

                const CENTROS = { 1: "HZB", 2: "INTECNUS" };

                const patSolicitada = asBool(
                    r.enviar_muestra_ap ?? (r.patologia !== undefined ? r.patologia : r.patologia_pendiente)
                );
                const patPendiente =
                    r.patologia !== undefined && r.patologia !== null
                        ? asBool(r.patologia)
                        : patSolicitada;

                const cultSolicitada = asBool(
                    r.enviar_muestra_cultivo ?? (r.cultivo !== undefined ? r.cultivo : r.cultivo_pendiente)
                );
                const cultPendiente =
                    r.cultivo !== undefined && r.cultivo !== null
                        ? asBool(r.cultivo)
                        : cultSolicitada;

                return {
                    id: r.id_procedimiento_paciente ?? r.id ?? `${Date.now()}-${idx}`,
                    fecha: r.fecha ?? (r.created_at ? String(r.created_at).slice(0, 10) : hoyISO),
                    procedimiento_base: r.procedimiento_base_nombre ?? r.procedimiento_base ?? "",
                    tecnica: r.nombre_tecnica ?? r.tecnica ?? "",
                    tipo_label: tipoLabel,
                    centro: r.institucion_nombre ?? r.centro ?? CENTROS?.[r.id_institucion] ?? "",
                    hora_inicio: r.hora_inicio ?? null,
                    hora_fin: r.hora_fin ?? null,
                    id_parte: r.id_parte ?? null,
                    id_procedimiento: r.id_procedimiento ?? null,
                    patologia_pendiente: patPendiente,
                    cultivo_pendiente: cultPendiente,
                    patologia_solicitada: patSolicitada,
                    cultivo_solicitado: cultSolicitada,
                };
            });
            setLista(mapped);
        } catch (e) {
            console.error("[procedimientos] error al traer lista:", e);
            setErrorLista("No se pudo cargar la lista de procedimientos.");
        } finally {
            setCargandoLista(false);
        }
    }, [API, pacienteId, hoyISO]);

    // Modal: crear
    const [openNuevo, setOpenNuevo] = useState(false);
    const [modoNuevo, setModoNuevo] = useState(null); // "blanco" (tras elegir centro)
    const [centroSel, setCentroSel] = useState(null); // { id, nombre, corto, img }
    const [openPartes, setOpenPartes] = useState(false);
    const [centroParte, setCentroParte] = useState(null); // { id, nombre, corto }
    const [verParteOpen, setVerParteOpen] = useState(false);
    const [verParteRow, setVerParteRow] = useState(null);

    // Clave estable para forzar remount limpio de PartesQuirurgicos cuando cambie el contexto
    const partesKey = useMemo(() => {
        return [
            pacienteId || "nopac",
            centroParte?.id || "nocentro",
            tipo || "notipo",
            openPartes ? "open" : "closed",
        ].join(":");
    }, [pacienteId, centroParte, tipo, openPartes]);

    // Logs centinela de render para confirmar orden estable
    if (import.meta?.env?.MODE !== "production") {
        console.debug("[Procedimientos] render – mostrar:", mostrar, "tipo:", tipo, "openPartes:", openPartes);
    }

    const [formNuevo, setFormNuevo] = useState({
        fecha: hoyISO,
        procedimiento_base: "",
        dx_pre: "",
        dx_post: "",
        anestesia: "",
        cirujano: "",
        ayudantes: "",
        tecnica: "",
    });

    // Centros (con logos en /public)
    const navigate = useNavigate();
    const centros = {
        cirugia: [
        {
            id: "HZB",
            nombre: "Hospital Zonal Bariloche",
            corto: "HZB",
            img: "/HZB.jpg",
        },
        {
            id: "INTECNUS",
            nombre: "Fundación Intecnus",
            corto: "INTECNUS",
            img: "/Intecnus.png",
        },
        ],
        endoscopia: [
        {
            id: "HZB",
            nombre: "Hospital Zonal Bariloche",
            corto: "HZB",
            img: "/HZB.jpg",
        },
        {
            id: "INTECNUS",
            nombre: "Fundación Intecnus",
            corto: "INTECNUS",
            img: "/Intecnus.png",
        },
        ],
    };

    // Map de procedimiento base por tipo (backend espera id_procedimiento_base)
    const procBaseId = useMemo(() => (tipo === "cirugia" ? 1 : 2), [tipo]);

    const procedimientosUnificados = useMemo(() => lista, [lista]);

    // Abrir PDF del parte según centro (HZB o INTECNUS)
    const abrirPdfParte = useCallback((id_pp, centro) => {
        if (!id_pp) return;
        const c = String(centro || "").toUpperCase();
        const path = c === "INTECNUS" ? "intecnus" : "hzb"; // default a HZB
        const url = `${API}/pdf/${path}/${id_pp}/pdf`;
        window.open(url, "_blank", "noopener");
    }, []);

    function resetNuevo() {
        setModoNuevo(null);
        setCentroSel(null);
        setFormNuevo({
        fecha: hoyISO,
        procedimiento_base: "",
        dx_pre: "",
        dx_post: "",
        anestesia: "",
        cirujano: "",
        ayudantes: "",
        tecnica: "",
        });
    }

    function crearEnBlanco() {
        const id = Date.now();
        setLista((prev) => [
        {
            id,
            tipo,
            centro: centroSel?.id,
            fecha: formNuevo.fecha,
            procedimiento_base:
            formNuevo.procedimiento_base ||
            (tipo === "cirugia" ? "Cirugía" : "Endoscopía"),
            dx_pre: formNuevo.dx_pre,
            dx_post: formNuevo.dx_post,
            anestesia: formNuevo.anestesia,
            cirujano: formNuevo.cirujano,
            ayudantes: formNuevo.ayudantes,
            tecnica: formNuevo.tecnica,
        },
        ...prev,
        ]);
        setOpenNuevo(false);
        resetNuevo();
    }


    // Cargar lista cuando se abre la sección o cambia paciente
    useEffect(() => {
        if (mostrar) {
            fetchLista();
        }
    }, [mostrar, fetchLista, refreshKey]);

    return (
        <div className="max-w-4xl mx-auto w-full px-4">
        <div
            className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 border border-slate-800/70 px-5 py-4 hover:from-slate-800/90 hover:to-slate-950/90 cursor-pointer flex items-center justify-between text-slate-100 font-semibold transition-shadow shadow-xl mb-4"
            onClick={() => setMostrar(!mostrar)}
        >
            <span className="flex items-center gap-2 text-slate-100 text-base font-semibold">
            <GiScalpel className="text-slate-200" /> Procedimientos{" "}
            <GiStomach className="text-slate-200" />
            </span>
            <span className="text-emerald-300 text-lg">
            {mostrar ? <FaMinus /> : <FaPlus />}
            </span>
        </div>

        {mostrar && (
            <div className="p-6 bg-slate-900/75 border border-slate-700/60 rounded-3xl mb-6 text-sm shadow-2xl backdrop-blur flex flex-col gap-6">
            {/* Toolbar */}
            <div className="flex flex-col items-center gap-2">
                <SegmentedTipo tipo={tipo} setTipo={setTipo} />
                <span className="text-xs text-slate-400">
                Elegí el tipo y creá el parte
                </span>
                <button
                    onClick={() => setOpenNuevo(true)}
                    className="inline-flex items-center gap-1.5 border border-emerald-400/70 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-400/20 hover:border-emerald-300 font-medium px-3 py-1.5 rounded-lg transition text-sm shadow-sm"
                    title="Crear nuevo parte"
                >
                    <AiOutlinePlus size={16} />
                    Nuevo parte
                </button>
            </div>
            <hr className="border-slate-700/40" />

            {/* Lista unificada */}
            <div className="mt-2">
                <h4 className="text-sky-300 font-semibold mb-2">
                Procedimientos cargados
                <span className="ml-2 text-xs text-slate-400 font-normal">
                    ({procedimientosUnificados.length})
                </span>
                </h4>
                {cargandoLista && <div className="text-xs text-slate-400 mb-2">Cargando…</div>}
                {errorLista && <div className="text-xs text-red-400 mb-2">{errorLista}</div>}
                {procedimientosUnificados.length === 0 && (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-600/40 bg-slate-900/70 px-4 py-6 text-center text-slate-300">
                        Aún no hay procedimientos cargados
                    </div>
                )}
                <ul className="space-y-2">
                {procedimientosUnificados.map((p) => (
                    <li
                        key={p.id}
                        className="rounded-2xl px-4 py-4 bg-slate-900/85 border border-slate-700/40 shadow-lg flex items-center justify-between cursor-pointer hover:border-slate-500 hover:bg-slate-800/80 transition"
                        onClick={() =>
                            navigate(`/partes/${p.id}`, {
                                state: {
                                    paciente: pacienteParte,
                                    centro: p.centro || null,
                                },
                            })
                        }
                    >
                        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3 items-center w-full">
                            <div className="text-sm">
                                <div className="flex items-center gap-2 font-semibold text-slate-100">
                                    <span>{new Date(p.fecha).toLocaleDateString("es-AR")}</span>
                                    {p.procedimiento_base && (
                                        <span className="text-sky-300 truncate">{p.procedimiento_base}</span>
                                    )}
                                </div>
                                {p.tecnica ? (
                                    <div className="text-xs text-slate-400/90 mt-1">
                                        {p.tecnica}
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                                {(p.patologia_pendiente || p.cultivo_pendiente) && (
                                    <span className="text-xs text-yellow-300/80 italic mr-1">Pendiente</span>
                                )}
                                {p.patologia_pendiente && (
                                    <Badge color="orange">
                                        <span title="Anatomía patológica pendiente">Patología</span>
                                    </Badge>
                                )}
                                {!p.patologia_pendiente && p.patologia_solicitada && (
                                    <Badge color="emerald">
                                        <span title="Patología cargada">Patología cargada</span>
                                    </Badge>
                                )}
                                {p.cultivo_pendiente && (
                                    <Badge color="orange">
                                        <span title="Cultivo microbiológico pendiente">Cultivo</span>
                                    </Badge>
                                )}
                                {!p.cultivo_pendiente && p.cultivo_solicitado && (
                                    <Badge color="emerald">
                                        <span title="Cultivo cargado">Cultivo cargado</span>
                                    </Badge>
                                )}
                                {p.centro && (
                                    <Badge>
                                        <span>{String(p.centro).toUpperCase()}</span>
                                    </Badge>
                                )}
                                <button
                                    type="button"
                                    title={`Imprimir parte ${String(p.centro).toUpperCase() === 'INTECNUS' ? 'INTECNUS' : 'HZB'} (PDF)`}
                                    onClick={(e) => { e.stopPropagation(); abrirPdfParte(p.id, p.centro); }}
                                    className="inline-flex items-center gap-1 px-2 py-1 border border-slate-600/60 rounded-lg hover:bg-slate-800/80 text-slate-200 text-xs"
                                >
                                    <FiFileText size={14} /> PDF
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
                </ul>
            </div>
            </div>
        )}

        {/* Modal: Nuevo procedimiento */}
        <Modal
            open={openNuevo}
            align="center"
            onClose={() => {
            setOpenNuevo(false);
            setModoNuevo(null);
            setCentroSel(null);
            }}
            title={
            !centroSel
                ? `Elegí el centro — ${
                    tipo === "cirugia" ? "Cirugía" : "Endoscopía"
                }`
                : `Nuevo ${
                    tipo === "cirugia"
                    ? "procedimiento quirúrgico"
                    : "procedimiento endoscópico"
                } – ${centroSel.corto}`
            }
            width={!centroSel ? "max-w-xl" : "max-w-3xl"}
        >
            {/* Paso 1: elegir centro */}
            {!centroSel && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {centros[tipo].map((c) => (
                        <button
                            key={c.id}
                            className="bg-slate-900/80 border border-slate-600/40 rounded-2xl p-4 text-left flex items-center gap-3 hover:ring-2 hover:ring-emerald-500/40 transition"
                            onClick={() => {
                                setCentroParte(c);
                                setOpenPartes(true);
                                setOpenNuevo(false);
                            }}
                        >
                            <img
                                src={c.img}
                                alt={c.nombre}
                                className="w-12 h-12 object-contain bg-white rounded p-1"
                            />
                            <div>
                                <div className="font-semibold mb-1">{c.nombre}</div>
                                <div className="text-slate-300 text-xs">
                                    {tipo === "cirugia" ? "Parte quirúrgico" : "Informe endoscópico"}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </Modal>

        {/* Modal: Editar procedimiento */}

        {/* Modal: Parte quirúrgico / Informe endoscópico */}
        <Modal
            open={openPartes}
            onClose={() => setOpenPartes(false)}
            title=""
            width="max-w-5xl"
            disableOutsideClose={true}
        >
            <PartesErrorBoundary>
                {openPartes ? (
                    <PartesQuirurgicos
                        key={partesKey}
                        centro={centroParte?.id === "INTECNUS" ? "INTECNUS" : "HZB"}
                        tipo={tipo}
                        pacienteId={pacienteId}
                        paciente={pacienteParte}
                        procedimientoBase={null}
                        procBaseId={procBaseId}
                        onCancel={() => setOpenPartes(false)}
                        onSave={async () => {
                            try {
                                console.log("[Procedimientos] onSave iniciado...");
                                await fetchLista();
                                console.log("[Procedimientos] fetchLista completado");
                                setOpenPartes(false);
                                console.log("[Procedimientos] Modal cerrado");
                            } catch (e) {
                                console.error("Fallo en onSave (UI):", e);
                            }
                        }}
                    />
                ) : (
                    <div className="text-xs text-slate-400">Abrí un parte para continuar…</div>
                )}
            </PartesErrorBoundary>
        </Modal>
        {/* Modal verParteOpen removido, ya no se usa */}
        <> </>
        </div>
    );
    }

export default Procedimientos;
