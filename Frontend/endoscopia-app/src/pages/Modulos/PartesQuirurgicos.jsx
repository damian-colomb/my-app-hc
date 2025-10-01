// === PartesQuirurgicos.jsx — Carga de Parte Quirúrgico / Informe Endoscópico ===
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FiSave, FiCheckCircle, FiPlus, FiSearch } from "react-icons/fi";
import { LuMicroscope } from "react-icons/lu";
import { FaBacteria } from "react-icons/fa6";
import ModalCargaProfesional from "../../components/ModalCargaProfesional.jsx";
import ModalBases from "../../components/ModalBases.jsx";
import ModalPlantillasTecnicas from "../../components/ModalPlantillasTecnicas.jsx";
import { getFotosProcedimiento, uploadFotosProcedimiento, deleteFotoProcedimiento } from "../../services/procedimientos";
import { API, DEBUG, TECNICAS_PATH, LONG_LABEL_CHARS, BLOCK_SAVE_TEMP } from "./elementosPartes/constants.js";
import { addMinutesToHHMM, nowHHMM, normalizeName, resolveIdByName, keyOf } from "./elementosPartes/utils.js";
import {
    getParteCompleto,
    fetchTecnicas as apiFetchTecnicas,
    fetchDiagnosticos as apiFetchDiagnosticos,
    fetchTiposAnestesia as apiFetchTiposAnestesia,
    fetchCirujanos as apiFetchCirujanos,
    fetchInstrumentadores as apiFetchInstrumentadores,
    fetchAnestesiologos as apiFetchAnestesiologos,
    saveParte as apiSaveParte,
    updateParte as apiUpdateParte
} from "./elementosPartes/api.js";
import ParteHeader from "./elementosPartes/ParteHeader.jsx";
import FotosCirugia from "./elementosPartes/FotosCirugia.jsx";
import { SelectConCrud, InputTexto, TextAreaDetalle } from "./elementosPartes/Campos.jsx";
import CodigosFacturacion, { emptyCodigos } from "./elementosPartes/CodigosFacturacion.jsx";





const DEFAULT_CIRUJANO_UUID = "6b8ac7cf-01f6-46e5-9093-4740317069cb";

// Normaliza distintos formatos de fecha ("YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", "DD/MM/YYYY") a "YYYY-MM-DD"
function toInputDate(val) {
  if (!val) return "";
  const s = String(val).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const mIso = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (mIso) return mIso[1];

  const mDmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mDmy) {
    const d = String(parseInt(mDmy[1], 10)).padStart(2, "0");
    const m = String(parseInt(mDmy[2], 10)).padStart(2, "0");
    const y = mDmy[3];
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const tz = parsed.getTimezoneOffset ? parsed.getTimezoneOffset() : 0;
    return new Date(parsed.getTime() - tz * 60000).toISOString().slice(0, 10);
  }

  return "";
}

// Normaliza hora a "HH:mm"
function toInputTime(val) {
  if (!val) return "";
  const s = String(val).trim();
  const m1 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m1) {
    const hh = Math.min(23, Math.max(0, parseInt(m1[1], 10)));
    const mm = Math.min(59, Math.max(0, parseInt(m1[2], 10)));
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  const m2 = s.match(/^(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (m2) {
    let hh = parseInt(m2[1], 10);
    const mm = parseInt(m2[2], 10);
    const pm = /p/i.test(m2[3]);
    if (hh === 12) hh = pm ? 12 : 0;
    else if (pm) hh += 12;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  const d = new Date(`1970-01-01T${s}`);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return "";
}

// Normaliza cualquier entrada razonable -> "HH:mm"
function toInputTimeLoose(x) {
  if (!x) return "";
  const s = String(x).trim();

  const m1 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m1) return `${m1[1].padStart(2, "0")}:${m1[2]}`;

  const norm = s.toLowerCase().replace(/[\s\u00A0]/g, "").replace(/\./g, "");
  const m2 = norm.match(/^(\d{1,2})[:.](\d{2})(am|pm)$/);
  if (m2) {
    let hh = parseInt(m2[1], 10) % 12;
    const mm = m2[2];
    if (m2[3] === "pm") hh += 12;
    return `${String(hh).padStart(2, "0")}:${mm}`;
  }

  try {
    const d = new Date(`1970-01-01T${s}`);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  } catch {}

  return "";
}

// Etiqueta AM/PM para mostrar al lado del input
function ampmLabel(val) {
  if (!val) return "";
  const norm = String(val).toLowerCase().replace(/[\s\u00A0]/g, "").replace(/\./g, "");
  if (/(am|pm)$/.test(norm)) return norm.endsWith("pm") ? "PM" : "AM";
  const hhmm = toInputTimeLoose(val);
  if (!hhmm) return "";
  const h = parseInt(hhmm.slice(0, 2), 10);
  return h < 12 ? "AM" : "PM";
}


export default function PartesQuirurgicos({
    centro,                 // 'HZB' | 'INTECNUS'
    tipo = "cirugia",       // 'cirugia' | 'endoscopia'
    paciente,               // datos visibles del paciente
    pacienteId,             // id numérico a persistir (fuente de verdad)
    procBaseId,             // id de procedimiento base (fuente de verdad)
    procedimientoBase,
    onCancel,
    onSave,
}) {
    console.log("🔍 [DEBUG] PartesQuirurgicos component rendered");

const { id_pp } = useParams();
const [parteData, setParteData] = useState(null);
const navigate = useNavigate();
function handleClose() {
if (typeof onCancel === "function") return onCancel();
    try { navigate(-1); } catch { window.history.back(); }
}
const handleKeyDown = useCallback((e) => {
  if (e.key !== "Enter") return;
  const tag = (e.target?.tagName || "").toLowerCase();
  if (tag === "textarea") return;
  if (tag === "input" || tag === "select" || e.target?.isContentEditable) {
    e.preventDefault();
  }
}, []);
// Datos enviados desde Procedimientos.jsx vía navigate(state)
const location = useLocation();
const navPaciente = location?.state?.paciente || null; // nombre, dni, cobertura_nombre, beneficio
const navCentro = location?.state?.centro || null;     // "HZB" | "INTECNUS"




// codigos de facturacion:
const [codigosFact, setCodigosFact] = useState(emptyCodigos());


// Centro efectivo
const centroResolved = useMemo(() => {
  if (navCentro) return navCentro;
  if (centro) return centro;
  const inst = parteData?.procedimientos_pacientes?.institucion || parteData?.institucion || "";
  if (/hzb/i.test(inst)) return "HZB";
  if (/intecnus/i.test(inst)) return "INTECNUS";
  return "HZB";
}, [navCentro, centro, parteData]);


useEffect(() => {
  async function fetchParte() {
    if (!id_pp) return;
    const id = String(id_pp).replace(/\/$/, "");
    // limpiar fotos previas antes de cargar un parte
    setFotosSubidas([]);

    // helper para setear fecha/horas apenas llegan
    const primeFechaYHoras = (dataObj) => {
      try {
        const f = toInputDate(
          dataObj?.procedimientos_pacientes?.fecha ??
          dataObj?.fecha ??
          null
        );
        const hi = toInputTime(
          dataObj?.partes_quirurgicos?.hora_inicio ??
          dataObj?.hora_inicio ??
          ""
        );
        const hf = toInputTime(
          dataObj?.partes_quirurgicos?.hora_fin ??
          dataObj?.hora_fin ??
          ""
        );

        if (f || hi || hf) {
          setForm((prev) => ({
            ...prev,
            ...(f ? { fecha: f } : {}),
            ...(hi ? { hora_inicio: hi } : {}),
            ...(hf ? { hora_fin: hf } : {}),
          }));
        }
      } catch {}
    };

    try {
      // 1) Intento estándar vía servicio
      const data = await getParteCompleto(id);
      setParteData(data);
      primeFechaYHoras(data);
      return;
    } catch (err) {
      if (DEBUG) console.warn("[PartesQuirurgicos] getParteCompleto falló, probando alias…", err?.message || err);
    }

    // 2) Fallback directo a /partes/completo/{id}
    try {
      const url1 = `${API}/partes/completo/${id}/`;
      const r1 = await fetch(url1, { cache: "no-store" });
      if (r1.ok) {
        const data1 = await r1.json();
        setParteData(data1);
        primeFechaYHoras(data1);
        return;
      }
      if (DEBUG) console.warn(`[PartesQuirurgicos] fallback 1 no OK: ${r1.status} ${r1.statusText}`);
    } catch (e1) {
      if (DEBUG) console.warn("[PartesQuirurgicos] error fallback 1:", e1?.message || e1);
    }

    // 3) Fallback a /procedimientos/completo/{id}
    try {
      const url2 = `${API}/procedimientos/completo/${id}/`;
      const r2 = await fetch(url2, { cache: "no-store" });
      if (r2.ok) {
        const data2 = await r2.json();
        setParteData(data2);
        primeFechaYHoras(data2);
        return;
      }
      if (DEBUG) console.warn(`[PartesQuirurgicos] fallback 2 no OK: ${r2.status} ${r2.statusText}`);
    } catch (e2) {
      if (DEBUG) console.warn("[PartesQuirurgicos] error fallback 2:", e2?.message || e2);
    }

    // 4) Reporte final
    console.error("Error al cargar parte completo: no hubo endpoint válido para", id);
  }
  fetchParte();
}, [id_pp]);

    // Sincroniza datos del backend en el form si existen partes_quirurgicos y procedimientos_pacientes
    useEffect(() => {
        (async () => {
            const pq = parteData?.partes_quirurgicos;
            const pp = parteData?.procedimientos_pacientes;

            if (pq && pp) {
                // Cargar listas necesarias para los selects
                await fetchCirujanosAll();
                setForm((prev) => ({
                    ...prev,
                    fecha: toInputDate(pp.fecha) || prev.fecha || hoyISO,
                    hora_inicio: toInputTime(pq.hora_inicio) || prev.hora_inicio || "",
                    hora_fin: toInputTime(pq.hora_fin) || prev.hora_fin || "",
                    tipo_procedimiento:
                        pp.tipo_cirugia === 2 ? "Urgencia" :
                        pp.tipo_cirugia === 1 ? "Programado" : (prev.tipo_procedimiento || ""),
                    envia_patologia: !!pp.patologia,
                    envia_cultivo: !!pp.cultivo,
                    id_diagnostico_pre: pq.id_diagnostico_pre ?? prev.id_diagnostico_pre ?? null,
                    dx_pre: pq.diagnostico_pre_nombre || prev.dx_pre || "",
                    dx_post: pq.anexo_diagnostico || prev.dx_post || "",
                    id_procedimiento: pq.id_procedimiento ?? prev.id_procedimiento ?? null,
                    tecnica_detalle: pq.tecnica_detalle || prev.tecnica_detalle || "",
                    tecnica_anexo: pq.anexo_procedimiento || prev.tecnica_anexo || "",
                    cirujano: pq.cirujano_nombre || prev.cirujano || "",
                    anestesiologo: pq.anestesiologo_nombre || prev.anestesiologo || "",
                    id_tipo_anestesia: pq.id_tipo_anestesia ?? prev.id_tipo_anestesia ?? null,
                    id_instrumentador: pq.id_instrumentador ?? prev.id_instrumentador ?? null,
                    id_circulante: pq.id_circulante ?? prev.id_circulante ?? null,
                    ayudante1: pq.ayudante1_nombre || prev.ayudante1 || "",
                    ayudante2: pq.ayudante2_nombre || prev.ayudante2 || "",
                    ayudante3: pq.ayudante3_nombre || prev.ayudante3 || "",
                }));

                // Guardamos id del procedimiento_paciente para uploads y SIEMPRE cargamos fotos desde backend
                if (pp.id_procedimiento_paciente && Number(pp.id_procedimiento_paciente) > 0) {
                    const idpp = Number(pp.id_procedimiento_paciente);
                    setProcPacId(idpp);
                    // Loading photos for procedure
                    try { await loadFotosBackend(idpp); } catch { setFotosSubidas([]); }
                    try { if (centroResolved === "INTECNUS") { await loadCodigosBackend(idpp); } } catch {}
                }
            }
        })();
    }, [parteData]);
    const hoyISO = useMemo(() => {
        const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 10);
    }, []);

    // API base configuration

    // Normalizo paciente por si vienen claves distintas desde props o desde parteData (edición)
    const pac = useMemo(() => {
        // fuente: props.paciente (si viene desde Procedimientos) o parteData (si abrimos un parte cargado)
       const src =
        navPaciente ||
        paciente ||
        parteData?.paciente ||
        parteData?.procedimientos_pacientes?.paciente ||
        parteData?.procedimientos_pacientes ||
        {};
        // Nombre
        const nombre = src?.nombre ?? src?.Nombre ?? src?.paciente_nombre ?? src?.nombre_paciente ?? "";
        // DNI
        const dni = src?.dni ?? src?.DNI ?? src?.paciente_dni ?? src?.dni_paciente ?? "";
        // Fecha de nacimiento
        const fecha_nacimiento = src?.fecha_nacimiento ?? src?.fechaNacimiento ?? src?.fnac ?? src?.paciente_fecha_nacimiento ?? null;

        // Cobertura: aceptar string, id numérico u objeto (preferir nombre legible)
        // Aliases comunes desde distintas respuestas del backend
        let cobertura_nombre = (
            src?.cobertura_nombre ??
            src?.obra_social_nombre ??
            src?.obra_social ??
            src?.nombre_cobertura ??
            ""
        );

        // Posibles ubicaciones del objeto cobertura
        const cov = (
            src?.cobertura ??
            src?.cobertura_paciente ??
            src?.obraSocial ??
            src?.os ??
            src?.paciente?.cobertura ??
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
                // evitar mostrar ids numéricos como nombre
                cobertura_nombre = isNaN(Number(cov)) ? cov : "";
            }
        }

        // Beneficio / número de afiliado: múltiples alias según origen
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
    }, [paciente, parteData, navPaciente]);
    // --- Estado y catálogos ---

    const edadPaciente = useMemo(() => {
        if (!pac?.fecha_nacimiento) return "—";
        try {
            const fn = new Date(pac.fecha_nacimiento);
            const hoy = new Date();
            let e = hoy.getFullYear() - fn.getFullYear();
            const m = hoy.getMonth() - fn.getMonth();
            if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) e--;
            return isNaN(e) ? "—" : e;
        } catch {
            return "—";
        }
    }, [pac?.fecha_nacimiento]);

    // ----- Listas de profesionales -----
    const [cirujanos, setCirujanos] = useState([]);
    const [anestesiologos, setAnestesiologos] = useState([]);
    const [instrumentadores, setInstrumentadores] = useState([]);
    const [openCirujanosModal, setOpenCirujanosModal] = useState(false);
    const [listaCirujanosModal, setListaCirujanosModal] = useState([]);
    const [openAnestesModal, setOpenAnestesModal] = useState(false);
    const [openInstrumModal, setOpenInstrumModal] = useState(false);
    const [openProcModal, setOpenProcModal] = useState(false);
    const [openDiagModal, setOpenDiagModal] = useState(false);
    const [listaDiagModal, setListaDiagModal] = useState([]);

    // Sincroniza la lista simple (id/nombre) para selects y modal cuando cambia el catálogo completo
    useEffect(() => {
        const items = (cirujanos || []).map((c) => ({
            id: c.id_cirujano ?? c.id,
            nombre: c.nombre_cirujano ?? c.nombre,
        }));
        setListaCirujanosModal(items);
    }, [cirujanos]);

    // Catálogos
    const [tecnicasCat, setTecnicasCat] = useState([]);
    const [tecnicasVersion, setTecnicasVersion] = useState(0);
    const [selectTecTick, setSelectTecTick] = useState(0);
    const [diagnosticosCat, setDiagnosticosCat] = useState([]);
    const [tiposAnestesiaCat, setTiposAnestesiaCat] = useState([]);
    // Diagnósticos loading/error states
    const [dxLoading, setDxLoading] = useState(false);
    const [dxError, setDxError] = useState("");
    // Fetcher específico para diagnósticos
    async function fetchDiagnosticos() {
        setDxLoading(true); setDxError("");
        try {
        const data = await apiFetchDiagnosticos();
        if (!Array.isArray(data)) throw new Error("Respuesta inválida");
        setDiagnosticosCat(data);
        // Diagnosticos loaded successfully
        } catch (err) {
        setDiagnosticosCat([]);
        setDxError(err?.message || 'No se pudo cargar diagnósticos');
        if (DEBUG) console.error(`[ParteQuirurgico] ERROR GET /bases/diagnosticos/:`, err);
        } finally {
        setDxLoading(false);
        }
    }

    // Fetch de cirujanos desde backend y normalización para selects / modal
    async function fetchCirujanosAll() {
        console.log("🔍 [DEBUG] fetchCirujanosAll called");
        try {
            console.log("🔍 [DEBUG] Calling apiFetchCirujanos...");
            const data = await apiFetchCirujanos();
            console.log("🔍 [DEBUG] apiFetchCirujanos response:", data);
            const list = Array.isArray(data) ? data : [];
            console.log("🔍 [DEBUG] Processed list:", list);
            setCirujanos(list);
            const items = list.map((c) => ({
                id: c.id_cirujano ?? c.id,
                nombre: c.nombre_cirujano ?? c.nombre,
            }));
            console.log("🔍 [DEBUG] Modal items:", items);
            setListaCirujanosModal(items);
            // Setear Colomb, Damián por defecto (por UUID o por nombre) si no hay cirujano cargado
            const yoById = items.find((i) => String(i.id) === DEFAULT_CIRUJANO_UUID);
            const yoByName = items.find((i) => i.nombre === "Colomb, Damián");
            const yo = yoById || yoByName;
            if (yo) {
                setForm((prev) => ({
                    ...prev,
                    cirujano: prev.cirujano || yo.nombre,
                }));
            }
            // Cirujanos loaded successfully
        } catch (e) {
            setCirujanos([]);
            setListaCirujanosModal([]);
            if (DEBUG) console.warn(`[ParteQuirurgico] error cargando cirujanos`, e?.message);
        }
    }
    
    // Fetch de anestesiólogos (igual patrón que cirujanos)
