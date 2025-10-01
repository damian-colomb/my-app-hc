import React, { useRef, useCallback, useState, useEffect } from "react";
import { FiPlus } from "react-icons/fi";

const CRUD_BUTTON_CLASS = "inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-lg border border-emerald-600/60 bg-emerald-500/10 text-emerald-200 transition hover:bg-emerald-500/20 focus:outline-none focus:ring-1 focus:ring-emerald-300 disabled:opacity-50";

/**
 * Select genérico con botón "+" para abrir CRUD externo (ModalBases).
 * El modal lo maneja el padre (onOpenCrud).
 */
// --- SelectConCrud (solo muestra el "+" si hay onOpenCrud y !readOnly) ---
export function SelectConCrud({
    readOnly,
    label,
    placeholder = "Seleccionar…",
    options = [],           // [{ id, label }]
    value,
    onChange,               // (id) => void
    titleForValue = "",
    onOpen,                 // opcional: () => void (se llama al abrir el select)
    onClose,                // opcional: () => void (se llama al cerrar el select)
    onOpenCrud,             // opcional: (name, id) => void (se llama para abrir modal CRUD)
    // extra opcional a la derecha
    extraValue,
    onChangeExtra,
    extraPlaceholder = "",
    cols = 6,
    selectColSpan,
    extraColSpan,
    tightRight = false,
    showSelectedChip = false,
    selectClassName = "",
    searchable = false,
    showSearchInput = true,
    maxItems,
}) {
    // --- Normalización de opciones y value (evita que quede el placeholder si ya hay valor) ---
    function firstDefined(...vals) {
      for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
      return undefined;
    }

    const normalizedOptions = Array.isArray(options)
      ? options
          .map((opt) => {
            const rawId = firstDefined(
              opt?.id,
              opt?.value,
              opt?.id_cirujano,
              opt?.id_anestesiologo,
              opt?.id_instrumentador,
              opt?.id_circulante,
              opt?.id_tecnica,
              opt?.id_diagnostico,
              opt?.id_tipo_anestesia,
              opt?.key
            );
            const rawLabel = firstDefined(
              opt?.label,
              opt?.nombre,
              opt?.nombre_cirujano,
              opt?.nombre_diagnostico,
              opt?.nombre_tecnica,
              opt?.nombre_cobertura,
              opt?.descripcion,
              opt?.text
            );
            const id = rawId != null ? String(rawId) : "";
            const label = (rawLabel != null ? String(rawLabel) : "").trim();
            return { id, label };
          })
          .filter((o) => o.label) // Permitir opciones con id vacío pero con label válido - VERCEL CACHE BUST $(date)
      : [];
    // dedup por id
    {
        const seenIds = new Set();
        for (let i = normalizedOptions.length - 1; i >= 0; i--) {
            const id = normalizedOptions[i].id;
            if (seenIds.has(id)) {
                normalizedOptions.splice(i, 1);
            } else {
                seenIds.add(id);
            }
        }
    }

    const currentValueStr = value != null ? String(value) : "";

    // Usamos todas las opciones: los <select> nativos ya traen scroll cuando hay muchas
    const effectiveOptions = normalizedOptions;

    const computedTitle = titleForValue || (
        normalizedOptions.find(opt => String(opt.id) === currentValueStr)?.label || ""
    );

    // --- Custom searchable dropdown state (only used if searchable && !readOnly) ---
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef(null);
    const prevValueRef = useRef(currentValueStr);
    const openedRef = useRef(false);

    const closeDropdown = useCallback(() => {
        setOpen(false);
        setQuery("");
        openedRef.current = false;
        if (typeof onClose === "function") {
            try { onClose(); } catch {}
        }
    }, [onClose]);

    useEffect(() => {
      function onDocClick(e) {
        if (!rootRef.current) return;
        if (!rootRef.current.contains(e.target)) {
          closeDropdown();
        }
      }
      
      function onScroll(e) {
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
      
      function onKeyDown(e) {
        if (open) {
          // Solo cerrar con Escape
          if (e.key === 'Escape') {
            closeDropdown();
          }
          // No bloquear otras teclas para permitir escritura normal
        }
      }
      
      if (open) {
        // Solo agregar event listeners para cerrar el dropdown
        document.addEventListener("mousedown", onDocClick);
        
        return () => {
          // Remover event listeners
          document.removeEventListener("mousedown", onDocClick);
        };
      }
    }, [closeDropdown, open]);

    const filtered = (showSearchInput !== false && query)
      ? effectiveOptions.filter(o => (o.label || "").toLowerCase().includes(query.toLowerCase()))
      : effectiveOptions;


    const spanCls = (n) => {
        switch (n) {
            case 1: return "col-span-1";
            case 2: return "col-span-2";
            case 3: return "col-span-3";
            case 4: return "col-span-4";
            case 5: return "col-span-5";
            case 6: return "col-span-6";
            default: return "col-span-5"; // fallback compatible con versión anterior
        }
    };
    const gridColsCls = cols === 6 ? "grid-cols-6" : (cols === 5 ? "grid-cols-5" : (cols === 4 ? "grid-cols-4" : "grid-cols-6"));
    const selSpan = typeof selectColSpan === "number" ? selectColSpan : 5;
    const extSpan = typeof extraColSpan === "number" ? extraColSpan : 5;

    // Disparar onOpen al abrir el <select> (una vez por apertura)
    useEffect(() => {
        if (prevValueRef.current !== currentValueStr) {
            prevValueRef.current = currentValueStr;
            requestAnimationFrame(closeDropdown);
        }
    }, [currentValueStr, closeDropdown]);
    const handleOpen = useCallback(() => {
        console.log('SelectConCrud handleOpen called');
        if (typeof onOpen === "function" && !openedRef.current) {
            openedRef.current = true;
            console.log('Calling onOpen...');
            try { onOpen(); } catch {}
        }
    }, [onOpen]);
    const handleClose = useCallback(() => {
        console.log('SelectConCrud handleClose called');
        openedRef.current = false;
        if (typeof onClose === "function") {
            console.log('Calling onClose...');
            try { onClose(); } catch {}
        }
    }, [onClose]);

    function renderSelector() {
      // Mostramos dropdown buscable solo si el padre lo pide explícitamente
      const showCustom = !readOnly && searchable;
      // Si no hay opciones, forzamos el select nativo
      const forceNative = effectiveOptions.length === 0;
      if (!showCustom || forceNative) {
        // Native select (browser dropdown)
        return (
          <select
            className={`flex-1 min-w-0 border rounded-lg px-3 h-10 truncate ${readOnly ? 'pq-readonly' : 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800'} ${selectClassName}`}
            value={currentValueStr}
            onMouseDown={handleOpen}
            onFocus={handleOpen}
            onBlur={handleClose}
            onChange={(e) => {
              const raw = e.target.value;
              const id = raw ? (isNaN(Number(raw)) ? raw : Number(raw)) : null;
              onChange && onChange(id);
            }}
            title={computedTitle}
            disabled={readOnly}
          >
            {(!currentValueStr) && <option value="">{placeholder}</option>}
            {effectiveOptions.map((opt, idx) => (
              <option key={`${opt.id ?? idx}`} value={opt.id} title={opt.label || ""}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }

      // Custom dropdown with search and max 5 visible (scroll for más)
      return (
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            className={`w-full border rounded-lg px-3 h-10 flex items-center justify-between bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800`}
            onClick={() => {
              setOpen((v) => {
                if (v) {
                  requestAnimationFrame(closeDropdown);
                  return false;
                }
                if (typeof onOpen === "function" && !openedRef.current) {
                  openedRef.current = true;
                  try { onOpen(); } catch {}
                }
                return true;
              });
            }}
            title={computedTitle}
          >
            <span className="truncate">{computedTitle || placeholder}</span>
            <span className="ml-2 text-xs opacity-70">▾</span>
          </button>
          {open && (
            <div className="absolute z-50 mt-1 w-full border border-gray-600 rounded bg-gray-900 shadow-lg">
              {showSearchInput !== false && (
                <div className="p-1 border-b border-gray-700">
                  <div className="relative">
                    <input
                      className="w-full px-2 py-1 pr-8 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100"
                      placeholder="Buscar…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof onOpenCrud === "function") {
                          onOpenCrud(query);
                        }
                      }}
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-xs flex items-center justify-center"
                      title="Crear nuevo"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              <ul className="max-h-48 overflow-y-auto"> {/* ~5 items visibles */}
                {filtered.length === 0 && (
                  <li className="px-2 py-2 text-sm text-gray-400 select-none">Sin resultados</li>
                )}
                {filtered.map((opt, idx) => (
                  <li
                    key={`${opt.id ?? idx}`}
                    className="px-2 py-1 text-sm text-gray-100 hover:bg-gray-700 cursor-pointer flex items-center justify-between group"
                    title={opt.label || ''}
                    onClick={() => {
                      const raw = opt.id;
                      const id = raw ? (isNaN(Number(raw)) ? raw : Number(raw)) : null;
                      onChange && onChange(id);
                      requestAnimationFrame(closeDropdown);
                    }}
                  >
                    <span className="flex-1 truncate">{opt.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof onOpenCrud === "function") {
                          onOpenCrud(opt.label, opt.id);
                        }
                      }}
                      className="ml-2 w-5 h-5 bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white rounded text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Editar"
                    >
                      ✏️
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return (
        <label ref={rootRef} className={`flex flex-col w-full min-w-0 ${tightRight ? "-mr-2 sm:-mr-3" : ""}`}>
            {label && <span className="text-gray-400">{label}</span>}

            {typeof onChangeExtra === "function" ? (
                // MODO CON EXTRA: mantenemos grid compacta
                <div className={`grid ${gridColsCls} gap-y-1 gap-x- items-stretch w-full`}>
                    {/* select */}
                    <div className={`${spanCls(selSpan)} flex items-center gap-2 relative`}>
                        {renderSelector()}
                    </div>

                    {/* campo extra a la derecha */}
                    <input
                        className={`${spanCls(extSpan)} w-full border rounded-lg px-3 h-10 ${readOnly ? 'pq-readonly' : 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800'}`}
                        value={extraValue || ""}
                        onChange={(e) => onChangeExtra(e.target.value)}
                        placeholder={extraPlaceholder}
                        disabled={readOnly}
                    />
                </div>
            ) : (
                // MODO SIN EXTRA: sólo select
                <div className="flex items-center w-full gap-2 relative">
                    {renderSelector()}
                </div>
            )}

            {showSelectedChip && computedTitle && (
                <div className="mt-1 w-full">
                    <div className="w-full flex items-center justify-between px-2 py-1 rounded-md border border-emerald-600/40 bg-emerald-700/20 text-emerald-200 text-sm">
                        <span className="truncate" title={computedTitle}>{computedTitle}</span>
                        <button
                            type="button"
                            onClick={() => onChange && onChange(null)}
                            className="ml-2 text-emerald-200 hover:text-emerald-100 focus:outline-none"
                            title="Eliminar"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </label>
    );
}

/** Input de texto simple con label */
export function InputTexto({
    readOnly,
    label,
    value,
    onChange,               // (text) => void
    placeholder = "",
    type = "text",
    title = "",
}) {
    return (
        <label className="flex flex-col w-full">
            {label && <span className="text-gray-400">{label}</span>}
            <input
                type={type}
                className={`w-full border rounded-lg px-3 h-10 ${readOnly ? 'pq-readonly' : 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800'}`}
                value={value ?? ""}
                onChange={(e) => onChange && onChange(e.target.value)}
                placeholder={placeholder}
                title={title}
                disabled={readOnly}
            />
        </label>
    );
}

/** TextArea con contador opcional */
export function TextAreaDetalle({
    readOnly,
    label,
    value,
    onChange,               // (text) => void
    placeholder = "",
    rows = 10,
    showCount = false,
    maxLength = 5000,
}) {
    const len = (value || "").length;
    return (
        <label className="flex flex-col w-full">
            <span className="text-gray-400 flex items-center justify-between">
                <span>{label}</span>
                {showCount && <span className="text-xs text-gray-400">{len}/{maxLength}</span>}
            </span>
            <textarea
                className={`w-full border rounded-lg px-3 py-3 text-sm resize-none ${readOnly ? 'pq-readonly' : 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800'}`}
                value={value || ""}
                onChange={(e) => onChange && onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                disabled={readOnly}
            ></textarea>
        </label>
    );
}
