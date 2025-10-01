import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaBan, FaPen, FaPlus, FaMinus, FaNotesMedical, FaSave } from "react-icons/fa";
import axios from "axios";
import { API_BASE } from "@/config";

const url = (path) => `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

const SECTION_DEFS = [
    { key: "medicos", label: "Médicos" },
    { key: "quirurgicos", label: "Quirúrgicos" },
    { key: "alergicos", label: "Alérgicos" },
    { key: "toxicos", label: "Tóxicos" },
    { key: "ginecoobstetricos", label: "Gineco - Obstétricos" },
    { key: "familiares", label: "Familiares" },
];

const defaultTextForSection = (key, sexo) => {
    switch (key) {
        case "medicos":
            return "Sin antecedentes médicos";
        case "quirurgicos":
            return "Sin antecedentes quirúrgicos";
        case "alergicos":
            return "Sin antecedentes alérgicos";
        case "toxicos":
            return "Sin antecedentes tóxicos";
        case "familiares":
            return "Sin antecedentes familiares";
        case "ginecoobstetricos":
            if (sexo === 1) return "-";
            if (sexo === 2) return "Sin antecedentes gineco-obstétricos";
            return "-";
        default:
            return "";
    }
};

const buildEmptyAntecedentes = () => (
    SECTION_DEFS.reduce((acc, { key }) => {
        acc[key] = "";
        return acc;
    }, {})
);

const buildExpandState = (value = false) => (
    SECTION_DEFS.reduce((acc, { key }) => {
        acc[key] = value;
        return acc;
    }, {})
);

const Antecedentes = ({ sexoPaciente, paciente, onAntecedentesChange }) => {
    const [mostrarAntecedentes, setMostrarAntecedentes] = useState(false);
    const [editando, setEditando] = useState(false);
    const [antecedentes, setAntecedentes] = useState(() => buildEmptyAntecedentes());
    const [original, setOriginal] = useState(() => buildEmptyAntecedentes());
    const [expandibles, setExpandibles] = useState(() => buildExpandState());
    const [existeAntecedente, setExisteAntecedente] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [alerta, setAlerta] = useState(null);

    const notificarCambios = useCallback(
        (data) => {
            if (typeof onAntecedentesChange === "function") {
                onAntecedentesChange({ ...data });
            }
        },
        [onAntecedentesChange],
    );

    useEffect(() => {
        if (!paciente?.id_paciente) {
            const vacio = buildEmptyAntecedentes();
            setAntecedentes(vacio);
            setOriginal({ ...vacio });
            setExisteAntecedente(false);
            setExpandibles(buildExpandState());
            setEditando(false);
            notificarCambios(vacio);
            return;
        }

        const obtenerAntecedentes = async () => {
            try {
                setCargando(true);
                const { data } = await axios.get(url(`/antecedentes/${paciente.id_paciente}`));
                if (data && typeof data === "object") {
                    const normalizados = { ...buildEmptyAntecedentes() };
                    for (const { key } of SECTION_DEFS) {
                        normalizados[key] = data[key] ?? "";
                    }
                    setAntecedentes({ ...normalizados });
                    setOriginal({ ...normalizados });
                    setExisteAntecedente(true);
                    setExpandibles(buildExpandState());
                    setEditando(false);
                    notificarCambios(normalizados);
                } else {
                    const vacio = buildEmptyAntecedentes();
                    setAntecedentes(vacio);
                    setOriginal({ ...vacio });
                    setExisteAntecedente(false);
                    setExpandibles(buildExpandState());
                    setEditando(false);
                    notificarCambios(vacio);
                }
            } catch (error) {
                if (error?.response?.status === 404) {
                    const vacio = buildEmptyAntecedentes();
                    setAntecedentes(vacio);
                    setOriginal({ ...vacio });
                    setExisteAntecedente(false);
                    setExpandibles(buildExpandState());
                    setEditando(false);
                    notificarCambios(vacio);
                } else {
                    console.error("Error al obtener antecedentes:", error);
                    setAlerta({ tipo: "error", mensaje: "No se pudieron obtener los antecedentes." });
                }
            } finally {
                setCargando(false);
            }
        };

        obtenerAntecedentes();
    }, [paciente]);

    const hayCambios = useMemo(() => {
        return SECTION_DEFS.some(({ key }) => (antecedentes[key] ?? "") !== (original[key] ?? ""));
    }, [antecedentes, original]);

    const ajustarAltura = useCallback((el) => {
        if (!el) return;
        requestAnimationFrame(() => {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
        });
    }, []);

    const toggleSeccion = (key) => {
        setExpandibles((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const expandirTodo = (expandir) => {
        setExpandibles(buildExpandState(expandir));
    };

    const completarSinAntecedentes = () => {
        setAntecedentes((prev) => {
            const copia = { ...prev };
            for (const { key } of SECTION_DEFS) {
                copia[key] = defaultTextForSection(key, sexoPaciente);
            }
            notificarCambios(copia);
            return copia;
        });
    };

    const marcarSinAntecedentes = (key) => {
        setAntecedentes((prev) => {
            const next = {
                ...prev,
                [key]: defaultTextForSection(key, sexoPaciente),
            };
            notificarCambios(next);
            return next;
        });
    };

    const manejarCambio = (key, value) => {
        if (!editando) return;
        setAntecedentes((prev) => {
            const next = {
                ...prev,
                [key]: value,
            };
            notificarCambios(next);
            return next;
        });
    };

    const iniciarEdicion = () => {
        setEditando(true);
        expandirTodo(true);
        setAlerta(null);
    };

    const cancelarEdicion = () => {
        setAntecedentes({ ...original });
        setEditando(false);
        expandirTodo(false);
        setAlerta(null);
        notificarCambios(original);
    };

    const guardarAntecedentes = async () => {
        if (!paciente?.id_paciente) return;
        try {
            setCargando(true);
            const payload = {
                id_paciente: paciente.id_paciente,
                ...antecedentes,
            };
            if (existeAntecedente) {
                await axios.put(url(`/antecedentes/${paciente.id_paciente}`), payload);
            } else {
                await axios.post(url(`/antecedentes/`), payload);
                setExisteAntecedente(true);
            }
            const soloAntecedentes = SECTION_DEFS.reduce((acc, { key }) => {
                acc[key] = payload[key] ?? "";
                return acc;
            }, {});
            setOriginal(soloAntecedentes);
            setAntecedentes(soloAntecedentes);
            setEditando(false);
            expandirTodo(false);
            setAlerta({ tipo: "ok", mensaje: "Antecedentes guardados correctamente." });
            notificarCambios(soloAntecedentes);
        } catch (error) {
            console.error("Error al guardar antecedentes:", error);
            setAlerta({ tipo: "error", mensaje: "Ocurrió un error al guardar los antecedentes." });
        } finally {
            setCargando(false);
        }
    };

    const colores = SECTION_DEFS.reduce((acc, { key }) => {
        acc[key] = "text-sky-300";
        return acc;
    }, {});

    return (
        <div className="max-w-4xl mx-auto w-full px-4">
            <div
                className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 border border-slate-800/70 px-5 py-4 hover:from-slate-800/90 hover:to-slate-950/90 cursor-pointer flex items-center justify-between text-slate-100 font-semibold transition-shadow shadow-xl mb-4"
                onClick={() => setMostrarAntecedentes((prev) => !prev)}
                role="button"
                aria-expanded={mostrarAntecedentes}
                aria-controls="panel-antecedentes"
            >
                <span className="flex items-center gap-2 text-slate-100 text-lg font-semibold">
                    <FaNotesMedical className="text-emerald-400" />
                    Antecedentes
                </span>
                <span className="text-emerald-300 text-lg">
                    {mostrarAntecedentes ? <FaMinus /> : <FaPlus />}
                </span>
            </div>

            {mostrarAntecedentes && (
                <div
                    id="panel-antecedentes"
                    className="flex flex-col gap-4 bg-slate-900/75 border border-slate-700/60 p-6 rounded-3xl max-w-4xl mx-auto w-full text-sm shadow-2xl backdrop-blur"
                >
                    {alerta && (
                        <div
                            role="status"
                            aria-live="polite"
                            aria-atomic="true"
                            className={`rounded-lg px-3 py-2 text-xs font-semibold shadow ${
                                alerta.tipo === "ok"
                                    ? "bg-emerald-900/30 text-emerald-200 border border-emerald-700/40"
                                    : "bg-rose-900/40 text-rose-200 border border-rose-700/40"
                            }`}
                        >
                            {alerta.mensaje}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 items-center mb-2 text-slate-200">
                        <div className="relative group">
                            <button
                                className="flex items-center gap-1 text-sky-300 font-semibold text-sm hover:text-sky-200 transition"
                                onClick={() => {
                                    const expandir = Object.values(expandibles).some((val) => !val);
                                    expandirTodo(expandir);
                                }}
                                aria-label={Object.values(expandibles).every((val) => val) ? "Colapsar todo" : "Expandir todo"}
                            >
                                {Object.values(expandibles).every((val) => val) ? <FaMinus /> : <FaPlus />}
                            </button>
                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 text-xs bg-slate-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap">
                                {Object.values(expandibles).every((val) => val) ? "Colapsar todo" : "Expandir todo"}
                            </span>
                        </div>

                        {!editando && (
                            <button
                                className="flex items-center justify-center bg-transparent border border-slate-700 hover:border-slate-500 rounded-md p-1 transition text-sm font-semibold text-slate-200"
                                aria-label="Editar antecedentes"
                                onClick={iniciarEdicion}
                                disabled={cargando}
                            >
                                <FaPen className="text-emerald-300 text-base" />
                            </button>
                        )}

                        {editando && (
                            <>
                                <button
                                    type="button"
                                    onClick={completarSinAntecedentes}
                                    className="flex items-center justify-center text-slate-400 hover:text-slate-200 text-sm px-2 py-1 rounded border border-slate-600"
                                    aria-label="Completar todos como 'Sin antecedentes'"
                                    title="Sin antecedentes"
                                    disabled={cargando}
                                >
                                    <FaBan className="w-5 h-5" />
                                </button>

                                <button
                                    className="inline-flex items-center gap-2 border border-emerald-400/70 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-400/20 hover:border-emerald-300 font-semibold text-sm px-3 py-1 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                                    onClick={guardarAntecedentes}
                                    disabled={cargando || !hayCambios}
                                    aria-label="Guardar antecedentes"
                                    title="Guardar"
                                >
                                    <FaSave className="text-emerald-300" />
                                    <span>{cargando ? "Guardando..." : "Guardar"}</span>
                                </button>
                                <button
                                    className="bg-transparent border border-rose-600/70 hover:border-rose-500 text-rose-200 font-semibold text-sm px-3 py-1 rounded-lg transition"
                                    onClick={cancelarEdicion}
                                    disabled={cargando}
                                >
                                    Cancelar
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col w-full gap-3">
                        {SECTION_DEFS.map((section, idx) => (
                            <div
                                key={section.key}
                                className="flex flex-col gap-2 rounded-xl border border-slate-500/25 bg-slate-800/90 px-4 py-3 shadow-sm"
                            >
                                <div
                                    className="flex items-center justify-between cursor-pointer text-slate-200"
                                    onClick={() => toggleSeccion(section.key)}
                                >
                                    <span className="font-semibold text-sm flex items-center gap-2 tracking-wide">
                                        <span className={`${colores[section.key]} transition-transform duration-200`}>
                                            {expandibles[section.key] ? <FaMinus /> : <FaPlus />}
                                        </span>
                                        {section.label}
                                    </span>

                                    {editando && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                marcarSinAntecedentes(section.key);
                                            }}
                                            className="text-slate-400 hover:text-slate-200 text-sm"
                                            title="Sin antecedentes"
                                            type="button"
                                            aria-label={`Marcar ${section.label} como 'Sin antecedentes'`}
                                            disabled={cargando}
                                        >
                                            <FaBan />
                                        </button>
                                    )}
                                </div>

                                {expandibles[section.key] && (
                                    <div className="mt-1">
                                        <textarea
                                            ref={ajustarAltura}
                                            name={section.key}
                                            value={antecedentes[section.key]}
                                            onChange={(e) => manejarCambio(section.key, e.target.value)}
                                            className={
                                                (editando
                                                    ? "w-full bg-slate-900/80 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                                                    : "w-full bg-transparent text-slate-100 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400/60 transition") +
                                                " text-sm px-3 py-2 resize-none leading-relaxed shadow-inner"
                                            }
                                            rows={1}
                                            style={{ overflow: "hidden", resize: "none", whiteSpace: "pre-wrap" }}
                                            disabled={!editando || cargando}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Antecedentes;