async function fetchAnestesAll() {
  try {
    const data = await apiFetchAnestesiologos();
    const list = Array.isArray(data) ? data : [];
    setAnestesiologos(list);
    // Anestesiologos loaded successfully
  } catch (e) {
    setAnestesiologos([]);
    if (DEBUG) console.warn(`[ParteQuirurgico] error cargando anestesiólogos`, e?.message);
  }
}

// Fetch de instrumentadores (igual patrón que cirujanos)
async function fetchInstrumentadoresAll() {
  try {
    const data = await apiFetchInstrumentadores();
    const list = Array.isArray(data) ? data : [];
    setInstrumentadores(list);
    // Instrumentadores loaded successfully
  } catch (e) {
    setInstrumentadores([]);
    if (DEBUG) console.warn(`[ParteQuirurgico] error cargando instrumentadores`, e?.message);
  }
}


// === Carga inicial de catálogos / plantillas (una sola vez) ===
    const fetchedOnceRef = useRef(false);
    // Plantillas técnicas (catálogo UI) — sólo desde backend, sin seeds locales
    const loadPlantillas = useCallback(async () => {
        // Cache-bust y no-store para evitar detalles viejos
        const url = `${API}/plantillas/plantillas_tecnicas_cx?ts=${Date.now()}`;
        try {
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            const raw = await r.json();
            const data = Array.isArray(raw)
                ? raw.map((it) => ({
                      id: it.id_plantilla ?? it.id ?? null,
                      tecnica: it.tecnica ?? "",
                      desarrollo: it.desarrollo ?? "",
                  }))
                : [];
            setPlantillasTecnica(data);
            if (DEBUG) console.log(`[ParteQuirurgico] plantillas cargadas (${data.length})`);
            return data;
        } catch (err) {
            setPlantillasTecnica([]);
            if (DEBUG) console.warn(`[ParteQuirurgico] ERROR cargando plantillas desde ${url}:`, err?.message || err);
            return [];
        }
    }, [API]);
    useEffect(() => {
  if (fetchedOnceRef.current) return;
  fetchedOnceRef.current = true;

  (async () => {
    const promises = [
      // 0: Cirujanos
      (async () => {
        try {
          const data = await apiFetchCirujanos();
          const list = Array.isArray(data) ? data : [];
          return { status: "fulfilled", value: list };
        } catch (e) {
          if (DEBUG) console.warn(`[ParteQuirurgico] error cargando cirujanos`, e?.message);
          return { status: "rejected", reason: e };
        }
      })(),
      // 1: Anestesiólogos
      (async () => {
        try {
          const data = await apiFetchAnestesiologos();
          const list = Array.isArray(data) ? data : [];
          return { status: "fulfilled", value: list };
        } catch (e) {
          if (DEBUG) console.warn(`[ParteQuirurgico] error cargando anestesiólogos`, e?.message);
          return { status: "rejected", reason: e };
        }
      })(),
      // 2: Instrumentadores
      (async () => {
        try {
          const data = await apiFetchInstrumentadores();
          const list = Array.isArray(data) ? data : [];
          return { status: "fulfilled", value: list };
        } catch (e) {
          if (DEBUG) console.warn(`[ParteQuirurgico] error cargando instrumentadores`, e?.message);
          return { status: "rejected", reason: e };
        }
      })(),
      // 3: Técnicas (sí las cargamos al iniciar)
      (async () => {
        try {
          const data = await apiFetchTecnicas();
          if (!Array.isArray(data)) return { status: "fulfilled", value: [] };
          const norm = data
            .map((raw) => ({
              id_tecnica: raw.id_tecnica ?? raw.id ?? raw.id_procedimiento ?? raw.Id ?? raw.ID ?? null,
              nombre_tecnica: raw.nombre_tecnica ?? raw.nombre ?? raw.nombre_procedimiento ?? raw.descripcion ?? "",
            }))
            .filter((t) => t.id_tecnica != null);
          return { status: "fulfilled", value: norm };
        } catch (e) {
          if (DEBUG) console.warn(`[ParteQuirurgico] error cargando tecnicas:`, e?.message);
          return { status: "rejected", reason: e };
        }
      })(),
      // 4: Tipos de anestesia
      (async () => {
        try {
          const d = await apiFetchTiposAnestesia();
          return { status: "fulfilled", value: Array.isArray(d) ? d : [] };
        } catch (e) {
          if (DEBUG) console.warn(`[ParteQuirurgico] error cargando tipos de anestesia`, e?.message);
          return { status: "rejected", reason: e };
        }
      })(),
      // 5: Plantillas técnicas
      (async () => {
        const url = `${API}/plantillas/plantillas_tecnicas_cx?ts=${Date.now()}`;
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          const raw = await r.json();
          const data = Array.isArray(raw)
            ? raw.map((it) => ({
                id: it.id_plantilla ?? it.id ?? null,
                tecnica: it.tecnica ?? "",
                desarrollo: it.desarrollo ?? "",
              }))
            : [];
          if (DEBUG) console.log(`[ParteQuirurgico] plantillas cargadas (${data.length})`);
          return { status: "fulfilled", value: data };
        } catch (err) {
          if (DEBUG) console.warn(`[ParteQuirurgico] ERROR cargando plantillas desde ${url}:`, err?.message || err);
          return { status: "rejected", reason: err };
        }
      })(),
      // 6: Técnicas/Procedimientos (para el select)
      (async () => {
        try {
          const data = await fetchTecnicas();
          return { status: "fulfilled", value: data };
        } catch (err) {
          if (DEBUG) console.warn(`[ParteQuirurgico] ERROR cargando técnicas:`, err?.message || err);
          return { status: "rejected", reason: err };
        }
      })(),
    ];

    const results = await Promise.all(promises);

    // 0: Cirujanos
    if (results[0].status === "fulfilled") {
      const list = results[0].value;
      setCirujanos(list);
      const items = list.map((c) => ({
        id: c.id_cirujano ?? c.id,
        nombre: c.nombre_cirujano ?? c.nombre,
      }));
      setListaCirujanosModal(items);

      // Default "Colomb, Damián" si existe y no hay valor aún
      const yoById = items.find((i) => String(i.id) === DEFAULT_CIRUJANO_UUID);
      const yoByName = items.find((i) => i.nombre === "Colomb, Damián");
      const yo = yoById || yoByName;
      if (yo) {
        setForm((prev) => ({
          ...prev,
          cirujano: prev.cirujano || yo.nombre,
        }));
      }
      if (DEBUG) console.log(`[ParteQuirurgico] Cirujanos cargados:`, items.length);
    } else {
      setCirujanos([]);
      setListaCirujanosModal([]);
    }

    // 1: Anestesiólogos
    if (results[1].status === "fulfilled") {
      setAnestesiologos(results[1].value);
      if (DEBUG) console.log(`[ParteQuirurgico] Anestesiólogos cargados:`, results[1].value.length);
    } else {
      setAnestesiologos([]);
    }

    // 2: Instrumentadores
    if (results[2].status === "fulfilled") {
      setInstrumentadores(results[2].value);
      if (DEBUG) console.log(`[ParteQuirurgico] Instrumentadores cargados:`, results[2].value.length);
    } else {
      setInstrumentadores([]);
    }

    // 3: Técnicas
    if (results[3].status === "fulfilled") {
      setTecnicasCat(results[3].value);
      setTecnicasVersion((v) => v + 1);
      if (DEBUG) console.log(`[ParteQuirurgico] Tecnicas cargadas:`, results[3].value.length);
    } else {
      setTecnicasCat([]);
      setTecnicasVersion((v) => v + 1);
    }

    // 4: Tipos de anestesia
    if (results[4].status === "fulfilled") {
      setTiposAnestesiaCat(results[4].value);
    } else {
      setTiposAnestesiaCat([]);
    }

    // 5: Plantillas técnicas
    if (results[5].status === "fulfilled") {
      setPlantillasTecnica(results[5].value);
    } else {
      setPlantillasTecnica([]);
    }

    // 6: Técnicas/Procedimientos (ya se cargan en results[3], pero por si acaso)
    if (results[6] && results[6].status === "fulfilled") {
      setTecnicasCat(results[6].value);
      setTecnicasVersion((v) => v + 1);
      if (DEBUG) console.log(`[ParteQuirurgico] Técnicas precargadas:`, results[6].value.length);
    }
  })();

  // Diagnósticos: prefetch en segundo plano (no bloquea la primera carga)
  try {
    setDxLoading(true); setDxError("");
    const idleFetch = async () => {
      try {
        const data = await apiFetchDiagnosticos();
        setDiagnosticosCat(Array.isArray(data) ? data : []);
        if (DEBUG) console.log(`[ParteQuirurgico] Diagnósticos prefetch:`, Array.isArray(data) ? data.length : 0);
      } catch (err) {
        setDxError(err?.message || "No se pudo cargar diagnósticos");
        setDiagnosticosCat([]);
        if (DEBUG) console.warn(`[ParteQuirurgico] Prefetch diagnósticos ERROR:`, err);
      } finally {
        setDxLoading(false);
      }
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(idleFetch, { timeout: 2500 });
    } else {
      setTimeout(idleFetch, 300);
    }
  } catch {
    // noop
  }
}, []);

