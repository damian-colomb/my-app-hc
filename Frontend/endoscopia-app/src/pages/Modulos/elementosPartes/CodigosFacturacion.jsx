import React, { useMemo, useState } from "react";
import { LuTrash2 } from "react-icons/lu";

/**
 * CodigosFacturacion.jsx
 * UI compacta para cargar hasta 3 códigos y porcentajes por integrante del equipo
 * (Cirujano, 1er Ayudante, 2do Ayudante, 3er Ayudante).
 *
 * Props:
 *  - value: {
 *      cirujano:   [{ codigo: string, porcentaje: number|null }, ... (max 3)],
 *      ayudante1:  [...],
 *      ayudante2:  [...],
 *      ayudante3:  [...]
 *    }
 *  - onChange: (nextValue) => void
 *  - readOnly: boolean (desactiva inputs)
 *  - className: string (wrapper)
 *  - onOpenCatalog: () => void   // callback del botón "Códigos"
 */

const ROLES = [
  { key: "cirujano",  label: "Cirujano" },
  { key: "ayudante1", label: "1er Ayudante" },
  { key: "ayudante2", label: "2do Ayudante" },
  { key: "ayudante3", label: "3er Ayudante" },
];

const BLANK_ROW = { codigo: "", porcentaje: "" };

function padRows(rows, max = 3) {
  const base = Array.isArray(rows) ? rows.slice(0, max) : [];
  while (base.length < max) base.push({ ...BLANK_ROW });
  return base;
}

function safeValue(v) {
  return {
    cirujano:  padRows(v?.cirujano, 3),
    ayudante1: padRows(v?.ayudante1, 3),
    ayudante2: padRows(v?.ayudante2, 3),
    ayudante3: padRows(v?.ayudante3, 3),
  };
}

export function emptyCodigos() {
  return safeValue({});
}

export default function CodigosFacturacion({ value, onChange, readOnly = false, className = "", onOpenCatalog }) {
  const [open, setOpen] = useState({
    cirujano: false,
    ayudante1: false,
    ayudante2: false,
    ayudante3: false,
  });
  function toggleRole(key, force) {
    setOpen((prev) => ({ ...prev, [key]: typeof force === "boolean" ? force : !prev[key] }));
  }

  const val = useMemo(() => safeValue(value), [value]);

  function updateCell(roleKey, idx, patch) {
    const next = safeValue(val);
    next[roleKey] = next[roleKey].map((row, i) => (i === idx ? { ...row, ...patch } : row));
    onChange?.(next);
  }

  function handleCodigo(roleKey, idx, e) {
    updateCell(roleKey, idx, { codigo: e.target.value });
  }
  function handlePorcentaje(roleKey, idx, e) {
    let v = String(e.target.value ?? "");
    // permitir vacío
    if (v.trim() === "") return updateCell(roleKey, idx, { porcentaje: "" });
    // aceptar formatos como "30", "30%", " 30 % "
    const digits = v.replace(/[^0-9]/g, "");
    if (digits === "") return updateCell(roleKey, idx, { porcentaje: "" });
    const n = Number(digits);
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    updateCell(roleKey, idx, { porcentaje: clamped });
  }

  function applyPreset(roleKey, idx, preset, codeText) {
    const patch = { porcentaje: Number(preset) };
    if (typeof codeText === "string") patch.codigo = codeText;
    updateCell(roleKey, idx, patch);
  }

  return (
    <section className={`mt-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-300">Códigos de facturación</h3>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 h-7 rounded border border-gray-600 text-gray-200 hover:bg-gray-800"
          onClick={() => onOpenCatalog?.()}
        >
          Códigos
        </button>
      </div>

      <div className="space-y-4">
        {ROLES.map(({ key, label }) => (
          <div key={key}>
            {!open[key] ? (
              <div
                className="flex items-center justify-between px-2 py-2 border border-gray-700 rounded-md bg-gray-800/50 cursor-pointer hover:bg-gray-800/70"
                onClick={() => toggleRole(key, true)}
                title={`Expandir ${label}`}
              >
                <div className="text-xs text-gray-300">{label}</div>
                <div className="text-xs text-gray-500">(mostrar)</div>
              </div>
            ) : (
              <fieldset className="border border-gray-700 rounded-md p-3">
                <legend
                  className="px-2 py-1 text-xs text-gray-300 flex items-center justify-between w-full cursor-pointer select-none rounded bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700"
                  onClick={() => toggleRole(key, false)}
                  title={`Contraer ${label}`}
                >
                  <span>{label}</span>
                </legend>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-28 text-center">Código</span>
                    <span className="w-16 text-center">%</span>
                    <span className="flex-1" />
                  </div>

                  {val[key].map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap justify-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={`Código ${idx + 1}`}
                        className={`w-36 h-8 px-2 rounded border text-center ${readOnly ? "bg-gray-900 border-gray-700 text-gray-400" : "bg-gray-800 border-gray-600 text-gray-100"}`}
                        value={row.codigo ?? ""}
                        onChange={(e) => handleCodigo(key, idx, e)}
                        disabled={readOnly}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="%"
                        className={`w-16 h-8 px-2 rounded border text-center ${readOnly ? "bg-gray-900 border-gray-700 text-gray-400" : "bg-gray-800 border-gray-600 text-gray-100"}`}
                        value={row.porcentaje === "" || row.porcentaje == null ? "" : `${row.porcentaje}%`}
                        onChange={(e) => handlePorcentaje(key, idx, e)}
                        disabled={readOnly}
                      />
                      <div className="inline-flex items-center gap-1">
                        {key === "cirujano" && (
                          <button
                            type="button"
                            className="text-[11px] px-2 h-6 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
                            onClick={(e) => { e.stopPropagation(); if (!readOnly) applyPreset(key, idx, 100); }}
                            disabled={readOnly}
                            title="Cargar 100% en esta fila"
                          >
                            100%
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-[11px] px-2 h-6 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
                          onClick={(e) => { e.stopPropagation(); if (!readOnly) applyPreset(key, idx, 25); }}
                          disabled={readOnly}
                          title="Cargar 25% en esta fila"
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          className="text-[11px] px-2 h-6 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
                          onClick={(e) => { e.stopPropagation(); if (!readOnly) applyPreset(key, idx, 30, "Adicional VLP"); }}
                          disabled={readOnly}
                          title="Cargar 30% y 'Adicional VLP' en esta fila"
                        >
                          Adicional VLP
                        </button>
                        <button
                          type="button"
                          className="p-1 h-6 w-6 flex items-center justify-center rounded border border-gray-600 text-gray-400 hover:bg-gray-800"
                          onClick={(e) => { e.stopPropagation(); if (!readOnly) updateCell(key, idx, { codigo: "", porcentaje: "" }); }}
                          disabled={readOnly}
                          title="Borrar fila"
                        >
                          <LuTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
