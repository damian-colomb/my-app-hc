import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import ModalListaEditable from "@/components/ModalListaEditable";
import ModalMensaje from "@/components/ModalMensaje";
import { API_BASE } from "@/config";
import { SelectConCrud } from "@/pages/Modulos/elementosPartes/Campos.jsx";

const url = (path) => `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

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

const EMPTY_FORM = {
    nombre: "",
    dni: "",
    fecha_nacimiento: "",
    sexo: "",
    cobertura: "",
    beneficio: "",
    nacionalidad: "",
    localidad: "",
    telefono: "",
    email: "",
    anexo: "",
};

const INPUT_CLASS = "w-full rounded-xl border border-slate-700 bg-[#0d182a] px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-0 transition disabled:border-slate-700 disabled:bg-[#131f30] disabled:text-slate-500";
const ACTION_BUTTON_CLASS = "inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60";
const PRIMARY_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border-emerald-400/70 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-400/20 hover:text-white`;
const SECONDARY_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border-slate-500/60 text-slate-200 hover:border-slate-300 hover:bg-slate-700/30 hover:text-white`;
const DANGER_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border-rose-500/60 text-rose-200 hover:border-rose-400 hover:bg-rose-500/15 hover:text-white`;

function toInputDate(value) {
    if (!value) return "";
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

function buildInitialForm(paciente) {
    if (!paciente) return { ...EMPTY_FORM };
    return {
        nombre: paciente.nombre ?? "",
        dni: paciente.dni ?? "",
        fecha_nacimiento: toInputDate(paciente.fecha_nacimiento),
        sexo: paciente.sexo != null ? String(paciente.sexo) : "",
        cobertura: paciente.cobertura != null ? String(paciente.cobertura) : "",
        beneficio: paciente.beneficio ?? "",
        nacionalidad: paciente.nacionalidad != null ? String(paciente.nacionalidad) : "",
        localidad: paciente.localidad != null ? String(paciente.localidad) : "",
        telefono: paciente.telefono ?? "",
        email: paciente.email ?? "",
        anexo: paciente.anexo ?? "",
    };
}

export default function ModalPaciente({ open, onClose, onSaved, mode = "create", patient = null }) {
    const isEditMode = mode === "edit" && patient?.id_paciente != null;
    const [form, setForm] = useState(buildInitialForm(patient));
    const [editingEnabled, setEditingEnabled] = useState(!isEditMode);

    useLockBodyScroll(open);

    const [coberturas, setCoberturas] = useState([]);
    const [nacionalidades, setNacionalidades] = useState([]);
    const [localidades, setLocalidades] = useState([]);

    const [loading, setLoading] = useState(false);
    const [modalInfo, setModalInfo] = useState(null);
    const [modalEntidad, setModalEntidad] = useState(null); // { tipo: "coberturas"|"nacionalidades"|"localidades" }

    const coberturasOrdenadas = useMemo(() => {
        if (!Array.isArray(coberturas)) return [];
        return [...coberturas].sort((a, b) =>
            (a?.nombre_cobertura || "").localeCompare(b?.nombre_cobertura || "", "es", { sensitivity: "base" })
        );
    }, [coberturas]);

    const typingFechaRef = useRef(false);

    const edadCalculada = useMemo(() => {
        const raw = form.fecha_nacimiento;
        if (!raw) return "";
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return "";

        const hoy = new Date();
        let edad = hoy.getFullYear() - date.getFullYear();
        const mesDiff = hoy.getMonth() - date.getMonth();
        const diaDiff = hoy.getDate() - date.getDate();
        if (mesDiff < 0 || (mesDiff === 0 && diaDiff < 0)) edad -= 1;
        if (edad < 0 || !Number.isFinite(edad)) return "";
        return `${edad} ${edad === 1 ? "año" : "años"}`;
    }, [form.fecha_nacimiento]);

    useEffect(() => {
        if (!open) return;
        // carga listas
        Promise.all([
            api.get("/coberturas/"),
            api.get("/nacionalidades/"),
            api.get("/localidades/"),
        ])
            .then(([c, n, l]) => {
                setCoberturas(c.data || []);
                setNacionalidades(n.data || []);
                setLocalidades(l.data || []);
            })
            .catch(() => {
                setModalInfo({
                    tipo: "error",
                    titulo: "❌ Error",
                    mensaje: "No se pudieron cargar las listas auxiliares.",
                    onCerrar: () => setModalInfo(null),
                });
            });
    }, [open]);

    useEffect(() => {
        if (open) {
            setForm(isEditMode ? buildInitialForm(patient) : { ...EMPTY_FORM });
            setEditingEnabled(!isEditMode);
        }
    }, [open, isEditMode, patient]);

    function setField(name, value) {
        setForm((f) => ({ ...f, [name]: value }));
    }

    function limpiarYNormalizar(obj) {
        const out = {};
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            out[k] = v === "" ? null : v;
        }
        return out;
    }

    async function handleSave() {
        // validación mínima
        const faltan = [];
        if (!form.nombre) faltan.push("nombre");
        if (!form.dni) faltan.push("DNI");
        if (!form.fecha_nacimiento) faltan.push("fecha de nacimiento");
        if (faltan.length) {
            setModalInfo({
                tipo: "validacion",
                titulo: "⚠️ Faltan datos",
                mensaje: `Completá: ${faltan.join(", ")}.`,
                onCerrar: () => setModalInfo(null),
            });
            return;
        }

        setLoading(true);
        try {
            const payload = limpiarYNormalizar(form);
            const endpoint = isEditMode ? `/pacientes/${patient.id_paciente}` : "/pacientes/";
            const method = isEditMode ? "PUT" : "POST";
            const res = await fetch(url(endpoint), {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 400 && data?.detail?.error === "DNI duplicado") {
                    setModalInfo({
                        tipo: "dni_duplicado",
                        titulo: "❌ DNI duplicado",
                        mensaje: `El DNI ya está registrado para ${data.detail.pacienteExistente}.`,
                        onCerrar: () => setModalInfo(null),
                    });
                } else {
                    setModalInfo({
                        tipo: "error",
                        titulo: "❌ Error",
                        mensaje: data?.detail || "Error desconocido al guardar paciente.",
                        onCerrar: () => setModalInfo(null),
                    });
                }
                setLoading(false);
                return;
            }

            // éxito
            if (typeof onSaved === "function") onSaved(data);
            onClose?.();
            setLoading(false);
            if (!isEditMode) {
                setForm({ ...EMPTY_FORM });
            } else if (data) {
                setForm(buildInitialForm(data));
                setEditingEnabled(false);
            }
        } catch (e) {
            setModalInfo({
                tipo: "error",
                titulo: "❌ Error de red",
                mensaje: "No se pudo conectar con el servidor.",
                onCerrar: () => setModalInfo(null),
            });
            setLoading(false);
        }
    }

    // refresco al cerrar ModalListaEditable
    async function refreshEntidad(tipo) {
        try {
            if (tipo === "coberturas") {
                const r = await api.get("/coberturas/");
                setCoberturas(r.data || []);
            } else if (tipo === "nacionalidades") {
                const r = await api.get("/nacionalidades/");
                setNacionalidades(r.data || []);
            } else if (tipo === "localidades") {
                const r = await api.get("/localidades/");
                setLocalidades(r.data || []);
            }
        } catch {}
    }

    if (!open) return null;

    const inputsDisabled = loading || (isEditMode && !editingEnabled);

    const toggleButtonClass = editingEnabled
        ? `${ACTION_BUTTON_CLASS} border-yellow-400/70 text-yellow-200 hover:border-yellow-300 hover:bg-yellow-300/10`
        : `${ACTION_BUTTON_CLASS} border-sky-400/70 text-sky-200 hover:border-sky-300 hover:bg-sky-400/10`;

    const toggleEditing = () => {
        if (!isEditMode) return;
        if (editingEnabled) {
            setForm(buildInitialForm(patient));
            setEditingEnabled(false);
        } else {
            setEditingEnabled(true);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#091629] via-[#081225] to-[#040a15] p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                            {isEditMode ? "Editar" : "Nuevo"}
                        </p>
                        <h2 className="text-lg font-semibold">Paciente</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditMode && (
                            <button
                                onClick={toggleEditing}
                                className={toggleButtonClass}
                                disabled={loading}
                            >
                                {editingEnabled ? "Cancelar cambios" : "Editar datos"}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={loading}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-white">
                    <input
                        name="nombre"
                        placeholder="Apellido y Nombre *"
                        value={form.nombre}
                        onChange={(e) => setField("nombre", e.target.value)}
                        disabled={inputsDisabled}
                        className={INPUT_CLASS}
                    />
                    <input
                        name="dni"
                        placeholder="DNI *"
                        value={form.dni}
                        onChange={(e) => setField("dni", e.target.value)}
                        disabled={inputsDisabled}
                        className={INPUT_CLASS}
                    />

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <SelectConCrud
                                searchable
                                showSearchInput={false}
                                readOnly={inputsDisabled}
                                placeholder="Sexo"
                                options={[
                                    { id: "1", label: "Masculino" },
                                    { id: "2", label: "Femenino" },
                                ]}
                                value={form.sexo ?? ""}
                                onChange={(val) => setField("sexo", val ?? "")}
                                showCrud={false}
                                selectClassName={INPUT_CLASS}
                            />
                        </div>
                        <input
                            name="fecha_nacimiento"
                            type="date"
                            value={form.fecha_nacimiento ?? ""}
                            onChange={(e) => {
                                setField("fecha_nacimiento", e.target.value);
                                if (!typingFechaRef.current) {
                                    requestAnimationFrame(() => e.target.blur());
                                }
                            }}
                            onKeyDown={() => {
                                typingFechaRef.current = true;
                            }}
                            onBlur={() => {
                                typingFechaRef.current = false;
                            }}
                            disabled={inputsDisabled}
                            className={INPUT_CLASS}
                        />
                        <div className="flex items-center justify-center rounded-xl border border-slate-700 bg-[#0d182a] px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                            {edadCalculada || "Edad"}
                        </div>
                    </div>

                    <SelectConCrud
                        searchable
                        readOnly={inputsDisabled}
                        placeholder="Cobertura"
                        options={coberturasOrdenadas.map((c) => ({
                            id: c.id_cobertura,
                            label: c.nombre_cobertura,
                        }))}
                        value={form.cobertura ?? ""}
                        onChange={(val) => setField("cobertura", val ?? "")}
                        onOpenCrud={() => {
                            if (!inputsDisabled) setModalEntidad({ tipo: "coberturas" });
                        }}
                        showCrud={!inputsDisabled}
                        crudAlign="right"
                        selectClassName={INPUT_CLASS}
                    />

                    <input
                        name="beneficio"
                        placeholder="Número de beneficio"
                        value={form.beneficio ?? ""}
                        onChange={(e) => setField("beneficio", e.target.value)}
                        disabled={inputsDisabled}
                        className={INPUT_CLASS}
                    />

                    <SelectConCrud
                        searchable
                        readOnly={inputsDisabled}
                        placeholder="Nacionalidad"
                        options={nacionalidades.map((n) => ({
                            id: n.id_nacionalidad,
                            label: n.nombre_nacionalidad,
                        }))}
                        value={form.nacionalidad ?? ""}
                        onChange={(val) => setField("nacionalidad", val ?? "")}
                        onOpenCrud={() => {
                            if (!inputsDisabled) setModalEntidad({ tipo: "nacionalidades" });
                        }}
                        showCrud={!inputsDisabled}
                        crudAlign="right"
                        selectClassName={INPUT_CLASS}
                    />

                    <SelectConCrud
                        searchable
                        readOnly={inputsDisabled}
                        placeholder="Localidad"
                        options={localidades.map((l) => ({
                            id: l.id_localidad,
                            label: l.nombre_localidad,
                        }))}
                        value={form.localidad ?? ""}
                        onChange={(val) => setField("localidad", val ?? "")}
                        onOpenCrud={() => {
                            if (!inputsDisabled) setModalEntidad({ tipo: "localidades" });
                        }}
                        showCrud={!inputsDisabled}
                        crudAlign="right"
                        selectClassName={INPUT_CLASS}
                    />

                    <input
                        name="telefono"
                        placeholder="Teléfono"
                        value={form.telefono ?? ""}
                        onChange={(e) => setField("telefono", e.target.value)}
                        disabled={inputsDisabled}
                        className={INPUT_CLASS}
                    />
                    <input
                        name="email"
                        placeholder="Email"
                        value={form.email ?? ""}
                        onChange={(e) => setField("email", e.target.value)}
                        disabled={inputsDisabled}
                        className={INPUT_CLASS}
                    />

                    <textarea
                        name="anexo"
                        placeholder="Anexo"
                        value={form.anexo ?? ""}
                        onChange={(e) => setField("anexo", e.target.value)}
                        disabled={inputsDisabled}
                        className={`${INPUT_CLASS} col-span-2 min-h-[110px]`}
                    />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className={DANGER_BUTTON_CLASS}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={loading || (isEditMode && !editingEnabled)}
                    >
                        {loading ? "Guardando..." : isEditMode ? "Actualizar" : "Guardar"}
                    </button>
                </div>
            </div>

            {/* Modal de mensajes */}
            {modalInfo && (
                <ModalMensaje
                    tipo={modalInfo.tipo}
                    titulo={modalInfo.titulo}
                    mensaje={modalInfo.mensaje}
                    onCerrar={modalInfo.onCerrar || (() => setModalInfo(null))}
                />
            )}

            {/* Modal para editar listas auxiliares */}
            {modalEntidad?.tipo === "coberturas" && (
                <ModalListaEditable
                    titulo="Coberturas"
                    endpoint="coberturas"
                    campoNombre="nombre_cobertura"
                    idCampo="id_cobertura"
                    onClose={async () => {
                        setModalEntidad(null);
                        await refreshEntidad("coberturas");
                    }}
                />
            )}
            {modalEntidad?.tipo === "nacionalidades" && (
                <ModalListaEditable
                    titulo="Nacionalidades"
                    endpoint="nacionalidades"
                    campoNombre="nombre_nacionalidad"
                    idCampo="id_nacionalidad"
                    onClose={async () => {
                        setModalEntidad(null);
                        await refreshEntidad("nacionalidades");
                    }}
                />
            )}
            {modalEntidad?.tipo === "localidades" && (
                <ModalListaEditable
                    titulo="Localidades"
                    endpoint="localidades"
                    campoNombre="nombre_localidad"
                    idCampo="id_localidad"
                    onClose={async () => {
                        setModalEntidad(null);
                        await refreshEntidad("localidades");
                    }}
                />
            )}
        </div>
    );
}