function openDiagnosticosModal() {
    const items = (diagnosticosCat || []).map((d) => ({
        id: d.id_diagnostico ?? d.id,
        nombre: d.nombre_diagnostico ?? d.nombre,
    }));
    setListaDiagModal(items);
    setOpenDiagModal(true);
}

const [plantillasTecnica, setPlantillasTecnica] = useState([]); // [{ id, tecnica, desarrollo }]
// Alias seguro: siempre trabajar con array
const plantillasList = Array.isArray(plantillasTecnica) ? plantillasTecnica : [];

const [filtroTec, setFiltroTec] = useState("");
const filtroTecRef = useRef(null);
const [tecSeleccionada, setTecSeleccionada] = useState("");

    // Fotos de la cirugía (solo front por ahora)
    const [fotosCirugia, setFotosCirugia] = useState([]); // [{ file, preview, nota }]
    const [procPacId, setProcPacId] = useState(null);        // se setea tras guardar en backend
    const [fotosSubidas, setFotosSubidas] = useState([]);     // [{ id_foto, url, filename, ... }]
    const [fotosBusy, setFotosBusy] = useState(false);        // spinner/disable para subir/borrar
    
    const [openPlantillas, setOpenPlantillas] = useState(false);


    // --- Estilos locales: scrollbar oscuro para la lista de plantillas ---
    const pqScrollbarStyles = (
        <style>{`
          .pq-scroll { scrollbar-color: #374151 #0b1220; scrollbar-width: thin; }
          .pq-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
          .pq-scroll::-webkit-scrollbar-track { background: #0b1220; border-radius: 8px; }
          .pq-scroll::-webkit-scrollbar-thumb { background-color: #374151; border-radius: 8px; border: 2px solid #0b1220; }
          .pq-scroll::-webkit-scrollbar-thumb:hover { background-color: #4B5563; }
        `}</style>
    );

    // --- Estilos para widgets readonly ---
    const pqReadOnlyStyles = (
      <style>{`
        /* Estado de solo lectura: mayor legibilidad y contraste */
        .pq-readonly {
          background-color: #0f172a !important;  /* fondo más profundo (slate-900/950) */
          color: #d1d5db !important;             /* texto más claro (slate-300) */
          border-color: #334155 !important;      /* borde sutil (slate-600) */
          cursor: not-allowed !important;
          opacity: 1 !important;                 /* sin apagado extra */
          font-style: italic;                    /* pista visual de no editable */
        }
        .pq-readonly::placeholder {
          color: #9ca3af !important;             /* placeholder distinguible */
          opacity: 1 !important;
          font-style: italic;
        }
        /* Si la clase se aplica al contenedor, asegurar consistencia en inputs internos */
        fieldset[disabled] .pq-readonly,
        .pq-readonly input,
        .pq-readonly select,
        .pq-readonly textarea {
          background-color: #0f172a !important;
          color: #d1d5db !important;
          border-color: #334155 !important;
        }
      `}</style>
    );

    const coberturaDisplay = useMemo(() => {
        const direct = pac?.cobertura_nombre || paciente?.obra_social || paciente?.obra_social_nombre || "";
        if (direct) return String(direct);
        const src = paciente || parteData?.paciente || parteData?.procedimientos_pacientes || {};
        const cov = src?.cobertura || src?.cobertura_paciente || src?.obraSocial || src?.os || src?.paciente?.cobertura || null;
        if (cov && typeof cov === "object") {
            return String(
                cov?.nombre || cov?.nombre_cobertura || cov?.descripcion || cov?.detalle || cov?.obra_social || ""
            );
        }
        if (typeof cov === "string" && isNaN(Number(cov))) return cov;
        return "";
    }, [pac, paciente, parteData, navPaciente]);


   // Fetch de técnicas: directo al endpoint, sin cache, y normalizado
