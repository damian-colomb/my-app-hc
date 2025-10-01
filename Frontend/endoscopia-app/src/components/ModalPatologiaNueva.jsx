import React, { useEffect, useMemo, useRef, useState } from "react";
import { MdClose } from "react-icons/md";

import { API_BASE } from "../config.js";
const url = (ep) => `${API_BASE.replace(/\/+$/, "")}/${String(ep).replace(/^\//, "")}`;


    function ModalPatologiaNueva({
    open,
    onClose,
    pacienteId,
    procedimientosPendientes = [],
    procedimientosBase = [],
    onSaved,
    defaultRelacionadoId = null,
    defaultSinRelacion = false,
    lockRelacion = false,
    tipoRegistroDefault = "patologia",
    }) {
    const hoyISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const [pendienteSel, setPendienteSel] = useState(null);
    const [idProcedimientoBase, setIdProcedimientoBase] = useState("");
    const [fecha, setFecha] = useState(hoyISO);
    const [informeTexto, setInformeTexto] = useState("");
    const [pdfFile, setPdfFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [autoPreselect, setAutoPreselect] = useState(true);
    const modalRef = useRef(null);
    const dateInputRef = useRef(null);
    const [tipoRegistro, setTipoRegistro] = useState(tipoRegistroDefault);


    // Inferencia: deducir id_procedimiento_base por nombre cuando el pendiente no lo trae
    const inferBaseIdFromNombre = (nombre, baseList) => {
      if (!nombre || !Array.isArray(baseList)) return "";
      const n = String(nombre).toLowerCase();
      const normalizar = (s) => String(s || "").toLowerCase();

      // 1) match exacto
      let found = baseList.find((b) => normalizar(b.procedimiento) === n);
      if (found) return String(found.id_procedimiento);

      // 2) startsWith / includes
      found = baseList.find((b) => normalizar(b.procedimiento).startsWith(n));
      if (found) return String(found.id_procedimiento);
      found = baseList.find((b) => normalizar(b.procedimiento).includes(n));
      if (found) return String(found.id_procedimiento);

      // 3) heurística por keywords
      const tryKeywords = (keywords) => baseList.find((b) => {
        const bn = normalizar(b.procedimiento);
        return keywords.some((k) => bn.includes(k));
      });

      // ejemplos comunes
      const maps = [
        { when: ["vcc", "colonosc"], to: ["vcc", "colonosc"] },
        { when: ["eda", "gastros"], to: ["eda", "gastros", "endoscopia digestiva alta"] },
        { when: ["cpre"], to: ["cpre"] },
        { when: ["recto"], to: ["recto"] },
        { when: ["ciru", "colect", "apend", "hernia"], to: ["ciru"] },
      ];

      for (const rule of maps) {
        if (rule.when.some((k) => n.includes(k))) {
          const cand = tryKeywords(rule.to);
          if (cand) return String(cand.id_procedimiento);
        }
      }

      return ""; // no se pudo inferir
    };

    // Sincronizar tipo base cuando elijo un pendiente (usa id directo o inferencia por nombre)
    useEffect(() => {
      if (!pendienteSel) return;
      if (pendienteSel?.id_procedimiento_base) {
        setIdProcedimientoBase(String(pendienteSel.id_procedimiento_base));
        return;
      }
      const nombre = pendienteSel?.procedimiento_rel?.procedimiento || "";
      const inferido = inferBaseIdFromNombre(nombre, procedimientosBase);
      setIdProcedimientoBase(inferido || "");
      if (pendienteSel?.tipo) {
        setTipoRegistro(String(pendienteSel.tipo).toLowerCase());
      }
    }, [pendienteSel, procedimientosBase]);

    // Cerrar con ESC
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
        if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Cerrar al clickear fuera
    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            onClose?.();
        }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [open, onClose]);

    const pendientesOrdenados = useMemo(() => {
        const arr = Array.isArray(procedimientosPendientes) ? procedimientosPendientes.slice() : [];
        return arr.sort((a, b) => new Date(b?.fecha || 0) - new Date(a?.fecha || 0));
    }, [procedimientosPendientes]);

    // Al abrir: preseleccionar según defaults
    useEffect(() => {
      if (!open) return;

      // Reset campos del formulario
      setFecha(hoyISO);
      setInformeTexto("");
      setPdfFile(null);
      setLoading(false);
      setTipoRegistro(tipoRegistroDefault);

      // Determinar selección inicial según props de apertura
      let initial = null;
      if (defaultSinRelacion) {
        initial = null; // forzar sin relación
      } else if (defaultRelacionadoId) {
        initial = (pendientesOrdenados || []).find(
          (p) => String(p.id_procedimiento_paciente) === String(defaultRelacionadoId)
        ) || null;
      } else {
        initial = (Array.isArray(pendientesOrdenados) && pendientesOrdenados.length > 0)
          ? pendientesOrdenados[0]
          : null;
      }

      setPendienteSel(initial);
      setIdProcedimientoBase(""); // será seteado por el efecto de sincronización o quedará vacío si es sin relación
      if (initial?.tipo) {
        setTipoRegistro(String(initial.tipo).toLowerCase());
      }

      // Si vino alguna instrucción explícita, desactivar autoselección
      if (defaultSinRelacion || defaultRelacionadoId) {
        setAutoPreselect(false);
      } else {
        setAutoPreselect(true);
      }
    }, [open, hoyISO, pendientesOrdenados, defaultRelacionadoId, defaultSinRelacion]);

    // Si los pendientes llegan después de abrir, auto-seleccionar el primero si no hay selección aún
    useEffect(() => {
      if (!open || !autoPreselect || defaultSinRelacion || defaultRelacionadoId) return;
      if (!pendienteSel && pendientesOrdenados.length > 0) {
        const first = pendientesOrdenados[0];
        setPendienteSel(first);
      }
    }, [open, pendientesOrdenados, pendienteSel, autoPreselect, defaultSinRelacion, defaultRelacionadoId]);

    useEffect(() => {
      if (!pendienteSel && defaultSinRelacion) {
        setTipoRegistro(tipoRegistroDefault);
      }
    }, [pendienteSel, defaultSinRelacion, tipoRegistroDefault]);

    const formatearFecha = (fechaStr) => {
        if (!fechaStr) return "";
        const [a, m, d] = fechaStr.split("-");
        return `${d}/${m}/${a}`;
    };

    const isInvalid =
        !pacienteId ||
        !fecha ||
        !idProcedimientoBase; // pendienteSel ahora es opcional

    const handleGuardar = async () => {
        if (isInvalid || loading) return;
        setLoading(true);

        try {
            // 1) Crear patología (PDF opcional)
            const fd = new FormData();
            fd.append("id_paciente", String(pacienteId));
            fd.append("id_procedimiento", String(idProcedimientoBase));
            fd.append("fecha", String(fecha));
            fd.append("informe_texto", informeTexto || "");
            // Si es patología relacionada, el backend marcará patologia=false en ese procedimiento
            if (pendienteSel?.id_procedimiento_paciente) {
                fd.append("id_procedimiento_paciente", String(pendienteSel.id_procedimiento_paciente));
            }
            fd.append("tipo_registro", tipoRegistro || "patologia");
            if (pdfFile) fd.append("informe_pdf", pdfFile);

            const r1 = await fetch(url("patologias/"), {
                method: "POST",
                body: fd,
            });
            if (!r1.ok) {
                const t = await r1.text().catch(() => "");
                throw new Error(t || "Error creando patología");
            }

            // callback al padre
            onSaved?.();
            onClose?.();
        } catch (err) {
            console.error(err);
            alert(err?.message || "No se pudo guardar la patología");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    const hasBaseFromPendiente = !!(pendienteSel && pendienteSel.id_procedimiento_base);

    return (
        <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 flex items-center justify-center p-4">
            <div ref={modalRef} className="w-full max-w-2xl rounded-lg bg-gray-900 border border-gray-700 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <h3 className="text-white font-semibold">Cargar patología</h3>
                <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white"
                title="Cerrar"
                >
                <MdClose size={20} />
                </button>
            </div>

            {/* Body */}
            <div className="px-4 py-4 space-y-4 text-sm">
                {/* Procedimiento relacionado (opcional) */}
                {pendienteSel && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    <p className="uppercase tracking-[0.2em] text-emerald-200/80 mb-1">Procedimiento seleccionado</p>
                    <p className="text-sm font-semibold text-white">
                      {pendienteSel.procedimiento_nombre || "—"}
                    </p>
                    {pendienteSel.procedimiento_tecnica ? (
                      <p className="text-emerald-200/80">
                        Técnica: {pendienteSel.procedimiento_tecnica}
                      </p>
                    ) : null}
                    {pendienteSel.fecha ? (
                      <p className="text-emerald-200/70">
                        Fecha: {formatearFecha(pendienteSel.fecha)}
                      </p>
                    ) : null}
                  </div>
                )}

                {/* Tipo de procedimiento (solo si sin relación) */}
                {!pendienteSel && pendientesOrdenados.length > 0 && (
                  <div className="rounded-lg border border-gray-600/50 bg-gray-800/70 px-3 py-2 text-xs text-gray-200">
                    <p className="uppercase tracking-[0.2em] text-gray-300/80 mb-1">Seleccioná un procedimiento</p>
                    <ul className="space-y-2">
                      {pendientesOrdenados.map((p) => (
                        <li key={p.id_procedimiento_paciente}>
                          <button
                            type="button"
                            onClick={() => {
                              setPendienteSel(p);
                              setAutoPreselect(false);
                            }}
                            className="w-full text-left rounded border border-gray-600/50 px-3 py-2 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition"
                          >
                            <span className="block text-sm font-semibold text-white">
                              {p.procedimiento_nombre || "Procedimiento"}
                            </span>
                            {p.procedimiento_tecnica ? (
                              <span className="block text-xs text-gray-300">{p.procedimiento_tecnica}</span>
                            ) : null}
                            {p.fecha ? (
                              <span className="block text-xs text-gray-400 mt-1">{formatearFecha(p.fecha)}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-gray-400 mt-2">O dejá sin relación si es un estudio externo.</p>
                  </div>
                )}

                {!pendienteSel && pendientesOrdenados.length === 0 && (
                  <div>
                    <label className="text-gray-300 text-xs block mb-1">Tipo de procedimiento</label>
                    <select
                      value={idProcedimientoBase}
                      onChange={(e) => setIdProcedimientoBase(e.target.value)}
                      className="w-full rounded text-sm px-2 py-1 border bg-gray-700 text-white border-gray-600"
                      title="Seleccione el tipo"
                    >
                      <option value="">— Seleccione —</option>
                      {(procedimientosBase || []).map((p) => (
                        <option key={p.id_procedimiento} value={p.id_procedimiento}>
                          {p.procedimiento}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!pendienteSel && (
                  <div className="flex items-center gap-3 text-xs text-gray-300">
                    <span className="uppercase tracking-[0.25em]">Tipo de carga</span>
                    <label
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border ${
                        tipoRegistro === "patologia" ? "border-emerald-400 text-emerald-300" : "border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tipo_registro"
                        checked={tipoRegistro === "patologia"}
                        onChange={() => setTipoRegistro("patologia")}
                      />
                      Patología
                    </label>
                    <label
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border ${
                        tipoRegistro === "cultivo" ? "border-sky-400 text-sky-300" : "border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tipo_registro"
                        checked={tipoRegistro === "cultivo"}
                        onChange={() => setTipoRegistro("cultivo")}
                      />
                      Cultivo
                    </label>
                  </div>
                )}

                {/* Fecha */}
                <div className="max-w-[180px]">
                <label className="text-gray-300 text-xs block mb-1">Fecha</label>
                <input
                    type="date"
                    value={fecha}
                    ref={dateInputRef}
                    onChange={(e) => {
                        setFecha(e.target.value);
                        if (dateInputRef.current) {
                            dateInputRef.current.blur();
                        }
                    }}
                    className="w-full rounded bg-gray-700 text-white text-sm px-2 py-1 border border-gray-600"
                />
                </div>

                {/* Informe texto */}
                <div>
                <label className="text-gray-300 text-xs block mb-1">Informe / Observaciones</label>
                <textarea
                    value={informeTexto}
                    onChange={(e) => setInformeTexto(e.target.value)}
                    placeholder="Escriba aquí el informe o descripción de la patología..."
                    className="w-full rounded bg-gray-700 text-white text-sm px-2 py-1 border border-gray-600 resize-y"
                    rows={4}
                />
                </div>

                {/* Archivos */}
                <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="text-gray-300 text-xs block mb-1">Informe PDF (opcional)</label>
                    <label className="relative inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-400/70 text-blue-300 hover:border-blue-300 hover:text-blue-200 transition text-sm cursor-pointer">
                        <span>Elegir archivo</span>
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-gray-400">
                        {pdfFile ? pdfFile.name : "(opcional)"}
                      </span>
                    </label>
                </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-end gap-2">
                <button
                onClick={onClose}
                disabled={loading}
                className="px-3 py-1 rounded border border-gray-500 text-gray-300 hover:bg-gray-800"
                >
                Cancelar
                </button>
                <button
                onClick={handleGuardar}
                disabled={loading || isInvalid}
                className={`px-3 py-1 rounded border text-sm ${
                    loading || isInvalid
                    ? "border-gray-500 text-gray-500 cursor-not-allowed"
                    : "border-emerald-600 text-emerald-400 hover:border-emerald-400 hover:text-white"
                }`}
                >
                {loading ? "Guardando..." : "Guardar"}
                </button>
            </div>
            </div>
        </div>
        </div>
    );
    }

export default ModalPatologiaNueva;
