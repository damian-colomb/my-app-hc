// src/pages/Modulos/elementosPartes/utils.js

export function addMinutesToHHMM(hhmm, minutes) {
  if (!hhmm) return "";
  try {
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
    const base = new Date(0, 0, 0, h, m, 0, 0);
    base.setMinutes(base.getMinutes() + minutes);
    const hh = String(base.getHours()).padStart(2, "0");
    const mm = String(base.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return hhmm;
  }
}

export function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function normalizeName(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\t/g, " ")
    .trim()
    .toLowerCase();
}

export function resolveIdByName(name, list, idKeys = ["id"]) {
  if (!name || !Array.isArray(list) || list.length === 0) return null;
  const target = normalizeName(name);
  for (const item of list) {
    const nm = normalizeName(item?.nombre ?? item?.nombre_cirujano ?? item?.descripcion ?? "");
    if (nm && nm === target) {
      for (const k of idKeys) {
        if (item && item[k] != null && item[k] !== "") return item[k];
      }
    }
  }
  return null;
}

export function keyOf(obj, idx, prefix) {
  return (
    obj?.id_cirujano ??
    obj?.id_anestesiologo ??
    obj?.id_instrumentador ??
    obj?.id_diagnostico ??
    obj?.id_procedimiento ??
    obj?.id_tecnica ??
    obj?.id_tipo_anestesia ??
    obj?.id ??
    obj?.tecnica ??
    obj?.nombre ??
    `auto-${prefix}-${idx}`
  );
}