async function fetchTecnicas() {
  try {
    const basePath = TECNICAS_PATH.startsWith("/") ? TECNICAS_PATH : `/${TECNICAS_PATH}`;
    const url = `${API}${basePath}?ts=${Date.now()}`; // cache-busting
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);

    const data = await r.json();
    const norm = Array.isArray(data)
      ? data
          .map((raw) => ({
            id_tecnica: raw.id_tecnica ?? raw.id ?? raw.id_procedimiento ?? raw.Id ?? raw.ID ?? null,
            nombre_tecnica: raw.nombre_tecnica ?? raw.nombre ?? raw.nombre_procedimiento ?? raw.descripcion ?? "",
          }))
          .filter((t) => t.id_tecnica != null)
      : [];
    if (DEBUG) console.log("[tec] fetchTecnicas -> norm:", norm.length, norm.slice(-5));
    setTecnicasCat(norm);
    setTecnicasVersion((v) => v + 1); // fuerza remount del select
    if (DEBUG) console.log(`[ParteQuirurgico] GET /plantillas/plantillas_tecnicas_cx ->`, norm.length, "items");
    return norm;
  } catch (err) {
    setTecnicasCat([]);
    setTecnicasVersion((v) => v + 1);
    if (DEBUG) console.error(`[ParteQuirurgico] ERROR GET /plantillas/plantillas_tecnicas_cx:`, err);
    return [];
  }
}

    // ----- Modal alta profesional -----
    const [openModalPro, setOpenModalPro] = useState(false);
    const [modalTipo, setModalTipo] = useState("cirujano"); // 'cirujano' | 'anestesiologo' | 'instrumentador'

    // ----- Form común -----
    const [form, setForm] = useState({
        fecha: hoyISO,
        hora_inicio: "",
        hora_fin: "",
        tipo_procedimiento: "", // "Programado" | "Urgencia" (obligatorio)
        // diagnósticos
        id_diagnostico_pre: null, // select
        dx_pre: "",               // texto (compat)
        dx_post: "",
        // procedimiento / técnica
        id_procedimiento: null,      // FK a tecnicas.id_tecnica (select)
        tecnica_detalle: "",        // textarea
        tecnica_anexo: "",
        // equipo
        cirujano: "Colomb, Damián",
        ayudante1: "",
        ayudante2: "",
        ayudante3: "",
        // anestesia
        anestesiologo: "",
        id_tipo_anestesia: null,
        // HZB only
        id_instrumentador: null,
        id_circulante: null,
        envia_patologia: false,
        envia_cultivo: false,
    });

    // Flash highlight for hora_inicio and hora_fin when auto-updated
    const [flashInicio, setFlashInicio] = useState(false);
    const [flashFin, setFlashFin] = useState(false);

    useEffect(() => {
        setForm((f) => ({
            ...f,
            dx_pre: f.dx_pre || (procedimientoBase?.nombre ?? f.dx_pre),
        }));
    }, [procedimientoBase]);


    const tecnicasFiltradas = useMemo(() => {
        const baseList = plantillasList;
        const q = (filtroTec || "").toLowerCase();
        if (!q) return baseList;
        return baseList.filter((t) => (t.tecnica || "").toLowerCase().includes(q));
}, [plantillasList, filtroTec]);

    // Memoized labels for current selections (for tooltips)
    const labelDxPre = useMemo(() => {
        const id = form.id_diagnostico_pre;
        const found = diagnosticosCat.find((d) => (d.id_diagnostico ?? d.id) === id);
        return found ? (found.nombre_diagnostico || found.nombre || "") : "";
    }, [form.id_diagnostico_pre, diagnosticosCat]);

    const labelTecnica = useMemo(() => {
        const id = form.id_procedimiento;
        const found = tecnicasCat.find((t) => String(t.id_tecnica ?? t.id) === String(id));
        return found ? (found.nombre_tecnica || found.nombre || "") : "";
    }, [form.id_procedimiento, tecnicasCat]);
    const opcionesTecnicas = useMemo(() => {
  const arr = (tecnicasCat || []).map((t) => ({
    id: String(t.id_tecnica ?? t.id ?? ""),
    nombre: (t.nombre_tecnica || t.nombre || "").trim(),
  })).filter(o => o.id && o.nombre);
  if (DEBUG) console.log("[tec] opcionesTecnicas:", arr.length, arr.slice(-5));
  return arr;
}, [tecnicasCat]);
    const labelTipoAnestesia = useMemo(() => {
        const id = form.id_tipo_anestesia;
        const found = tiposAnestesiaCat.find((a) => (a.id_tipo_anestesia ?? a.id) === id);
        return found ? (found.nombre || "") : "";
    }, [form.id_tipo_anestesia, tiposAnestesiaCat]);

    const labelInstrumentador = useMemo(() => {
        const id = form.id_instrumentador;
        const found = instrumentadores.find((i) => (i.id_instrumentador ?? i.id) === id);
        return found ? (found.nombre || "") : "";
    }, [form.id_instrumentador, instrumentadores]);

    const labelCirculante = useMemo(() => {
        const id = form.id_circulante;
        const found = instrumentadores.find((i) => (i.id_instrumentador ?? i.id) === id);
        return found ? (found.nombre || "") : "";
    }, [form.id_circulante, instrumentadores]);



    // Helpers para manejo de fotos/archivos en backend
    async function loadFotosBackend(id) {
        if (DEBUG) console.debug("[fotos] loadFotosBackend -> id:", id);
        if (!id) return;
        try {
            const data = await getFotosProcedimiento(id);
            // Soportar formatos: [], {uploaded:[]}, {data:[]}
            const arr = Array.isArray(data)
                ? data
                : Array.isArray(data?.uploaded)
                    ? data.uploaded
                    : Array.isArray(data?.data)
                        ? data.data
                        : [];

            // Normalizar claves comunes para que FotosCirugia pueda renderizar sin importar el shape
            const norm = arr.map((it) => {
                if (DEBUG) console.log('[fotos raw item]', it);
                const url = it?.url || it?.file_url || it?.fileUrl || "";
                const file_key = it?.file_key || it?.fileKey || "";
                const filename = it?.filename || it?.name || "";
                const content_type = it?.content_type || it?.mimeType || "";
                const size_bytes = it?.size_bytes || it?.size || 0;
                return {
                    id_foto: it?.id_foto ?? it?.id ?? filename ?? url ?? file_key ?? Math.random().toString(36).slice(2),
                    url: (url || (file_key ? url : "")),
                    file_url: url,
                    file_key,
                    filename,
                    content_type,
                    size_bytes,
                    created_at: it?.created_at || null,
                };
            });

            if (DEBUG) console.debug("[fotos] backend normalizado:", norm.length, norm.slice(0, 3));
            setFotosSubidas(norm);
        } catch (err) {
            console.error("[PartesQuirurgicos] loadFotosBackend error:", err);
            setFotosSubidas([]);
        }
    }

    async function uploadFotosEnCola(id) {
        if (!id || !Array.isArray(fotosCirugia) || fotosCirugia.length === 0) return;
        setFotosBusy(true);
        try {
            // aceptar File[] o [{file, preview}]
            const files = fotosCirugia
                .map((it) => (it instanceof File ? it : it?.file))
                .filter((f) => f instanceof File);

            if (import.meta?.env?.MODE !== "production") {
                console.debug("[fotos] preparando upload:", {
                    idProcPac: id,
                    totalEnCola: Array.isArray(fotosCirugia) ? fotosCirugia.length : 0,
                    archivosValidos: files.length,
                    tipos: Array.isArray(fotosCirugia) ? fotosCirugia.map((it) => (it instanceof File ? "File" : typeof it?.file)) : [],
                    esFile: Array.isArray(fotosCirugia) ? fotosCirugia.map((it) => (it instanceof File ? true : it?.file instanceof File)) : [],
                    nombres: files.map((f) => f.name),
                });
            }

            if (files.length === 0) {
                throw new Error("No se adjuntaron archivos válidos");
            }

            await uploadFotosProcedimiento(id, files);

            // limpiar cola local y refrescar lista del backend
            setFotosCirugia((prev) => {
                try { prev?.forEach?.((it) => it?.preview && URL.revokeObjectURL(it.preview)); } catch {}
                return [];
            });
            await loadFotosBackend(id);
        } catch (err) {
            setError(err?.message || "No se pudieron subir los archivos");
            setTimeout(() => {
                if (errorRef.current) errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 0);
        } finally {
            setFotosBusy(false);
        }
    }

    // ==== Códigos de facturación: helpers de transformación y carga ====
function flattenCodigosFact(cfObj) {
  // cfObj esperado: { cirujano:[{codigo, porcentaje},...], ayudante1:[...], ayudante2:[...], ayudante3:[...] }
  const roles = ["cirujano", "ayudante1", "ayudante2", "ayudante3"];
  const out = [];
  roles.forEach((rol) => {
    const rows = Array.isArray(cfObj?.[rol]) ? cfObj[rol] : [];
    rows.forEach((row, idx) => {
      const codigo = (row?.codigo ?? "").trim();
      const pct = (row?.porcentaje === "" || row?.porcentaje == null) ? null : Number(row?.porcentaje);
      if (!codigo && pct == null) return; // saltear vacías
      out.push({ rol, codigo: codigo || null, porcentaje: pct, fila: idx + 1 });
    });
  });
  return out;
}

function groupCodigosFromBackend(arr) {
  const base = emptyCodigos(); // {cirujano:[{},{},{}], ayudante1:[...], ...}
  const list = Array.isArray(arr) ? arr : [];
  list.forEach((it) => {
    const rol = (it?.rol || "").toLowerCase();
    if (!base[rol]) return;
    const i = Math.min(Math.max((it?.fila ?? 1) - 1, 0), 2);
    base[rol][i] = {
      codigo: it?.codigo ?? "",
      porcentaje: (it?.porcentaje == null || it?.porcentaje === "") ? "" : Number(it.porcentaje),
    };
  });
  return base;
}

async function loadCodigosBackend(id) {
  if (!id) return;
  try {
    const resp = await fetch(`${API}/facturacion/procedimientos/${id}/codigos`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    setCodigosFact(groupCodigosFromBackend(data));
  } catch (err) {
    if (DEBUG) console.warn("[codigosFact] error cargando:", err?.message || err);
    setCodigosFact(emptyCodigos());
  }
}

    // ----- Presets de duración (establece FIN=ahora y calcula INICIO automáticamente) -----
    function setDuracion(mins) {
        // Fin = ahora; Inicio = ahora - mins
        const fin = nowHHMM();
        const inicio = addMinutesToHHMM(fin, -mins);
        setForm((f) => ({ ...f, hora_inicio: inicio, hora_fin: fin }));
        // flash visual
        setFlashInicio(true);
        setFlashFin(true);
        setTimeout(() => setFlashInicio(false), 600);
        setTimeout(() => setFlashFin(false), 600);
    }



    function setMismaHora() {
        const hora = form.hora_fin || nowHHMM();
        setForm(prev => ({ ...prev, hora_inicio: hora }));
        setFlashInicio(true);
        setTimeout(() => setFlashInicio(false), 600);
    }

    function adjustFin(minutes) {
        const base = form.hora_fin || nowHHMM();
        const nueva = addMinutesToHHMM(base, minutes);
        setForm(prev => ({ ...prev, hora_fin: nueva }));
        setFlashFin(true);
        setTimeout(() => setFlashFin(false), 600);
    }

    // ----- Validación mínima -----
    // ===== Validación =====
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [toastOk, setToastOk] = useState(false);
    const toastTimerRef = useRef(null);
    const errorRef = useRef(null);
    // --- Modo edición / solo lectura ---
    // Si abrimos un parte existente (isUpdate), arrancamos en solo lectura.
    const [isEditing, setIsEditing] = useState(false);
    const readOnly = !!(parteData?.partes_quirurgicos?.id_parte) && !isEditing;
    const canEdit = !readOnly;
    
    function validar() {
      // 1) Urgencia / Programado: obligatorio (alguno marcado)
      if (!form.tipo_procedimiento || !["Programado", "Urgencia"].includes(form.tipo_procedimiento)) {
        return "Seleccioná si es Programado o Urgencia.";
      }

      // 2) Diagnóstico preoperatorio: obligatorio (select)
      if (!form.id_diagnostico_pre) {
        return "El diagnóstico preoperatorio es obligatorio.";
      }

      // 3) Técnica (procedimiento) seleccionada: obligatoria (select)
      if (form.id_procedimiento == null || form.id_procedimiento === "") {
        return "La técnica (procedimiento) es obligatoria.";
      }

      // 4) Tipo de anestesia: obligatorio (select)
      if (!form.id_tipo_anestesia) {
        return "El tipo de anestesia es obligatorio.";
      }

      // 6) Cirujano: obligatorio
      if (!form.cirujano || String(form.cirujano).trim() === "") {
        return "Debés indicar el cirujano principal.";
      }

      // 5) Técnica (detalle): obligatorio (textarea)
      if (!form.tecnica_detalle || String(form.tecnica_detalle).trim() === "") {
        return "La técnica (detalle) es obligatoria.";
      }

      // Fotos: son optativas; no validamos nada acá
      return "";
    }

    // Habilitar edición cuando el parte ya existe
    // ===== Actualización =====
    async function updateParteBackend(idProcPac, payload) {
        return apiUpdateParte(idProcPac, payload);
        }
    // ===== Persistencia =====
    // Persiste SIEMPRE con POST (la edición será en otra vista)
    async function saveParteBackend(payload) {
       return apiSaveParte(payload);
    }

    // --- Guardado (POST al backend) ---
    // ===== Guardar =====
    async function handleSave(e) {
        if (BLOCK_SAVE_TEMP) {
        setToastOk(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastOk(false), 1800);
        return; // Evita mandar la request al backend
}
        if (e?.preventDefault) e.preventDefault(); // por si viene de submit/click
        // Guard sincrónico anti doble disparo (click + submit, o doble click)
        
        // Si es un parte existente pero aún no está en modo edición,
        // el primer clic en "Actualizar" habilita los controles y sale.
        if (isUpdate && !isEditing) {
        setIsEditing(true);
        // foco en el primer control editable para feedback visual
        setTimeout(() => {
            try {
            const el = document.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
            if (el && typeof el.focus === 'function') el.focus();
            } catch {}
        }, 0);
        return;
        }
        if (savingRef.current) {
            if (DEBUG) console.warn("[handleSave] Cancelado: ya hay un guardado en curso");
            return;
        }
        savingRef.current = true;
        const msg = validar();
        if (msg) {
            setError(msg);
            // scroll to the error message after next paint
            setTimeout(() => {
                if (errorRef.current) errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 0);
            savingRef.current = false;
            return;
        }
        setError("");
        setSaving(true);

        // Mapear tipo de procedimiento a código numérico (1=Programado, 2=Urgencia)
        const tipoCirugiaNum = form.tipo_procedimiento === "Urgencia" ? 2
            : form.tipo_procedimiento === "Programado" ? 1
            : null;

        // 1) Resolver id_paciente
        //   - Alta (POST): requerimos id_paciente (props)
        //   - Edición (PUT): intentamos resolver desde parteData y si no, permitimos continuar
        let idPaciente = Number(
          pacienteId ??
          parteData?.procedimientos_pacientes?.id_paciente ??
          parteData?.paciente?.id_paciente
        );

        if (!Number.isInteger(idPaciente) || idPaciente <= 0) {
          if (!isUpdate) {
            setSaving(false);
            setError("No se encontró un identificador de paciente válido (id_paciente). Abrí el parte desde la ficha del paciente.");
            setTimeout(() => {
              if (errorRef.current) errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 0);
            savingRef.current = false;
            return;
          }
          // En actualización, si no pudimos resolver un id_paciente válido, continuamos sin mandarlo en el payload
          idPaciente = null;
        }

        // Resolver IDs por nombre usando catálogos cargados (antes de construir el payload)
        const cirujanoIdResolved = resolveIdByName(form.cirujano, listaCirujanosModal, ["id","id_cirujano"]);
        const anestIdResolved = resolveIdByName(form.anestesiologo, anestesiologos, ["id"]);
        const instrumIdResolved = (form.id_instrumentador ?? resolveIdByName(form.instrumentador, instrumentadores, ["id_instrumentador","id"]));
        // Ayudantes: buscamos en la misma lista de cirujanos
        // Si el valor es "— Sin seleccionar —" o cadena vacía, retornamos null
        const ayud1IdResolved = (form.ayudante1 === "— Sin seleccionar —" || form.ayudante1 === "") ? null : resolveIdByName(form.ayudante1, listaCirujanosModal, ["id","id_cirujano"]);
        const ayud2IdResolved = (form.ayudante2 === "— Sin seleccionar —" || form.ayudante2 === "") ? null : resolveIdByName(form.ayudante2, listaCirujanosModal, ["id","id_cirujano"]);
        const ayud3IdResolved = (form.ayudante3 === "— Sin seleccionar —" || form.ayudante3 === "") ? null : resolveIdByName(form.ayudante3, listaCirujanosModal, ["id","id_cirujano"]);
        // Circulante (HZB): usa el mismo catálogo de instrumentadores
        const circulanteIdResolved = (form.id_circulante ?? resolveIdByName(form.circulante, instrumentadores, ["id_instrumentador","id"]));

        // Normalizar id del procedimiento seleccionado desde el select
        const idProcedimientoSeleccionado = form.id_procedimiento != null ? Number(form.id_procedimiento) : null;

        const procPac = {
          id_procedimiento_base: Number(procBaseId ?? (tipo === "cirugia" ? 1 : 2)),
          fecha: (form.fecha || "").slice(0, 10),
          institucion: centroResolved === "HZB" ? "HZB" : "Intecnus",
          patologia: !!form.envia_patologia,
          cultivo: !!form.envia_cultivo,
          tipo_cirugia: tipoCirugiaNum,
        };
        if (Number.isInteger(idPaciente) && idPaciente > 0) procPac.id_paciente = idPaciente;

        const payload = {
          procedimientos_pacientes: procPac,
          partes_quirurgicos: {
            hora_inicio: form.hora_inicio || null,
            hora_fin: form.hora_fin || null,
            id_diagnostico_pre: form.id_diagnostico_pre ?? null,
            anexo_diagnostico: form.dx_post || null,
            tecnica_detalle: form.tecnica_detalle || null,
            anexo_procedimiento: form.tecnica_anexo || null,
            id_procedimiento: idProcedimientoSeleccionado,
            id_cirujano: cirujanoIdResolved ?? null,
            id_anestesiologo: anestIdResolved ?? null,
            id_instrumentador: (centroResolved === "HZB" ? (instrumIdResolved ?? null) : null),
            id_circulante: (centroResolved === "HZB" ? (circulanteIdResolved ?? null) : null),
            id_tipo_anestesia: form.id_tipo_anestesia ?? null,
            id_ayudante1: ayud1IdResolved ?? null,
            id_ayudante2: ayud2IdResolved ?? null,
            id_ayudante3: ayud3IdResolved ?? null,
        },
        };
        // DEBUG: Siempre mostrar payload en producción
        console.log("[ParteQuirurgico] payload a guardar:", JSON.stringify(payload, null, 2));

        try {
            // Siempre persistimos en el backend (POST). Si el padre pasó onSave, lo llamamos después para estado local.
            let resp = null;
            if (isUpdate) {
                const idForUpdate = procPacId || Number(id_pp);
                console.info("[PartesQuirurgicos] Actualizando via PUT", `${API}/partes/${idForUpdate}/`);
                resp = await updateParteBackend(idForUpdate, payload);
            } else {
                console.info("[PartesQuirurgicos] Guardando via POST", `${API}/partes/`);
                resp = await saveParteBackend(payload);
            }

            // DEBUG: inspeccionar la respuesta del backend (guardado)
            if (DEBUG) console.log("[ParteQuirurgico] resp backend:", resp);

            // Si el backend devuelve el id del procedimiento_paciente, lo guardamos
            const returnedId =
                resp?.procedimientos_pacientes?.id_procedimiento_paciente ??
                resp?.id_procedimiento_paciente ??
                resp?.id ??
                null;

            // Resolver el id destino también para el caso de UPDATE (cuando la respuesta no trae id)
            const idTarget = Number(
              (returnedId ?? null) ||
              (isUpdate ? (procPacId || Number(id_pp) || null) : null)
            );

            if (idTarget && !Number.isNaN(idTarget)) {
                setProcPacId(idTarget);

                // ⬇️ Subir fotos en cola ANTES de refrescar la galería
                try {
                    await uploadFotosEnCola(idTarget);
                } catch (err) {
                    if (DEBUG) console.warn("[PartesQuirurgicos] uploadFotosEnCola falló:", err);
                }

                // Luego refrescar la grilla desde backend
                await loadFotosBackend(idTarget);

                // Guardar códigos de facturación (solo Intecnus)
                if (centroResolved === "INTECNUS") {
                    try {
                        const payloadCF = flattenCodigosFact(codigosFact);
                        await fetch(`${API}/facturacion/procedimientos/${idTarget}/codigos`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payloadCF),
                        });
                        await loadCodigosBackend(idTarget);
                    } catch (err) {
                        if (DEBUG) console.warn("[codigosFact] no se pudieron guardar:", err?.message || err);
                    }
                }
            }

            if (onSave) {
                try {
                    console.log("[PartesQuirurgicos] Llamando onSave...");
                    await onSave(payload);
                    console.log("[PartesQuirurgicos] onSave completado exitosamente");
                } catch (err) {
                    console.error("[PartesQuirurgicos] onSave(prop) falló:", err);
                }
            } else {
                console.warn("[PartesQuirurgicos] onSave no está definido");
            }
            
            // Cerrar modal después de actualización exitosa
            if (isUpdate) {
                console.log("[PartesQuirurgicos] Cerrando modal después de actualización...");
                handleClose();
            }
            // Toast de éxito
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
            }
            setToastOk(true); // usamos el mismo toast para alta/actualización
            toastTimerRef.current = setTimeout(() => setToastOk(false), 2500);
        } catch (e) {
            console.error("[PartesQuirurgicos] handleSave error:", e);
            setError(e?.message || "No se pudo guardar el parte.");
            setTimeout(() => {
                if (errorRef.current) errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 0);
            savingRef.current = false;
            return;
        } finally {
            setSaving(false);
            savingRef.current = false;
        }
    }


    // Cargar fotos cuando tenemos un ID (solo id_proc_pac real)
    useEffect(() => {
      const resolvedId =
        (procPacId && Number(procPacId)) ||
        (parteData?.procedimientos_pacientes?.id_procedimiento_paciente && Number(parteData.procedimientos_pacientes.id_procedimiento_paciente)) ||
        null;

      if (resolvedId && !Number.isNaN(resolvedId)) {
        if (procPacId !== resolvedId) setProcPacId(resolvedId);
        try {
          loadFotosBackend(resolvedId);
          if (centroResolved === "INTECNUS") loadCodigosBackend(resolvedId);
        } catch (e) {
          if (DEBUG) console.error("[PartesQuirurgicos] carga adjunta error:", e);
        }
      }

    }, [procPacId, parteData?.procedimientos_pacientes?.id_procedimiento_paciente, centroResolved]);
    // ===== Render =====
    // Mostrar loading hasta que llegue el parte completo cuando se edita uno existente
    if (id_pp && !parteData && !navPaciente) {
        return (
            <div className="min-h-screen w-full bg-slate-950 p-6 text-gray-300 flex items-center justify-center">
                Cargando parte quirúrgico...
            </div>
        );
    }
    // Determina si estamos en modo actualización (ya existe parte cargada)
const isUpdate = !!(parteData?.partes_quirurgicos?.id_parte);
    
const [selectCirTick, setSelectCirTick] = useState(0);
// Para forzar cierre de cada SelectConCrud
const [selectAnesTick, setSelectAnesTick] = useState(0);      // Anestesiólogo
const [selectAyud1Tick, setSelectAyud1Tick] = useState(0);    // Ayudante 1
const [selectAyud2Tick, setSelectAyud2Tick] = useState(0);    // Ayudante 2
const [selectAyud3Tick, setSelectAyud3Tick] = useState(0);    // Ayudante 3
const [selectInstrumTick, setSelectInstrumTick] = useState(0);// Instrumentador/a
const [selectCircTick, setSelectCircTick] = useState(0);      // Circulante
const [selectTipoAnesTick, setSelectTipoAnesTick] = useState(0); // Tipo de anestesia

    // Estado para controlar el scroll del body cuando los selects están abiertos
    const [isAnySelectOpen, setIsAnySelectOpen] = useState(false);
    
    // Función para manejar la apertura de selects (cierra otros automáticamente)
    const handleSelectOpen = useCallback(() => {
        setIsAnySelectOpen(true);
    }, []);
    
    // Función para manejar el cierre de selects
    const handleSelectClose = useCallback(() => {
        setIsAnySelectOpen(false);
    }, []);


    // Efecto para bloquear el scroll del body cuando cualquier select está abierto
    useEffect(() => {
        console.log('isAnySelectOpen changed:', isAnySelectOpen);
        if (isAnySelectOpen) {
            console.log('Blocking scroll...');
            // Guardar la posición actual del scroll
            const scrollY = window.scrollY;
            
            // Bloquear completamente el scroll del body
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            
            // Bloquear scroll solo en contenedores que NO contienen selects abiertos
            const containers = document.querySelectorAll('div, main, section, article');
            containers.forEach(container => {
                // Verificar si el contenedor contiene un select abierto
                const hasOpenSelect = container.querySelector('.absolute.z-50, [role="listbox"], .max-h-48.overflow-y-auto, .absolute.mt-1.w-full.border.border-gray-600.rounded.bg-gray-900.shadow-lg');
                
                if (!hasOpenSelect && container.scrollHeight > container.clientHeight) {
                    container.style.overflow = 'hidden';
                    container.style.touchAction = 'none';
                }
            });
            
            // NO bloquear pointerEvents en body para permitir que los selects se abran
            // Solo bloquear scroll pero mantener interacción
            
            // Permitir interacción con todos los elementos de select
            const selectElements = document.querySelectorAll('label, button, input, .relative, .absolute');
            selectElements.forEach(element => {
                if (element.closest('label') || 
                    element.tagName === 'BUTTON' || 
                    element.tagName === 'INPUT' ||
                    element.classList.contains('relative') ||
                    element.classList.contains('absolute')) {
                    element.style.pointerEvents = 'auto';
                }
            });
            
            // Asegurar que los dropdowns de select tengan overflow visible
            const selectDropdowns = document.querySelectorAll('.absolute.z-50, [role="listbox"], .max-h-48.overflow-y-auto, .absolute.mt-1.w-full.border.border-gray-600.rounded.bg-gray-900.shadow-lg');
            selectDropdowns.forEach(dropdown => {
                dropdown.style.overflow = 'auto';
                dropdown.style.pointerEvents = 'auto';
                dropdown.style.zIndex = '9999';
            });
            
            // Agregar event listeners adicionales para bloquear scroll
            const preventScroll = (e) => {
                // Detectar si el evento viene de dentro de un select abierto
                const target = e.target;
                if (!target || typeof target.closest !== 'function') {
                    return;
                }
                const isInsideSelect = target.closest('.absolute.z-50') || 
                                     target.closest('[role="listbox"]') ||
                                     target.closest('.max-h-48.overflow-y-auto') ||
                                     target.closest('.absolute.mt-1.w-full.border.border-gray-600.rounded.bg-gray-900.shadow-lg');
                
                if (isInsideSelect) {
                    // Permitir scroll dentro del select, pero bloquear el scroll de la página
                    // Solo prevenir el scroll de la página, no el del select
                    if (e.type === 'wheel' || e.type === 'mousewheel' || e.type === 'DOMMouseScroll') {
                        // Para eventos de rueda, permitir solo si es dentro del área scrolleable del select
                        const scrollableArea = target.closest('.max-h-48.overflow-y-auto');
                        if (!scrollableArea) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }
                    }
                    return; // Permitir el evento dentro del select
                }
                
                // Bloquear scroll en el resto de la página
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            };
            
            // Bloquear todos los tipos de scroll
            document.addEventListener('wheel', preventScroll, { passive: false });
            document.addEventListener('touchmove', preventScroll, { passive: false });
            document.addEventListener('scroll', preventScroll, { passive: false });
            document.addEventListener('mousewheel', preventScroll, { passive: false });
            document.addEventListener('DOMMouseScroll', preventScroll, { passive: false });
            document.addEventListener('keydown', (e) => {
                // Solo bloquear teclas de navegación, NO la barra espaciadora (32)
                if ([33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
                    e.preventDefault();
                }
            });
            
            return () => {
                console.log('Restoring scroll...');
                // Restaurar el scroll del body
                const scrollY = document.body.style.top;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                
                // Restaurar scroll en contenedores padre
                const containers = document.querySelectorAll('div, main, section, article, *');
                containers.forEach(container => {
                    container.style.overflow = '';
                    container.style.touchAction = '';
                });
                
                // Remover event listeners
                document.removeEventListener('wheel', preventScroll);
                document.removeEventListener('touchmove', preventScroll);
                document.removeEventListener('scroll', preventScroll);
                document.removeEventListener('mousewheel', preventScroll);
                document.removeEventListener('DOMMouseScroll', preventScroll);
                
                // Restaurar la posición del scroll
                if (scrollY) {
                    window.scrollTo(0, parseInt(scrollY || '0') * -1);
                }
            };
        }
    }, [isAnySelectOpen]);

const pageContainerClass = "relative min-h-screen w-full bg-slate-950 text-slate-100";
const pagePaddingClass = "px-4 py-6 md:px-8";
const cardWrapperClass = "mx-auto w-full max-w-6xl rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur";
const cardInnerClass = "p-4 md:p-6 space-y-6";

// Funciones para abrir modales
const handleOpenTecnicasModal = () => {
    setOpenProcModal(true);
};

const handleOpenCirujanosModal = () => {
    setOpenCirujanosModal(true);
};

const handleOpenAnestesiologosModal = () => {
    setOpenAnestesModal(true);
};

const handleOpenInstrumentadoresModal = () => {
    setOpenInstrumModal(true);
};

const handleOpenTiposAnestesiaModal = () => {
    // Los tipos de anestesia son estáticos, no necesitan modal
    console.log("Tipos de anestesia son estáticos, no se puede editar");
};

return (
  <div className={pageContainerClass}>
    {pqScrollbarStyles}
    {pqReadOnlyStyles}
    <div className={pagePaddingClass}>
      <div
        className={`${cardWrapperClass} ${readOnly ? "ring-1 ring-slate-800" : "ring-1 ring-emerald-700/30"}`}
        onKeyDown={handleKeyDown}
      >
        <div className={cardInnerClass}>
            {openPlantillas && (
                <ModalPlantillasTecnicas
                    open={openPlantillas}
                    onClose={async () => { setOpenPlantillas(false); await loadPlantillas(); }}
                    onMutated={async (list) => {
                      if (Array.isArray(list)) {
                       setTimeout(() => setPlantillasTecnica(list), 0);
                      } else {
                        setTimeout(() => { loadPlantillas(); }, 0);
                      }
                    }}
                    apiBase={API}
                    endpoint="/plantillas/plantillas_tecnicas_cx"
                    items={Array.isArray(plantillasTecnica) ? plantillasTecnica : []}
                    lista={Array.isArray(plantillasTecnica) ? plantillasTecnica : []}
                    onUse={async (tpl) => {
                        // Refrescar desde backend antes de pegar, para garantizar datos frescos
                        const data = await loadPlantillas();
                        const selId = tpl?.id_plantilla ?? tpl?.id ?? null;
                        const latest = Array.isArray(data)
                            ? data.find((it) => (it.id === selId) || (it.id_plantilla === selId))
                            : null;
                        const chosen = latest || tpl;
                        const nombre = (chosen?.tecnica || "").trim();
                        setForm((f) => ({ ...f, tecnica_detalle: chosen?.desarrollo || "" }));
                        setTecSeleccionada(nombre);
                        setOpenPlantillas(false);
                    }}
                />
            )}
          {openProcModal && (
            <ModalBases
              open={openProcModal}
              onClose={async () => {
                try {
                 const list = await fetchTecnicas();
                    if (DEBUG) console.log("[tec] onClose modal -> list:", Array.isArray(list) ? list.length : 0, Array.isArray(list) ? list.slice(-5) : list);
                  // si la seleccionada ya no existe, limpiar value
                  setForm((f) => {
                    const existe = Array.isArray(list) && list.some(
                      (t) => String(t.id_tecnica ?? t.id) === String(f.id_procedimiento)
                    );
                    return existe ? f : { ...f, id_procedimiento: null };
                  });
                  setSelectTecTick((x) => x + 1); // fuerza remount del select
                } finally {
                  setOpenProcModal(false);
                }
              }}
              title="Técnicas"
              resource="tecnicas"
              apiBase={API}
              resourcePath={TECNICAS_PATH}
              items={(tecnicasCat || []).map((t) => ({
                id: t.id_tecnica ?? t.id,
                nombre: t.nombre_tecnica ?? t.nombre,
              }))}
              showNew
              showEdit
              showDelete
              onChanged={async () => {
                await fetchTecnicas();
                setSelectTecTick((x) => x + 1); // remount
              }}
              onCreate={async (nombre) => {
                const basePath = TECNICAS_PATH.startsWith("/") ? TECNICAS_PATH : `/${TECNICAS_PATH}`;
                const r = await fetch(`${API}${basePath}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ nombre }),
                });
                if (!r.ok) throw new Error("No se pudo crear la técnica.");

                const list = await fetchTecnicas();
                try {
                  const created = Array.isArray(list)
                    ? list.find((t) => (t.nombre_tecnica || t.nombre) === nombre)
                    : null;
                  if (created) {
                    const idSel = created.id_tecnica ?? created.id ?? null;
                    if (idSel != null) {
                      setForm((prev) => ({ ...prev, id_procedimiento: String(idSel) }));
                    }
                  }
                } catch {}
                setSelectTecTick((x) => x + 1); // remount
              }}
              onUpdate={async (id, nombre) => {
                const baseId = TECNICAS_PATH.endsWith("/") ? TECNICAS_PATH : `${TECNICAS_PATH}/`;
                const r = await fetch(`${API}${baseId}${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ nombre }),
                });
                if (!r.ok) throw new Error("No se pudo actualizar la técnica.");

                await fetchTecnicas();
                setForm((f) =>
                  String(f.id_procedimiento) === String(id)
                    ? { ...f, tecnica_anexo: f.tecnica_anexo }
                    : f
                );
                setSelectTecTick((x) => x + 1); // remount
              }}
              onDelete={async (id) => {
                const baseId = TECNICAS_PATH.endsWith("/") ? TECNICAS_PATH : `${TECNICAS_PATH}/`;
                const r = await fetch(`${API}${baseId}${id}`, { method: "DELETE" });
                if (!r.ok) throw new Error("No se pudo borrar la técnica.");

                const list = await fetchTecnicas();
                setForm((f) =>
                  String(f.id_procedimiento) === String(id)
                    ? { ...f, id_procedimiento: null }
                    : f
                );
                setSelectTecTick((x) => x + 1); // remount
              }}
            />
          )}
            {openCirujanosModal && (
                <ModalBases
                    open={openCirujanosModal}
                    onClose={() => setOpenCirujanosModal(false)}
                    title="Cirujanos"
                    resource="cirujanos"
                    apiBase={API}
                    resourcePath="/bases/cirujanos/"   // <<--- AGREGAR ESTO
                    initialItems={listaCirujanosModal}
                    items={listaCirujanosModal}
                    showNew
                    showEdit
                    showDelete
                    onChanged={async () => { await fetchCirujanosAll(); }}
                />
            )}
            {openAnestesModal && (
                <ModalBases
                    open={openAnestesModal}
                    onClose={() => setOpenAnestesModal(false)}
                    title="Anestesiólogos"
                    resource="anestesiologos"
                    apiBase={API}
                    resourcePath="/bases/anestesiologos/"
                    initialItems={anestesiologos}
                    items={anestesiologos}
                    showNew
                    showEdit
                    showDelete
                    onChanged={async () => { await fetchAnestesAll(); }}
                />
                )}

            {openInstrumModal && (
                <ModalBases
                    open={openInstrumModal}
                    onClose={() => setOpenInstrumModal(false)}
                    title="Instrumentadores/as"
                    resource="instrumentadores"
                    apiBase={API}
                    resourcePath="/bases/instrumentadores/"
                    initialItems={instrumentadores}
                    items={instrumentadores}
                    showNew
                    showEdit
                    showDelete
                    onChanged={async () => { await fetchInstrumentadoresAll(); }}
                />
                )}
            {toastOk && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30">
                    <div className="flex items-center gap-2 px-3 py-2 rounded border border-emerald-600 bg-emerald-900/80 text-emerald-200 shadow-lg">
                        <FiCheckCircle />
                        <span>Parte guardado</span>
                    </div>
                </div>
            )}
            <ParteHeader
                centroResolved={centroResolved}
                pac={pac}
                edadPaciente={edadPaciente}
                coberturaDisplay={coberturaDisplay}
            />

            <div>
            {/* Encabezado / tiempos */}
            {/* Línea 1: Tipo de cirugía | Duración rápida */}
            <div className="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tipo de cirugía */}
                    <div>
                <span className="text-gray-400">Tipo de cirugía *</span>
                <div className="mt-2 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setForm({ ...form, tipo_procedimiento: "Programado" })}
                        className={`px-3 h-9 rounded border transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-emerald-600 ${form.tipo_procedimiento === 'Programado' ? 'border-emerald-600 bg-emerald-900/30 text-emerald-200' : 'border-gray-600 text-gray-200 hover:bg-gray-800'}`}
                        aria-pressed={form.tipo_procedimiento === 'Programado'}
                    >
                        Programado
                    </button>
                    <button
                        type="button"
                        onClick={() => setForm({ ...form, tipo_procedimiento: "Urgencia" })}
                        className={`px-3 h-9 rounded border transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-rose-600 ${form.tipo_procedimiento === 'Urgencia' ? 'border-rose-600 bg-rose-900/30 text-rose-200' : 'border-gray-600 text-gray-200 hover:bg-gray-800'}`}
                        aria-pressed={form.tipo_procedimiento === 'Urgencia'}
                    >
                        Urgencia
                    </button>
                </div>
            </div>

                    {/* Duración rápida - alineada con los inputs de horario */}
                    <div className="flex flex-col items-start">
                        <span className="text-gray-400 text-sm">Duración rápida</span>
                        <div className="mt-2 flex gap-1">
                            <button
                                type="button"
                                className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                title="30 min - FIN=ahora, INICIO=ahora-30min"
                                onClick={() => setDuracion(30)}
                            >
                                30′
                            </button>
                            <button
                                type="button"
                                className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                title="1 hora - FIN=ahora, INICIO=ahora-60min"
                                onClick={() => setDuracion(60)}
                            >
                                1h
                            </button>
                            <button
                                type="button"
                                className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                title="1.5 horas - FIN=ahora, INICIO=ahora-90min"
                                onClick={() => setDuracion(90)}
                            >
                                1.5h
                            </button>
                            <button
                                type="button"
                                className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                title="2 horas - FIN=ahora, INICIO=ahora-120min"
                                onClick={() => setDuracion(120)}
                            >
                                2h
                            </button>
                            <button
                                type="button"
                                className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                title="3 horas - FIN=ahora, INICIO=ahora-180min"
                                onClick={() => setDuracion(180)}
                            >
                                3h
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Línea 2: Fecha | Horarios */}
            <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Fecha */}
                    <div>
  <label className="flex flex-col gap-0 self-center">
    <span className="text-gray-400 mb-1 text-sm">Fecha *</span>
    {readOnly ? (
      <input
        type="text"
        className="w-36 pq-readonly border rounded px-2 py-2 text-base leading-none h-10"
        value={
          toInputDate(form.fecha) ||
          toInputDate(parteData?.procedimientos_pacientes?.fecha) ||
          ""
        }
        readOnly
      />
    ) : (
      <input
        type="date"
        className={`w-36 bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800 border rounded px-2 py-2 text-base leading-none h-10 appearance-none`}
        value={toInputDate(form.fecha)}
        onChange={(e) => {
          const v = toInputDate(e.target.value);
          setForm({ ...form, fecha: v });
          // Forzar cierre del date picker después del cambio
          setTimeout(() => {
            e.target.blur();
          }, 100);
        }}
      />
    )}
  </label>
    </div>

                    {/* Horarios */}
                    <div>
                        <div className="flex flex-col md:flex-row gap-3">
    {/* Hora inicio */}
                            <div className="flex items-end gap-2">
