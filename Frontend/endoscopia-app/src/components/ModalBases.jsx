import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ModalBases (default export)
 * Reusable CRUD modal for base catalogs (cirujanos, anestesiologos, instrumentadores, etc.)
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - title: string
 *  - apiBase: string (e.g., "/api")
 *  - resourcePath: string (e.g., "/bases/cirujanos/")
 *  - items?: Array<{ id?: any, nombre?: string }>
 *  - showNew?: boolean
 *  - showEdit?: boolean
 *  - showDelete?: boolean
 *  - onChanged?: () => Promise<void> | void
 *  - onMutated?: (payload: { action: 'create'|'update'|'delete', item?: any, id?: any, list: Array<{id:any, nombre:string}> }) => void
 */
function ModalBases({
    open,
    onClose,
    title = "Catálogo",
    apiBase = "/api",
    resourcePath = "",
    items = [],
    showNew = true,
    showEdit = true,
    showDelete = true,
    onChanged,
    onMutated,
}) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState("list"); // list | new | edit | confirm-delete
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState("");
    const inputRef = useRef(null);

    // normalización de URLs (evita problemas de / o falta de /)
    const reload = typeof onChanged === "function" ? onChanged : async () => {};
    const apiBaseNorm = (apiBase || "").replace(/\/+$/, "");            // sin barra final
    const resourcePathNorm = (resourcePath || "").replace(/^\/?/, "/");  // con barra inicial
    const baseURL = `${apiBaseNorm}${resourcePathNorm}`.replace(/\/+$/, ""); // sin barra final
    const urlForId = (id) => `${baseURL}/${id}`;

    // Helpers para normalizar id y nombre según el recurso
    const getId = (row) =>
        row?.id ?? row?.id_cirujano ?? row?.id_anestesiologo ?? row?.id_instrumentador ?? row?.id_tecnica ?? row?.id_tipo_anestesia ?? row?.id_diagnostico ?? null;

    const getNombre = (row) =>
        row?.nombre
        ?? row?.nombre_cirujano
        ?? row?.nombre_anestesiologo
        ?? row?.nombre_anestesista
        ?? row?.nombre_instrumentador
        ?? row?.nombre_tecnica
        ?? row?.nombre_procedimiento
        ?? row?.diagnostico
        ?? row?.descripcion
        ?? "";

    const normalize = (row) => ({ id: getId(row), nombre: getNombre(row) });

    const seedFromItems = () => {
        if (Array.isArray(items) && items.length) {
            setList(items.map(normalize));
        }
    };

    const fetchAll = async () => {
        if (!baseURL) return [];
        try {
            setLoading(true);
            const r = await fetch(baseURL, { headers: { Accept: "application/json" } });
            const data = await r.json();
            const arr = Array.isArray(data) ? data : [];
            const norm = arr.map(normalize);
            setList(norm);
            return norm;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("[ModalBases] GET error", e);
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        // Lock scroll body
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        seedFromItems();
        fetchAll();
        return () => {
            document.body.style.overflow = prev;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (mode === "new" || mode === "edit") {
            // focus input cuando abrimos el editor
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [mode]);

    const filtered = useMemo(() => {
        // En modo "new" y "edit" filtramos con lo que se está tipeando en draft
        const base = (mode === "new" || mode === "edit" ? draft : query).trim().toLowerCase();
        if (!base) return list;
        return list.filter((r) => (r.nombre || "").toLowerCase().includes(base));
    }, [mode, query, draft, list]);

    const selected = useMemo(() => list.find((r) => String(r.id) === String(selectedId)) || null, [selectedId, list]);

    const closeAndReset = async () => {
        setMode("list");
        setQuery("");
        setSelectedId(null);
        setDraft("");
        setErrorMsg("");
        try { await reload(); } catch (_) {}
        onClose?.();
    };

    const beginNew = () => {
        setErrorMsg("");
        setDraft("");
        setMode("new");
    };

    const beginEdit = () => {
        setErrorMsg("");
        if (!selected) return;
        setDraft(selected.nombre || "");
        setMode("edit");
    };

    const beginDelete = () => {
        setErrorMsg("");
        if (!selected) return;
        setMode("confirm-delete");
    };

    const doCreate = async () => {
        if (!draft.trim()) { setErrorMsg("El nombre no puede estar vacío"); return; }
        try {
            setSaving(true);
            setErrorMsg("");
            const res = await fetch(baseURL, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ nombre: draft.trim() }),
            });
            if (!res.ok) {
                let detail = "";
                try {
                    const maybeJson = await res.json();
                    detail = maybeJson?.detail || "";
                } catch {
                    try { detail = await res.text(); } catch {}
                }
                if (res.status === 409) {
                    setErrorMsg(detail || "La técnica ya existe");
                    return;
                }
                setErrorMsg(detail || `No se pudo crear (HTTP ${res.status})`);
                return;
            }
            // intento leer el objeto creado (si lo devuelve)
            let created = null;
            try {
                created = await res.json();
            } catch {}
            // refrescamos y notificamos al padre
            const newList = await fetchAll();
            try { await reload(); } catch (_) {}
            try { onMutated && onMutated({ action: 'create', item: created || null, list: newList }); } catch (_) {}
            setMode('list');
            setDraft('');
            return;
        } catch (e) {
            console.error("[ModalBases] POST error", e);
            setErrorMsg(e.message || "No se pudo crear");
        } finally {
            setSaving(false);
        }
    };

    const doUpdate = async () => {
        if (!selected || !draft.trim()) { setErrorMsg("Seleccioná un registro y escribí un nombre"); return; }
        try {
            setSaving(true);
            setErrorMsg("");
            const res = await fetch(urlForId(selected.id), {
                method: "PUT",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ nombre: draft.trim() }),
            });
            if (!res.ok) {
                let detail = "";
                try {
                    const maybeJson = await res.json();
                    detail = maybeJson?.detail || "";
                } catch {
                    try { detail = await res.text(); } catch {}
                }
                if (res.status === 409) { setErrorMsg(detail || "La técnica ya existe"); return; }
                if (res.status === 404) { setErrorMsg(detail || "Técnica no encontrada"); return; }
                setErrorMsg(detail || `No se pudo actualizar (HTTP ${res.status})`);
                return;
            }
            const newList = await fetchAll();
            try { await reload(); } catch (_) {}
            try { onMutated && onMutated({ action: 'update', id: selected.id, item: { id: selected.id, nombre: draft.trim() }, list: newList }); } catch (_) {}
            setMode('list');
            setDraft('');
            return;
        } catch (e) {
            console.error("[ModalBases] PUT error", e);
            setErrorMsg(e.message || "No se pudo actualizar");
        } finally {
            setSaving(false);
        }
    };

    const doDelete = async () => {
        if (!selected) { setErrorMsg("No hay selección"); return; }
        try {
            setSaving(true);
            setErrorMsg("");
            const res = await fetch(urlForId(selected.id), { method: "DELETE", headers: { Accept: "application/json" } });
            if (!res.ok) {
                let detail = "";
                try {
                    const maybeJson = await res.json();
                    detail = maybeJson?.detail || "";
                } catch {
                    try { detail = await res.text(); } catch {}
                }
                if (res.status === 409) { setErrorMsg(detail || "No se puede eliminar: está en uso"); return; }
                if (res.status === 404) { setErrorMsg(detail || "Técnica no encontrada"); return; }
                setErrorMsg(detail || `No se pudo eliminar (HTTP ${res.status})`);
                return;
            }
            const deletedId = selected.id;
            const newList = await fetchAll();
            try { await reload(); } catch (_) {}
            try { onMutated && onMutated({ action: 'delete', id: deletedId, list: newList }); } catch (_) {}
            setMode('list');
            return;
        } catch (e) {
            console.error("[ModalBases] DELETE error", e);
            setErrorMsg(e.message || "No se pudo eliminar");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return createPortal(
        <>
            {/* Overlay */}
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[2px]" onClick={closeAndReset} />

            {/* Modal container */}
            <div className="fixed inset-0 z-[110] overflow-y-auto">
                <div className="min-h-full flex items-start justify-center py-6 px-4">
                    <div className="w-full max-w-2xl rounded-md border border-gray-700 bg-gray-900 text-gray-100 shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                            <h3 className="text-base md:text-lg font-semibold">{title}</h3>
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-gray-600 hover:bg-gray-700"
                                onClick={closeAndReset}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Toolbar */}
                        {(mode === "list" || mode === "new" || mode === "edit") && (
                            <div className="px-4 py-3">
                                <div className="flex flex-col md:flex-row gap-2">
                                    <input
                                        className="flex-1 h-9 bg-gray-800 border border-gray-600 rounded px-2 text-sm"
                                        placeholder="Buscar…"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        {showNew && (
                                            <button
                                                type="button"
                                                onClick={beginNew}
                                                className="h-9 px-3 text-sm rounded border border-emerald-700/60 bg-emerald-900/20 hover:bg-emerald-900/30"
                                            >
                                                Nuevo
                                            </button>
                                        )}
                                        {showEdit && (
                                            <button
                                                type="button"
                                                disabled={!selected}
                                                onClick={beginEdit}
                                                className="h-9 px-3 text-sm rounded border border-cyan-700/60 bg-cyan-900/20 enabled:hover:bg-cyan-900/30 disabled:opacity-40"
                                            >
                                                Editar
                                            </button>
                                        )}
                                        {showDelete && (
                                            <button
                                                type="button"
                                                disabled={!selected}
                                                onClick={beginDelete}
                                                className="h-9 px-3 text-sm rounded border border-rose-700/60 bg-rose-900/20 enabled:hover:bg-rose-900/30 disabled:opacity-40"
                                            >
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {errorMsg && (
                                    <div className="mt-2 rounded border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                                        {errorMsg}
                                    </div>
                                )}

                                {mode === "new" && (
                                    <div className="mt-2 rounded border border-emerald-700/40 bg-emerald-900/15 p-3">
                                        {errorMsg && (
                                            <div className="mb-2 rounded border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                                                {errorMsg}
                                            </div>
                                        )}
                                        <label className="text-sm text-gray-300">Nombre nuevo</label>
                                        <input
                                            ref={inputRef}
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            placeholder="Ej.: Apellido, Nombre"
                                            className="mt-2 h-10 w-full rounded border border-gray-600 bg-gray-800 px-3 text-sm"
                                        />
                                        <div className="mt-3 flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => { setMode("list"); setDraft(""); setErrorMsg(""); }}
                                                className="inline-flex items-center justify-center h-9 px-4 text-sm rounded border border-gray-600 hover:bg-gray-700"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                disabled={saving || !draft.trim()}
                                                onClick={doCreate}
                                                className="inline-flex items-center justify-center h-9 px-4 text-sm rounded border border-emerald-700/60 bg-emerald-900/20 hover:bg-emerald-900/30 disabled:opacity-50"
                                            >
                                                {saving ? "Guardando…" : "Guardar"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {mode === "edit" && (
                                    <div className="mt-2 rounded border border-cyan-700/40 bg-cyan-900/15 p-3">
                                        {errorMsg && (
                                            <div className="mb-2 rounded border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                                                {errorMsg}
                                            </div>
                                        )}
                                        <label className="text-sm text-gray-300">Editar nombre</label>
                                        <input
                                            ref={inputRef}
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            placeholder="Ej.: Apellido, Nombre"
                                            className="mt-2 h-10 w-full rounded border border-gray-600 bg-gray-800 px-3 text-sm"
                                        />
                                        <div className="mt-3 flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => { setMode("list"); setDraft(""); setErrorMsg(""); }}
                                                className="inline-flex items-center justify-center h-9 px-4 text-sm rounded border border-gray-600 hover:bg-gray-700"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                disabled={saving || !draft.trim()}
                                                onClick={doUpdate}
                                                className="inline-flex items-center justify-center h-9 px-4 text-sm rounded border border-cyan-700/60 bg-cyan-900/20 hover:bg-cyan-900/30 disabled:opacity-50"
                                            >
                                                {saving ? "Guardando…" : "Guardar"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* List */}
                                <div className="mt-3 max-h-[50vh] overflow-y-auto rounded border border-gray-700">
                                    {loading ? (
                                        <div className="p-4 text-sm text-gray-400">Cargando…</div>
                                    ) : filtered.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-400">Sin resultados.</div>
                                    ) : (
                                        <ul className="divide-y divide-gray-700">
                                            {filtered.map((row) => (
                                                <li
                                                    key={row.id}
                                                    className={
                                                        "flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-800 " +
                                                        (String(selectedId) === String(row.id) ? "bg-gray-800" : "")
                                                    }
                                                    onClick={() => setSelectedId(row.id)}
                                                    onDoubleClick={() => (showEdit ? beginEdit() : undefined)}
                                                >
                                                    <span className="text-sm text-gray-200">{row.nombre}</span>
                                                    {String(selectedId) === String(row.id) && (
                                                        <span className="text-xs text-gray-400">seleccionado</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={closeAndReset}
                                        className="h-9 px-3 text-sm rounded border border-gray-600 hover:bg-gray-700"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        )}


                        {mode === "confirm-delete" && (
                            <div className="px-4 py-3">
                                <p className="text-sm text-gray-300">¿Eliminar <span className="font-semibold text-rose-300">{(list.find(r => String(r.id) === String(selectedId))?.nombre) || ""}</span>?</p>
                                <div className="mt-3 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setMode("list")}
                                        className="inline-flex items-center justify-center h-9 px-4 text-sm rounded border border-gray-600 hover:bg-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={doDelete}
                                        className="inline-flex items-center justify-center h-9 px-4 text-sm rounded border border-rose-700/60 bg-rose-900/20 hover:bg-rose-900/30 disabled:opacity-50"
                                    >
                                        {saving ? "Eliminando…" : "Eliminar"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}

export default ModalBases;
