// src/components/CargaProfesionales.jsx
import React, { useEffect, useState } from "react";
import { FiX, FiSave } from "react-icons/fi";

/**
 * Modal reutilizable para cargar profesionales:
 *  - cirujanos
 *  - anestesiologos
 *  - instrumentadores
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onCreated: (row) => void   // callback al crear OK
 *  - defaultTipo?: "cirujano" | "anestesiologo" | "instrumentador"
 *  - onSave?: async ({ tipo, nombre }) => ({ id, nombre, tipo })  // opcional, para usar tu propio endpoint
 */
export default function CargaProfesionales({
    open,
    onClose,
    onCreated,
    defaultTipo = "cirujano",
    onSave
}) {
    const [tipo, setTipo] = useState(defaultTipo);
    const [nombre, setNombre] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setTipo(defaultTipo);
            setNombre("");
            setLoading(false);
            setError("");
        }
    }, [open, defaultTipo]);

    async function defaultSave({ tipo, nombre }) {
        // Endpoints por defecto; cambialos si usás otra ruta
        const endpoints = {
            cirujano: "/api/cirujanos",
            anestesiologo: "/api/anestesiologos",
            instrumentador: "/api/instrumentadores"
        };
        const url = endpoints[tipo];
        const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre })
        });
        if (!r.ok) {
            const txt = await r.text().catch(() => "");
            throw new Error(txt || `Error ${r.status}`);
        }
        return await r.json();
    }

    async function handleSave() {
        try {
            setError("");
            if (!nombre.trim()) {
                setError("El nombre es obligatorio.");
                return;
            }
            setLoading(true);
            const saver = onSave || defaultSave;
            const created = await saver({ tipo, nombre: nombre.trim() });
            onCreated && onCreated(created || { id: Date.now(), nombre: nombre.trim(), tipo });
            onClose && onClose();
        } catch (e) {
            setError(e?.message || "No se pudo guardar.");
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative max-w-md w-full mx-4 bg-gray-900 border border-gray-700 rounded-md p-4 text-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Cargar profesional</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded border border-gray-600 hover:bg-gray-800"
                        aria-label="Cerrar"
                        title="Cerrar"
                    >
                        <FiX />
                    </button>
                </div>

                <div className="space-y-3">
                    <label className="flex flex-col">
                        <span className="text-gray-300 mb-1">Tipo</span>
                        <select
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-100"
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                        >
                            <option value="cirujano">Cirujano</option>
                            <option value="anestesiologo">Anestesiólogo</option>
                            {/* Instrumentador y Circulante salen de la misma tabla "instrumentadores".
                               Acá solo cargamos la persona; el rol lo definís en el parte. */}
                            <option value="instrumentador">Instrumentador / Circulante</option>
                        </select>
                    </label>

                    <label className="flex flex-col">
                        <span className="text-gray-300 mb-1">Nombre</span>
                        <input
                            autoFocus
                            type="text"
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-100"
                            placeholder="Ej. Juan Pérez"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />
                    </label>

                    {error && (
                        <div className="text-red-400 text-sm">{error}</div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 border border-emerald-600 text-emerald-200 hover:bg-emerald-950 px-3 py-1 rounded disabled:opacity-60"
                        >
                            <FiSave />
                            {loading ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}