<label className="flex flex-col gap-1">
  <span className="text-gray-400 mb-1 text-sm">Hora de inicio:</span>
  {readOnly ? (
    <div className="relative inline-flex items-center">
      <input
        type="text"
        className="w-36 pq-readonly border rounded px-2 py-2 text-base leading-none h-10 text-center"
        value={
          toInputTimeLoose(form.hora_inicio) ||
          toInputTimeLoose(parteData?.partes_quirurgicos?.hora_inicio) ||
          ""
        }
        readOnly
      />
      <span className="ml-2 text-xs text-gray-400 select-none">
        {ampmLabel(form.hora_inicio || parteData?.partes_quirurgicos?.hora_inicio)}
      </span>
    </div>
  ) : (
                                        <div className="flex items-center gap-1">
                                            <div className="relative">
      <input
        type="time"
        className={`w-36 bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800 border rounded px-2 py-2 text-base leading-none h-10 appearance-none${flashInicio ? " ring-1 ring-green-500" : ""} text-center`}
        step={60}
        value={toInputTimeLoose(form.hora_inicio || parteData?.partes_quirurgicos?.hora_inicio)}
        placeholder="hh:mm"
        onChange={(e) => {
          const value = toInputTimeLoose(e.target.value);
          setForm({ ...form, hora_inicio: value });
        }}
      />
                                                {/* Flechas de ajuste fino */}
                                                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
      <button
        type="button"
                                                        className="w-4 h-3 flex items-center justify-center text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                                                        title="+1 min"
        onClick={() => {
                                                            const base = form.hora_inicio || nowHHMM();
          const v = addMinutesToHHMM(base, 1);
                                                            setForm({ ...form, hora_inicio: v });
                                                            setFlashInicio(true);
                                                            setTimeout(() => setFlashInicio(false), 600);
                                                        }}
                                                    >
                                                        ▲
                                                    </button>
      <button
        type="button"
                                                        className="w-4 h-3 flex items-center justify-center text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                                                        title="-1 min"
        onClick={() => {
                                                            const base = form.hora_inicio || nowHHMM();
          const v = addMinutesToHHMM(base, -1);
                                                            setForm({ ...form, hora_inicio: v });
                                                            setFlashInicio(true);
                                                            setTimeout(() => setFlashInicio(false), 600);
                                                        }}
                                                    >
                                                        ▼
                                                    </button>
    </div>
    </div>
                                            <span className="text-xs text-gray-400 select-none">
                                                {ampmLabel(form.hora_inicio)}
                                            </span>
    </div>
                                    )}
                                </label>
  </div>

                            {/* Hora fin */}
  <div className="flex items-end gap-2">
    <label className="flex flex-col gap-1">
      <span className="text-gray-400 mb-1 text-sm">Horario finalización:</span>
      {readOnly ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            className="w-36 pq-readonly border rounded px-2 py-2 text-base leading-none h-10 text-center"
            value={
              toInputTimeLoose(form.hora_fin) ||
              toInputTimeLoose(parteData?.partes_quirurgicos?.hora_fin) ||
              ""
            }
            readOnly
          />
          <span className="text-xs text-gray-400 select-none">
            {ampmLabel(form.hora_fin || parteData?.partes_quirurgicos?.hora_fin)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
                                            <div className="relative">
          <input
            type="time"
            className={`w-36 bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800 border rounded px-2 py-2 text-base leading-none h-10 appearance-none text-center ${flashFin ? "ring-1 ring-green-500" : ""}`}
            step={60}
            value={toInputTimeLoose(form.hora_fin)}
            placeholder="hh:mm"
            onChange={(e) => {
              const value = toInputTimeLoose(e.target.value);
              setForm({ ...form, hora_fin: value });
            }}
          />
                                                {/* Flechas de ajuste fino */}
                                                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
      <button
        type="button"
                                                        className="w-4 h-3 flex items-center justify-center text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                                                        title="+1 min"
        onClick={() => {
                                                            const base = form.hora_fin || nowHHMM();
                                                            const v = addMinutesToHHMM(base, 1);
          setForm({ ...form, hora_fin: v });
          setFlashFin(true);
          setTimeout(() => setFlashFin(false), 600);
        }}
      >
                                                        ▲
      </button>
                                                    <button
                                                        type="button"
                                                        className="w-4 h-3 flex items-center justify-center text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                                                        title="-1 min"
                                                        onClick={() => {
                                                            const base = form.hora_fin || nowHHMM();
                                                            const v = addMinutesToHHMM(base, -1);
                                                            setForm({ ...form, hora_fin: v });
                                                            setFlashFin(true);
                                                            setTimeout(() => setFlashFin(false), 600);
                                                        }}
                                                    >
                                                        ▼
                                                    </button>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-400 select-none">
                                                {ampmLabel(form.hora_fin)}
                                            </span>
                                        </div>
                                    )}
                                </label>
  </div>
