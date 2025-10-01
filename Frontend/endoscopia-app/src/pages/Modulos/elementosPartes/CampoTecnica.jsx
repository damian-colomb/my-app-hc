// src/pages/Modulos/elementosPartes/CampoTecnica.jsx
import React from "react";
import { keyOf } from "./utils.js";

export default function CampoTecnica({
    readOnly,
    tecnicasCat,
    value,                // id seleccionado (form.id_procedimiento)
    onChange,             // (id) => void
    labelTecnica,
    tecnicaAnexo,
    setTecnicaAnexo,
    onOpenCrud,
}) {
    return (
        <label className="flex flex-col md:col-span-2">
            <span className="text-gray-400">Técnica / Procedimiento</span>
            <div className="grid grid-cols-[minmax(0,1fr)_1fr] gap-x-1 items-stretch w-full">
                <div className="flex gap-0">
                    <select
                        className={`w-full border rounded px-2 py-1 h-9 truncate ${readOnly ? 'pq-readonly' : 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800'}`}
                        value={value || ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            const id = raw ? (isNaN(Number(raw)) ? raw : Number(raw)) : null;
                            onChange(id);
                        }}
                        title={labelTecnica}
                        disabled={readOnly}
                    >
                        <option value="">Técnica / Procedimiento</option>
                        {tecnicasCat.map((t, idx) => (
                            <option
                                key={keyOf(t, idx, 'tec-opt')}
                                value={t.id_tecnica || t.id}
                                title={(t.nombre_tecnica || t.nombre) || ''}
                            >
                                {t.nombre_tecnica || t.nombre}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={onOpenCrud}
                        disabled={readOnly}
                        className="inline-flex items-center justify-center w-9 h-9 border border-gray-600 rounded text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                        title="Abrir CRUD de técnicas (BaseSelect)"
                        aria-label="Abrir CRUD de técnicas (BaseSelect)"
                    >
                        <span className="text-emerald-300 text-base leading-none">+</span>
                    </button>
                </div>
                <input
                    className={`w-full border rounded px-2 h-9 ${readOnly ? 'pq-readonly' : 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800'}`}
                    value={tecnicaAnexo || ''}
                    onChange={(e) => setTecnicaAnexo(e.target.value)}
                    disabled={readOnly}
                />
            </div>
        </label>
    );
}