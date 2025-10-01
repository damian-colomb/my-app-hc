import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../config.js";

/**
 * ModalPlantillasTecnicas — versión robusta y estable
 * Props esperadas:
 * - open (bool)
 * - onClose () => void
 * - apiBase (string)        // default: "/api"
 * - endpoint (string)       // default: "/catalogos/plantillas_tecnicas/"
 * - onUse  (tpl) => void
 * - onMutated (list) => void
 * - items (array) | lista (array)
 */
export default function ModalPlantillasTecnicas({
    open,
    onClose,
    apiBase = API_BASE,
    endpoint = "/plantillas/plantillas_tecnicas_cx",
    onUse,
    onMutated,
    items: itemsProp,
    lista: listaProp,
    }) {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [form, setForm] = useState({ id: null, tecnica: "", desarrollo: "" });
    const [confirmDelete, setConfirmDelete] = useState(null);
    const successTimerRef = useRef(null);

    const safeItems = Array.isArray(items) ? items : [];
    const apiUrl = useMemo(() => {
        const base = `${apiBase || ""}${endpoint || ""}`;
        return base.replace(/\/*$/, "/");
    }, [apiBase, endpoint]);

    const normalize = (row) => ({
        id: row?.id_plantilla ?? row?.id ?? null,
        tecnica: row?.tecnica ?? row?.nombre ?? "",
        desarrollo: row?.desarrollo ?? row?.detalle ?? "",
        activo: row?.activo ?? true,
    });

    const seededRef = useRef(false);

    useEffect(() => {
        if (open) {
            seededRef.current = false;
            setError("");
            setSuccess("");
            if (successTimerRef.current) {
                clearTimeout(successTimerRef.current);
                successTimerRef.current = null;
            }
        }
    }, [open]);

    useEffect(() => {
        if (!success) return;
        if (successTimerRef.current) {
            clearTimeout(successTimerRef.current);
        }
        successTimerRef.current = setTimeout(() => {
            setSuccess("");
        }, 2500);
        return () => {
            if (successTimerRef.current) {
                clearTimeout(successTimerRef.current);
                successTimerRef.current = null;
            }
        };
    }, [success]);

    useEffect(() => {
        if (!open || seededRef.current) return;
        const seed = Array.isArray(itemsProp)
        ? itemsProp
        : Array.isArray(listaProp)
        ? listaProp
        : [];
        if (Array.isArray(seed) && seed.length > 0) {
        const list = seed.map(normalize).sort((a, b) => a.tecnica.localeCompare(b.tecnica));
        setItems(list);
        seededRef.current = true;
        return;
        }
        (async () => {
        setLoading(true);
        setError("");
        try {
            const r = await fetch(apiUrl, { cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            const list = (Array.isArray(data) ? data : []).map(normalize);
            list.sort((a, b) => a.tecnica.localeCompare(b.tecnica));
            setItems(list);
        } catch (e) {
            setItems([]);
            setError("No se pudieron cargar las plantillas");
        } finally {
            setLoading(false);
            seededRef.current = true;
        }
        })();
    }, [open, itemsProp, listaProp, apiUrl]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            if (!loading) {
            setTimeout(() => {
                onMutated?.(safeItems);
                onClose?.();
            }, 0);
            }
        }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, loading, safeItems, onClose, onMutated]);

    const filtered = useMemo(() => {
        const q = (filter || "").trim().toLowerCase();
        const base = Array.isArray(safeItems) ? safeItems : [];
        if (!q) return base;
        return base.filter(
        (it) => (it.tecnica || "").toLowerCase().includes(q) || (it.desarrollo || "").toLowerCase().includes(q)
        );
    }, [safeItems, filter]);

    async function doSave() {
        const body = JSON.stringify({ tecnica: form.tecnica, desarrollo: form.desarrollo });
        try {
            setLoading(true);
            setError("");
            setSuccess("");
            if (!form.tecnica?.trim() || !form.desarrollo?.trim()) {
                setError("Completá técnica y desarrollo");
                return;
            }
            const isCreating = !form.id;
            let saved;
            if (form.id) {
                const r = await fetch(`${apiUrl}${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                saved = normalize(await r.json());
            } else {
                const r = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                saved = normalize(await r.json());
            }
            setItems((prev) => {
                const base = Array.isArray(prev) ? prev : [];
                const exists = base.some((p) => p.id === saved.id);
                const next = exists ? base.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...base];
                next.sort((a, b) => a.tecnica.localeCompare(b.tecnica));
                onMutated?.(next);
                return next;
            });

            if (isCreating) {
                // limpiar inputs tras crear y mostrar banner verde
                setError("");
                setSuccess("Plantilla guardada con éxito");
                // usar microtask para evitar reinyectar valores por renders intermedios
                Promise.resolve().then(() => {
                    setForm({ id: null, tecnica: "", desarrollo: "" });
                });
            } else {
                // al actualizar, limpiar inputs y mostrar banner de éxito
                setError("");
                setSuccess("Plantilla actualizada con éxito");
                // limpiar inmediatamente
                setForm({ id: null, tecnica: "", desarrollo: "" });
                // reforzar en el próximo tick por si algún re-render reinyecta valores
                setTimeout(() => {
                    setForm({ id: null, tecnica: "", desarrollo: "" });
                }, 0);
            }
        } catch (e) {
            setError("No se pudo guardar la plantilla");
        } finally {
            setLoading(false);
        }
    }

    async function doDelete(it) {
        if (!it?.id) return;
        try {
        setLoading(true);
        setError("");
        const r = await fetch(`${apiUrl}${it.id}`, { method: "DELETE" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setItems((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            const next = base.filter((p) => p.id !== it.id);
            onMutated?.(next);
            return next;
        });
        if (form.id === it.id) setForm({ id: null, tecnica: "", desarrollo: "" });
        } catch (e) {
        setError("No se pudo eliminar la plantilla");
        } finally {
        setLoading(false);
        setConfirmDelete(null);
        }
    }

    if (!open) return null;
    const listToRender = Array.isArray(filtered) ? filtered : [];
    const scrollStyles = (
        <style>{`
        /* Scrollbar estilizado SOLO para la lista de plantillas */
        .tpl-scroll { scrollbar-width: thin; }
        .tpl-scroll::-webkit-scrollbar { width: 10px; }
        .tpl-scroll::-webkit-scrollbar-track { background: rgba(17, 24, 39, 0.25); border-radius: 8px; }
        .tpl-scroll::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.45); border-radius: 8px; }
        .tpl-scroll::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.65); }
        `}</style>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
        {scrollStyles}
        <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
            if (!loading) {
                setTimeout(() => {
                onMutated?.(safeItems);
                onClose?.();
                }, 0);
            }
            }}
        />

        <div className="relative z-10 mx-3 w-full max-w-5xl rounded-md bg-gray-900 border border-gray-700 text-gray-100 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h2 className="text-lg font-semibold">Plantillas técnicas</h2>
            {loading && <span className="text-xs text-slate-400">cargando…</span>}
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-5">
            <div className="md:col-span-2">
                <div className="mb-2 flex items-center gap-2">
                <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Buscar…"
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-400"
                />
                <button
                    className="rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                    onClick={() => setFilter("")}
                >
                    Limpiar
                </button>
                </div>
                <div className="max-h-80 overflow-y-auto overflow-x-hidden rounded-md border border-gray-700 tpl-scroll">
                {listToRender.length === 0 ? (
                    <div className="p-4 text-sm text-gray-400">Sin resultados</div>
                ) : (
                    <ul className="divide-y">
                    {listToRender.map((it) => (
                        <li key={it.id} className="flex items-center justify-between p-2 hover:bg-gray-700">
                        <button
                            onClick={() => { 
                                            setError("");
                                            setSuccess("");
                                            setForm({ id: it.id, tecnica: it.tecnica, desarrollo: it.desarrollo });
                                        }}
                            className="flex-1 h-16 overflow-hidden rounded-md bg-gray-900/60 px-3 py-2 text-left hover:bg-gray-800 flex flex-col justify-center gap-1 border border-gray-600/40"
                            title="Seleccionar"
                        >
                            <div className="font-medium text-emerald-400 block w-full truncate">{it.tecnica}</div>
                            <div className="block w-full truncate text-sm text-gray-400">{it.desarrollo}</div>
                        </button>
                        <button
                            type="button"
                            aria-label="Borrar"
                            className="ml-2 inline-flex items-center justify-center w-8 h-8 text-gray-200 hover:text-red-500"
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(it); }}
                        >
                            🗑️
                        </button>
                        </li>
                    ))}
                    </ul>
                )}
                </div>
            </div>

            <div className="md:col-span-3">
                {success && (
                    <div className="mb-3 rounded-md border border-emerald-600 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-200">{success}</div>
                )}
                {error && (
                <div className="mb-3 rounded-md border border-amber-600 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">{error}</div>
                )}

                <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-gray-300">Nombre de la técnica</label>
                <input
                    value={form.tecnica}
                    onChange={(e) => setForm((f) => ({ ...f, tecnica: e.target.value }))}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-400"
                />
                </div>

                <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-300">Desarrollo</label>
                <textarea
                    value={form.desarrollo}
                    onChange={(e) => setForm((f) => ({ ...f, desarrollo: e.target.value }))}
                    rows={12}
                    className="w-full resize-y rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-400"
                />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={doSave}
                    disabled={loading}
                    className="rounded-md border border-emerald-600 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                    {form.id ? "Guardar cambios" : "Crear plantilla"}
                </button>
                {typeof onUse === "function" && (
                    <button
                    type="button"
                    onClick={() => onUse({ ...form })}
                    className="rounded-md border border-sky-600 bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
                    >
                    Usar en parte
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => {
                    if (!loading) {
                        setTimeout(() => {
                        onMutated?.(safeItems);
                        onClose?.();
                        }, 0);
                    }
                    }}
                    disabled={loading}
                    className="ml-auto rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                >
                    Salir
                </button>
                </div>
            </div>
            </div>
        </div>

        {confirmDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDelete(null)} />
            <div className="relative z-10 w-full max-w-md rounded-md border border-gray-700 bg-gray-900 p-4 text-gray-100 shadow-xl">
                <div className="mb-3 flex items-center justify-between border-b border-gray-700 pb-2">
                <h3 className="text-base font-semibold">Confirmar eliminación</h3>
                <button className="text-gray-400 hover:text-gray-200" onClick={() => setConfirmDelete(null)}>✕</button>
                </div>
                <p className="mb-4 text-sm text-gray-300">¿Eliminar la plantilla "{confirmDelete.tecnica}"?</p>
                <div className="flex justify-end gap-2">
                <button
                    className="rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                    onClick={() => setConfirmDelete(null)}
                >
                    Cancelar
                </button>
                <button
                    className="rounded-md border border-red-600 bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
                    onClick={() => doDelete(confirmDelete)}
                >
                    Eliminar
                </button>
                </div>
            </div>
            </div>
        )}
        </div>
    );
}