</div>    
  </div>
</div>
            </div>
            

{/* Diagnóstico */}
<div className="mt-4 grid gap-4 md:grid-cols-[22rem_minmax(0,1fr)] items-end">
  <div className="w-full min-w-0">
    <SelectConCrud
      key={`dx-${diagnosticosCat?.length || 0}-${form.id_diagnostico_pre ?? "nuevo"}`}
      searchable
      readOnly={readOnly}
      onOpenCrud={(name, id) => openDiagnosticosModal(name)}
      label="Diagnóstico"
      placeholder={
        dxLoading ? "Cargando diagnósticos…" :
        dxError ? "Error al cargar" : "Diagnóstico"
      }
      options={[
        { id: "", label: "— Sin seleccionar —" },
        ...(diagnosticosCat || []).map((d) => ({
          id: String(d.id_diagnostico ?? d.id),
          label: (d.nombre_diagnostico || d.nombre || ""),
        }))
      ]}
      value={form.id_diagnostico_pre != null ? String(form.id_diagnostico_pre) : ""}
      onChange={(id) => {
        const found = diagnosticosCat.find((d) => String(d.id_diagnostico ?? d.id) === String(id));
        const label = found ? (found.nombre_diagnostico || found.nombre || "") : "";
        setForm({ ...form, id_diagnostico_pre: id ? Number(id) : null, dx_pre: label });
      }}
      titleForValue={labelDxPre}
      onOpen={() => setIsAnySelectOpen(true)}
      onClose={() => setIsAnySelectOpen(false)}
    />
  </div>

  <div className="w-full min-w-0">
    <InputTexto
      readOnly={readOnly}
      label="Anexo diagnóstico"
      placeholder="Anexo diagnóstico"
      value={form.dx_post}
      onChange={(v) => setForm({ ...form, dx_post: v })}
    />
  </div>
