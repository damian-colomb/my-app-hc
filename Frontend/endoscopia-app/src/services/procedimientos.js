// src/services/procedimientos.js
// Servicios para fotos de procedimientos/partes
// Usa fetch con API_BASE desde config.js

import { API_BASE } from "../config";

// Helper para armar URL base
function apiUrl(path) {
  const base = (API_BASE || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${base}/${p}`;
}

// === LISTAR FOTOS ===
// GET /procedimientos/{id_proc_pac}/fotos -> [] | {uploaded:[]}|{data:[]}
export async function getFotosProcedimiento(idProcPac) {
  if (!idProcPac) return [];
  const res = await fetch(apiUrl(`/procedimientos/${idProcPac}/fotos`), {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET fotos ${res.status} ${res.statusText}`);
  const raw = await res.json().catch(() => []);
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.uploaded)) return raw.uploaded;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

// === SUBIR FOTOS ===
// POST /procedimientos/{id_proc_pac}/fotos  (campo 'files')
export async function uploadFotosProcedimiento(idProcPac, fileList) {
  if (!idProcPac) throw new Error("Falta id del procedimiento_paciente");
  const incoming = Array.isArray(fileList) ? fileList : Array.from(fileList || []);

  // Normalizar a Files válidos (FileList, Array<File|Blob>, etc.)
  const files = incoming
    .filter(Boolean)
    .map((f) => {
      if (f instanceof File) return f;
      if (f instanceof Blob) return new File([f], "archivo", { type: f.type || "application/octet-stream" });
      return null;
    })
    .filter(Boolean);

  if (files.length === 0) throw new Error("No se adjuntaron archivos válidos");

  const fd = new FormData();
  for (const f of files) {
    // IMPORTANTE: campo plural 'files' (FastAPI: files: List[UploadFile] = File(...))
    fd.append("files", f, f.name || "archivo");
  }

  const res = await fetch(apiUrl(`/procedimientos/${idProcPac}/fotos`), {
    method: "POST",
    body: fd, // no setear Content-Type a mano; el browser agrega el boundary
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload falló ${res.status} ${res.statusText} ${txt}`.trim());
  }
  const raw = await res.json().catch(() => []);
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.uploaded)) return raw.uploaded;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

// === BORRAR FOTO ===
// Convenio de backend esperado:
//   DELETE /procedimientos/{id_proc_pac}/fotos?file_key=carpeta/archivo.jpg
export async function deleteFotoProcedimiento(idProcPac, fileKey) {
  if (!idProcPac || !fileKey) throw new Error("Falta id o file_key");
  const url = apiUrl(`/procedimientos/${idProcPac}/fotos?file_key=${encodeURIComponent(fileKey)}`);
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Delete falló ${res.status} ${res.statusText} ${txt}`.trim());
  }
  return true;
}