</div>

  {/* ÚNICO CHIP Diagnóstico oficial */}
  <div className="mt-2 grid grid-cols-1 gap-y-1">
    {form.id_diagnostico_pre && (
      <div className="md:col-span-3">
        <div className="flex items-center justify-between w-full rounded-md border border-emerald-700/40 bg-emerald-950/30 px-2 py-1 gap-2">
          <span className="truncate text-sm leading-5 text-emerald-200">{labelDxPre}</span>
          <button
            type="button"
            aria-label="Quitar"
            className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-emerald-900/40 text-emerald-300/90"
            onClick={() => canEdit && setForm({ ...form, id_diagnostico_pre: null })}
            title="Quitar"
            disabled={!canEdit}
          >
            ×
          </button>
        </div>
      </div>
    )}
  </div>

  {/* Error diagnósticos */}
  {dxError && (
    <div className="text-xs text-rose-300 mt-1">
      Hubo un problema al cargar diagnósticos.{" "}
      <button type="button" className="underline hover:text-rose-100" onClick={fetchDiagnosticos}>
        Reintentar
      </button>
      {DEBUG && <span className="ml-2 text-rose-400/80">(debug: dx={diagnosticosCat.length})</span>}
    </div>
  )}
</div>

{/* Procedimiento / Técnica */}
<div className="mt-4 grid gap-4 md:grid-cols-[22rem_minmax(0,1fr)] items-end">
  <div className="w-full">
    <SelectConCrud
      key={`tecnicas-${tecnicasVersion}-${selectTecTick}-${(tecnicasCat || []).length}`}
      onOpen={() => {
        console.log("🔍 [DEBUG] Técnicas select opened");
        console.log("🔍 [DEBUG] tecnicasCat state:", tecnicasCat);
        console.log("🔍 [DEBUG] tecnicasCat length:", (tecnicasCat || []).length);
        setIsAnySelectOpen(true);
        if ((tecnicasCat || []).length === 0) {
          console.log("🔍 [DEBUG] Fetching técnicas...");
          fetchTecnicas();
        }
      }}
      onClose={() => setIsAnySelectOpen(false)}
      onOpenCrud={(name, id) => handleOpenTecnicasModal(name)}
      searchable
      readOnly={readOnly}
      label="Técnica / Procedimiento"
      placeholder="Técnica / Procedimiento"
      options={(() => {
        const mapped = (tecnicasCat || []).map((t) => ({
          id: String(t.id_tecnica ?? t.id),
          label: (t.nombre_tecnica || t.nombre || "").trim(),
        })).filter(opt => opt.id && opt.label);
        console.log("🔍 [DEBUG] Técnicas options:", mapped.length, mapped.slice(0, 3));
        return [
          { id: "", label: "— Sin seleccionar —" },
          ...mapped
        ];
      })()}
      value={form.id_procedimiento != null ? String(form.id_procedimiento) : ""}
      onChange={(id) => {
        setForm({ ...form, id_procedimiento: id ? String(id) : null });
        setSelectTecTick((x) => x + 1);
      }}
      titleForValue={labelTecnica}
      listSize={5}
    />
  </div>

  <div className="w-full">
    <InputTexto
      readOnly={readOnly}
      label="Anexo"
      placeholder="Anexo"
      value={form.tecnica_anexo}
      onChange={(v) => setForm({ ...form, tecnica_anexo: v })}
    />
  </div>
</div>

{/* ÚNICO CHIP Técnica oficial */}
<div className="mt-2 grid grid-cols-1 gap-y-1">
  {form.id_procedimiento && (
    <div className="md:col-span-3">
      <div className="flex items-center justify-between w-full rounded-md border border-emerald-700/40 bg-emerald-950/30 px-2 py-1 gap-2">
        <span className="truncate text-sm leading-5 text-emerald-200">{labelTecnica}</span>
        <button
          type="button"
          aria-label="Quitar"
          className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-emerald-900/40 text-emerald-300/90"
          onClick={() => canEdit && setForm({ ...form, id_procedimiento: null })}
          title="Quitar"
          disabled={!canEdit}
        >
          ×
        </button>
      </div>
    </div>
  )}
</div>

{/* ================= EQUIPO QUIRÚRGICO ================= */}
<div className="mt-6 space-y-6">
  {/* Fila 1: Cirujano + Anestesiólogo + Tipo de anestesia */}
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div className="w-full min-w-0">
      <SelectConCrud
        key={`cirujano-${selectCirTick}`}
        onOpen={() => {
          console.log("🔍 [DEBUG] Cirujano select opened");
          console.log("🔍 [DEBUG] cirujanos state:", cirujanos);
          console.log("🔍 [DEBUG] listaCirujanosModal:", listaCirujanosModal);
          setIsAnySelectOpen(true);
          if (!Array.isArray(cirujanos) || cirujanos.length === 0) {
            console.log("🔍 [DEBUG] Fetching cirujanos...");
            fetchCirujanosAll();
          }
        }}
        onClose={() => setIsAnySelectOpen(false)}
        onOpenCrud={(name, id) => handleOpenCirujanosModal(name)}
        searchable
        readOnly={readOnly}
        label="Cirujano *"
        placeholder="Seleccionar cirujano"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(listaCirujanosModal || []).map((c) => ({
            id: c.id,
            label: c.nombre || "",
          }))
        ]}
        value={(() => {
          // Convertir nombre del cirujano a ID para el select
          const found = (listaCirujanosModal || []).find((c) => c.nombre === form.cirujano);
          return found ? String(found.id) : "";
        })()}
        onChange={(id) => {
          const found = (listaCirujanosModal || []).find((c) => String(c.id) === String(id));
          setForm({ ...form, cirujano: found ? (found.nombre || "") : "" });
          setSelectCirTick((x) => x + 1);
        }}
        titleForValue={form.cirujano || ""}
        listSize={5}
      />
    </div>

    <div className="w-full min-w-0">
      <SelectConCrud
        key={`anestes-${selectAnesTick}`}
        onOpen={() => {
          console.log("🔍 [DEBUG] Anestesiologo select opened");
          console.log("🔍 [DEBUG] anestesiologos state:", anestesiologos);
          setIsAnySelectOpen(true);
          if (!readOnly && (!Array.isArray(anestesiologos) || anestesiologos.length === 0)) {
            console.log("🔍 [DEBUG] Fetching anestesiologos...");
            fetchAnestesAll();
          }
        }}
        onClose={() => setIsAnySelectOpen(false)}
        onOpenCrud={(name, id) => handleOpenAnestesiologosModal(name)}
        searchable
        readOnly={readOnly}
        label="Anestesiólogo *"
        placeholder="Anestesiólogo"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(anestesiologos || []).map((a) => ({
            id: (a.nombre_anestesiologo || a.nombre || ""),
            label: (a.nombre_anestesiologo || a.nombre || ""),
          }))
        ]}
        value={form.anestesiologo || ""}
        onChange={(id) => {
          setForm({ ...form, anestesiologo: id || "" });
          setSelectAnesTick((x) => x + 1);
        }}
        titleForValue={form.anestesiologo || ""}
        listSize={5}
      />
    </div>

    <div className="w-full min-w-0">
      <SelectConCrud
        key={`tipoanes-${selectTipoAnesTick}`}
        onOpen={() => setIsAnySelectOpen(true)}
        onClose={() => setIsAnySelectOpen(false)}
        readOnly={readOnly}
        label="Tipo de anestesia *"
        placeholder="Seleccionar tipo de anestesia"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(tiposAnestesiaCat || []).map((a) => ({
            id: (a.id_tipo_anestesia ?? a.id),
            label: a.nombre || "",
          }))
        ]}
        value={form.id_tipo_anestesia}
        onChange={(id) => {
          setForm({ ...form, id_tipo_anestesia: id });
          setSelectTipoAnesTick((x) => x + 1);
        }}
        titleForValue={labelTipoAnestesia}
        searchable
        listSize={5}
      />
    </div>
  </div>

  {/* Fila 2: Ayudantes */}
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div className="w-full min-w-0">
      <SelectConCrud
        key={`ayud1-${selectAyud1Tick}`}
        onOpen={() => setIsAnySelectOpen(true)}
        onClose={() => setIsAnySelectOpen(false)}
        onOpenCrud={(name, id) => handleOpenCirujanosModal(name)}
        readOnly={readOnly}
        label="Ayudante 1"
        placeholder="Seleccionar ayudante 1"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(cirujanos || []).map((c) => ({
            id: (c.nombre_cirujano || c.nombre || ""),
            label: (c.nombre_cirujano || c.nombre || ""),
          }))
        ]}
        value={form.ayudante1 || ""}
        onChange={(val) => {
          setForm({ ...form, ayudante1: val || "" });
          setSelectAyud1Tick((x) => x + 1);
        }}
        titleForValue={form.ayudante1 || ""}
        searchable
      />
    </div>

    <div className="w-full min-w-0">
      <SelectConCrud
        key={`ayud2-${selectAyud2Tick}`}
        onOpen={() => setIsAnySelectOpen(true)}
        onClose={() => setIsAnySelectOpen(false)}
        onOpenCrud={(name, id) => handleOpenCirujanosModal(name)}
        readOnly={readOnly}
        label="Ayudante 2"
        placeholder="Seleccionar ayudante 2"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(cirujanos || []).map((c) => ({
            id: (c.nombre_cirujano || c.nombre || ""),
            label: (c.nombre_cirujano || c.nombre || ""),
          }))
        ]}
        value={form.ayudante2 || ""}
        onChange={(val) => {
          setForm({ ...form, ayudante2: val || "" });
          setSelectAyud2Tick((x) => x + 1);
        }}
        titleForValue={form.ayudante2 || ""}
        searchable
        listSize={5}
      />
    </div>

    <div className="w-full">
      <SelectConCrud
        key={`ayud3-${selectAyud3Tick}`}
        onOpen={() => setIsAnySelectOpen(true)}
        onClose={() => setIsAnySelectOpen(false)}
        onOpenCrud={(name, id) => handleOpenCirujanosModal(name)}
        readOnly={readOnly}
        label="Ayudante 3"
        placeholder="Seleccionar ayudante 3"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(cirujanos || []).map((c) => ({
            id: (c.nombre_cirujano || c.nombre || ""),
            label: (c.nombre_cirujano || c.nombre || ""),
          }))
        ]}
        value={form.ayudante3 || ""}
        onChange={(val) => {
          setForm({ ...form, ayudante3: val || "" });
          setSelectAyud3Tick((x) => x + 1);
        }}
        titleForValue={form.ayudante3 || ""}
        searchable
        listSize={5}
      />
    </div>
  </div>

  {/* Fila 3: Instrumentador + Circulante */}
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="w-full">
      <SelectConCrud
        key={`instrum-${selectInstrumTick}`}
        onOpen={() => {
          console.log("🔍 [DEBUG] Instrumentador select opened");
          console.log("🔍 [DEBUG] instrumentadores state:", instrumentadores);
          setIsAnySelectOpen(true);
          if (!readOnly && (!Array.isArray(instrumentadores) || instrumentadores.length === 0)) {
            console.log("🔍 [DEBUG] Fetching instrumentadores...");
            fetchInstrumentadoresAll();
          }
        }}
        onClose={() => setIsAnySelectOpen(false)}
        onOpenCrud={(name, id) => handleOpenInstrumentadoresModal(name)}
        searchable
        readOnly={readOnly}
        label="Instrumentador/a *"
        placeholder="Instrumentador/a"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(instrumentadores || []).map((i) => ({
            id: String(i.id_instrumentador ?? i.id),
            label: (i.nombre_instrumentador || i.nombre || "").trim(),
          }))
        ]}
        value={form.id_instrumentador != null ? String(form.id_instrumentador) : ""}
        onChange={(id) => {
          setForm({ ...form, id_instrumentador: id ? Number(id) : null });
          setSelectInstrumTick((x) => x + 1);
        }}
        titleForValue={labelInstrumentador}
        listSize={5}
      />
    </div>

    <div className="w-full min-w-0">
      <SelectConCrud
        key={`circ-${selectCircTick}`}
        onOpen={() => setIsAnySelectOpen(true)}
        onClose={() => setIsAnySelectOpen(false)}
        onOpenCrud={(name, id) => handleOpenInstrumentadoresModal(name)}
        readOnly={readOnly}
        label="Circulante"
        placeholder="Seleccionar circulante"
        options={[
          { id: "", label: "— Sin seleccionar —" },
          ...(instrumentadores || []).map((i) => ({
            id: String(i.id_instrumentador ?? i.id),
            label: i.nombre || "",
          }))
        ]}
        value={form.id_circulante != null ? String(form.id_circulante) : ""}
        onChange={(id) => {
          setForm({ ...form, id_circulante: id ? Number(id) : null });
          setSelectCircTick((x) => x + 1);
        }}
        titleForValue={labelCirculante}
        searchable
        listSize={5}
      />
    </div>
  </div>
</div>

            {/* Desarrollo de la técnica + plantillas al costado */}
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-y-2 gap-x-6 lg:gap-x-10 items-stretch">
                {/* Columna izquierda: textarea */}
                <div className="md:col-span-3 self-stretch">
                    <div className="flex flex-col gap-2 h-full">
                        <label className="flex flex-col h-full">
                            <span className="text-gray-400 flex items-center justify-between">
                                <span>Técnica (detalle) *</span>
                                <span className="text-xs text-gray-400">{(form.tecnica_detalle || '').length}/5000</span>
                            </span>
                            <textarea
                                className={`w-full border rounded px-2 py-3 min-h-[18rem] h-full text-sm resize-y overflow-y-auto ${readOnly ? 'pq-readonly' : 'bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-800'}`}
                                value={form.tecnica_detalle || ''}
                                onChange={(e) => setForm({ ...form, tecnica_detalle: e.target.value })}
                                disabled={readOnly}
                                maxLength={5000}
                                onKeyDown={(e) => {
                                    // Permitir navegación con flechas y otras teclas normales
                                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                        e.stopPropagation();
                                    }
                                }}
                                style={{ userSelect: 'text' }}
                            ></textarea>
                        </label>
                    </div>
                </div>

                {/* Columna derecha: lista de plantillas */}
                <div className="md:col-span-1 bg-gray-800 border border-gray-700/60 rounded-md p-2 self-stretch">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-gray-200 font-medium">Plantillas</div>
                        <button
                            type="button"
                            onClick={() => setOpenPlantillas(true)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-emerald-600/60 bg-emerald-500/10 text-emerald-200 transition hover:bg-emerald-500/20 focus:outline-none focus:ring-1 focus:ring-emerald-300 disabled:opacity-50"
                            title="Abrir CRUD de plantillas técnicas"
                            aria-label="Abrir CRUD de plantillas técnicas"
                            disabled={readOnly}
                        >
                            <FiPlus className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="relative mb-2">
                        <input
                            ref={filtroTecRef}
                            className={`w-full bg-gray-800 border rounded px-2 h-9 ${readOnly ? 'pq-readonly' : 'border-gray-600 text-gray-100 hover:bg-gray-800'}`}
                            placeholder="Buscar técnica..."
                            value={filtroTec}
                            onChange={(e) => setFiltroTec(e.target.value)}
                            disabled={readOnly}
                            />
                        <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            aria-label="Buscar técnica"
                            title="Buscar técnica"
                            onClick={() => filtroTecRef.current && filtroTecRef.current.focus()}
                        >
                            <FiSearch />
                        </button>
                    </div>
                    {tecSeleccionada && (
                        <div className="mb-2 flex items-center justify-between text-xs text-emerald-200">
                            <span className="truncate" title={tecSeleccionada}>
                                Seleccionada: <span className="font-medium">{tecSeleccionada}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setTecSeleccionada("");
                                    setForm((f) => ({ ...f, tecnica_detalle: "" }));
                                }}
                                className="ml-2 text-emerald-300 hover:text-emerald-100 focus:outline-none"
                                title="Quitar selección"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    <div className="h-72 overflow-y-auto rounded-md border border-gray-700/60 
                        scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900 hover:scrollbar-thumb-gray-500 pq-scroll">
                        <ul className="divide-y divide-gray-800">
                            {tecnicasFiltradas.length === 0 && (
                                <li className="px-2 py-2 text-sm text-gray-400">Sin resultados</li>
                            )}
                            {(Array.isArray(tecnicasFiltradas) ? tecnicasFiltradas : []).map((t, idx) => (
                                <li
                                    key={keyOf(t, idx, 'tec')}
                                    className={`px-2 py-2 text-sm select-none ${readOnly ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-700 cursor-pointer'}`}
                                    title="Doble clic para pegar el desarrollo en el texto"
                                    onDoubleClick={async () => {
                                        if (readOnly) return;
                                        const data = await loadPlantillas();
                                        const chosen = Array.isArray(data) ? data.find((it) => (it.id === t.id) || (it.id_plantilla === t.id)) : null;
                                        const tpl = chosen || t;
                                        setTecSeleccionada(tpl?.tecnica || '');
                                        setForm((f) => ({ ...f, tecnica_detalle: tpl?.desarrollo || '' }));
                                    }}
                                >
                                    <span className="truncate block" title={t.tecnica}>{t.tecnica}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
            <div className="my-5 h-px bg-gray-700/60" />
           {/* Anatomía Patológica y Cultivo (dos tarjetas centradas en una fila) */}
            <div className="mt-1 w-full flex justify-center">
                <div className="flex gap-3 flex-wrap justify-center">
                    {/* Anatomía Patológica */}
                    <div
                        className={`w-full sm:w-auto max-w-md rounded px-3 py-2 transition-colors duration-200 ${form.envia_patologia ? "border border-emerald-500 bg-emerald-900/30" : "border border-gray-600 bg-gray-800"} ${readOnly ? 'opacity-90' : ''}`}
                    >
                        <label className={`grid grid-cols-[auto,1fr] items-start gap-x-3 text-gray-100 text-base font-medium ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                                type="checkbox"
                                className={`w-5 h-5 rounded bg-gray-900 border transition-colors duration-200 ${form.envia_patologia ? "border-emerald-600 accent-emerald-500" : "border-gray-600 accent-gray-400"}`}
                                checked={!!form.envia_patologia}
                                onChange={(e) => { if (!readOnly) setForm({ ...form, envia_patologia: e.target.checked }); }}
                                disabled={readOnly}
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <LuMicroscope className={form.envia_patologia ? "text-emerald-400" : "text-gray-300"} size={18} />
                                    <span>{form.envia_patologia ? "Se envió muestra a patología" : "Enviar muestra a patología"}</span>
                                </div>
                                <div className="text-xs mt-1 text-gray-300/80">
                                    Tildá si se envió muestra para patología.
                                </div>
                            </div>
                        </label>
                    </div>
                    {/* Cultivo */}
                    <div
                        className={`w-full sm:w-auto max-w-md rounded px-3 py-2 transition-colors duration-200 ${form.envia_cultivo ? "border border-emerald-500 bg-emerald-900/30" : "border border-gray-600 bg-gray-800"} ${readOnly ? 'opacity-90' : ''}`}
                    >
                        <label className={`grid grid-cols-[auto,1fr] items-start gap-x-3 text-gray-100 text-base font-medium ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                                type="checkbox"
                                className={`w-5 h-5 rounded bg-gray-900 border transition-colors duration-200 ${form.envia_cultivo ? "border-emerald-600 accent-emerald-500" : "border-gray-600 accent-gray-400"}`}
                                checked={!!form.envia_cultivo}
                                onChange={(e) => { if (!readOnly) setForm({ ...form, envia_cultivo: e.target.checked }); }}
                                disabled={readOnly}
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <FaBacteria className={form.envia_cultivo ? "text-emerald-400" : "text-gray-300"} size={18} />
                                    <span>{form.envia_cultivo ? "Se envió muestra a cultivo" : "Enviar muestra a cultivo"}</span>
                                </div>
                                <div className="text-xs mt-1 text-gray-300/80">
                                    Tildá si se envió muestra para cultivo.
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
           

 {/* === Sección: Codigos Facturacion (visible Intecnus) === */}
            {centroResolved === "INTECNUS" && (
            <CodigosFacturacion
                value={codigosFact}
                onChange={setCodigosFact}
                onOpenCatalog={() => {}}
            />
            )}

            
            
            {/* === Sección: Fotos de la cirugía (visible en HZB e Intecnus) === */}
<div className="mt-3">
  <div className="text-sm text-gray-300 mb-2">Fotos de la cirugía</div>

<FotosCirugia
  readOnly={readOnly}
  procPacId={procPacId}
  fotos={fotosSubidas} 
  fotosCirugia={fotosCirugia} 
  setFotosCirugia={setFotosCirugia}
  setFotosSubidas={setFotosSubidas}
  onUpload={(id) => uploadFotosEnCola(id)}
  onQueueChange={(files) => setFotosCirugia(Array.isArray(files) ? files : [])}
  onDelete={async (fileKey) => {
    try {
      const id = Number(procPacId);
      if (!id || Number.isNaN(id)) throw new Error("Guardá el parte primero (no hay ID)");
      await deleteFotoProcedimiento(id, fileKey);
      await loadFotosBackend(id);
    } catch (e) {
      alert("No se pudo borrar la foto: " + (e?.message || ""));
    }
  }}
  deleteFotoProcedimiento={deleteFotoProcedimiento}
/>

</div>

            {/* Equipo quirúrgico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
            </div>
            <div className="my-4 h-px bg-gray-700/60" />


            {/* Error */}
            {error && <div ref={errorRef} className="mt-3 text-red-400 text-sm">{error}</div>}


            

            {/* Modal alta profesional */}
            <ModalCargaProfesional
                isOpen={openModalPro}
                onClose={() => {
                    setOpenModalPro(false);
                    // refresco por las dudas
                    fetchList("/bases/cirujanos/", setCirujanos);
                    fetchList("/bases/anestesiologos/", setAnestesiologos);
                    fetchList("/bases/instrumentadores/", setInstrumentadores);
                }}
                tipo={modalTipo}
                onSave={async ({ nombre }) => {
                    // POST según tipo
                    const mapUrl = {
                        cirujano: "/profesionales/cirujanos",
                        anestesiologo: "/profesionales/anestesiologos",
                        instrumentador: "/profesionales/instrumentadores",
                    };
                    const r = await fetch(`${API}${mapUrl[modalTipo]}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nombre })
                    });
                    if (!r.ok) throw new Error("No se pudo guardar el profesional.");
                    return await r.json();
                }}
                profesional={null}
            />
            {/* Sticky footer de acciones */}
            <div className="sticky bottom-0 left-0 right-0 z-20 mt-4">
                <div className="backdrop-blur bg-gray-900/70 border-t border-gray-700 px-3 py-2 flex items-center justify-center gap-3 shadow">
                    {isUpdate ? (
                        <>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="inline-flex items-center gap-2 px-3 h-9 rounded border border-gray-600 text-gray-200 hover:bg-gray-800"
                                title="Salir"
                            >
                                Salir
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="inline-flex items-center gap-2 px-4 h-10 rounded border border-emerald-600 text-emerald-300 hover:bg-emerald-900 disabled:opacity-60"
                                title="Actualizar parte quirúrgico"
                                disabled={saving}
                            >
                                <FiSave />
                                {saving ? "Actualizando…" : "Actualizar"}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="inline-flex items-center gap-2 px-4 h-10 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 disabled:opacity-60"
                                title="Cancelar"
                            >
                                Salir
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="inline-flex items-center gap-2 px-4 h-10 rounded border border-emerald-600 text-emerald-300 hover:bg-emerald-900 disabled:opacity-60"
                                title="Guardar parte quirúrgico"
                                disabled={saving}
                            >
                                <FiSave />
                                {saving ? "Guardando…" : "Guardar"}
                            </button>
                        </>
                    )}
                </div>
            </div>


            {/* Modales CRUD: Diagnósticos y Procedimientos */}
            <ModalBases
                open={openDiagModal}
                onClose={() => setOpenDiagModal(false)}
                title="Diagnósticos preoperatorios"
                resource="diagnosticos"
                apiBase={API}
                resourcePath="/bases/diagnosticos/"
                initialItems={listaDiagModal}
                items={listaDiagModal}
                showNew
                showEdit
                showDelete
                onChanged={async () => {
                    await fetchDiagnosticos();
                }}
                onCreate={async (nombre) => {
                    await fetch(`${API}/bases/diagnosticos/`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nombre }),
                    });
                    await fetchDiagnosticos();
                }}
                onUpdate={async (id, nombre) => {
                    await fetch(`${API}/bases/diagnosticos/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nombre }),
                    });
                    await fetchDiagnosticos();
                    // si el seleccionado coincide, actualizar etiqueta
                    setForm((f) => {
                        if (!f.id_diagnostico_pre) return f;
                        const same = String(f.id_diagnostico_pre) === String(id);
                        return same ? { ...f, dx_pre: nombre } : f;
                    });
                }}
                onDelete={async (id) => {
                    await fetch(`${API}/bases/diagnosticos/${id}`, { method: "DELETE" });
                    await fetchDiagnosticos();
                    // limpiar si se borró el seleccionado
                    setForm((f) => (String(f.id_diagnostico_pre) === String(id) ? { ...f, id_diagnostico_pre: null, dx_pre: "" } : f));
                }}
            />
        </div>
      </div>
    </div>
  </div>
);
}
