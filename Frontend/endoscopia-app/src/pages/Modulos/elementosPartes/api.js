import { API, TECNICAS_PATH, PARTES_PATH, FOTOS_PROC_PATH } from "./constants.js";

// ---- Robust fetch + 24h session cache for catalogs ----
const CATALOG_CACHE_PREFIX = "pq.cache.v1:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas - HABILITADO

function cacheKey(key) {
  return `${CATALOG_CACHE_PREFIX}${key}`;
}

function getCachedJSON(key) {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) {
      sessionStorage.removeItem(cacheKey(key));
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

function setCachedJSON(key, value, ttlMs = CACHE_TTL_MS) {
  try {
    if (typeof sessionStorage === "undefined") return;
    const payload = { exp: Date.now() + ttlMs, value };
    sessionStorage.setItem(cacheKey(key), JSON.stringify(payload));
  } catch {
    // storage may be full or unavailable; ignore
  }
}

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchJSON(url, options = {}, { timeoutMs = 7000 } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  
  // Agregar token de autenticación si está disponible
  const token = localStorage.getItem('authToken');
  const headers = {
    ...options.headers,
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
  
  try {
    const res = await fetch(url, { ...options, headers, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      const text = await (async () => {
        try { return await res.text(); } catch { return ""; }
      })();
      throw new Error(`HTTP error! status: ${res.status}, message: ${text}`);
    }
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(fn, { retries = 2, baseDelay = 250 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await sleep(baseDelay * Math.pow(2, i)); // 250 → 500 → 1000ms
        continue;
      }
    }
  }
  throw lastErr;
}

async function fetchJSONWithCache(key, url, normalizer = (x) => x) {
  const cached = getCachedJSON(key);
  if (cached) return cached;
  const data = await fetchWithRetry(() => fetchJSON(url));
  const normalized = normalizer(data);
  setCachedJSON(key, normalized);
  return normalized;
}

// Permite invalidar caches tras CRUD en modales
export function invalidateCatalogCache(keyStartsWith = "") {
  try {
    if (typeof sessionStorage === "undefined") return;
    const prefix = cacheKey(keyStartsWith);
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {}
}

// ---- Partes ----
export async function getParteCompleto(id_pp) {
  const url = `${API}${PARTES_PATH}completo/${id_pp}/`;
  return fetchJSON(url);
}

export async function saveParte(payload) {
  const url = `${API}${PARTES_PATH}`;
  return fetchJSON(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { timeoutMs: 12000 }
  );
}

export async function updateParte(id_pp, payload) {
  const url = `${API}${PARTES_PATH}${id_pp}/`;
  return fetchJSON(
    url,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { timeoutMs: 12000 }
  );
}

export async function fetchFotosParte(id_pp) {
  const url = `${API}${FOTOS_PROC_PATH}${id_pp}/fotos`;
  const data = await fetchJSON(url);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : [];
  return list.map((it) => ({
    ...it,
    url: it?.url || it?.file_url || it?.fileUrl || "",
  }));
}

// ---- Catálogos con cache 24h ----
export async function fetchTecnicas() {
  const base = TECNICAS_PATH?.startsWith("/") ? "" : "/";
  const url = `${API}${base}${TECNICAS_PATH}`;
  return fetchJSONWithCache(
    "catalogo:tecnicas",
    url,
    (arr) => (Array.isArray(arr) ? arr : [])
  );
}

export async function fetchDiagnosticos() {
  const url = `${API}/bases/diagnosticos/`;
  return fetchJSONWithCache(
    "catalogo:diagnosticos",
    url,
    (arr) => (Array.isArray(arr) ? arr : [])
  );
}

export async function fetchTiposAnestesia() {
  const url = `${API}/bases/tipos_anestesia/`;
  return fetchJSONWithCache(
    "catalogo:tipos_anestesia",
    url,
    (arr) => (Array.isArray(arr) ? arr : [])
  );
}

export async function fetchCirujanos() {
  const url = `${API}/bases/cirujanos/`;
  return fetchJSONWithCache(
    "catalogo:cirujanos",
    url,
    (arr) => (Array.isArray(arr) ? arr : [])
  );
}

export async function fetchInstrumentadores() {
  const url = `${API}/bases/instrumentadores/`;
  return fetchJSONWithCache(
    "catalogo:instrumentadores",
    url,
    (arr) => (Array.isArray(arr) ? arr : [])
  );
}

export async function fetchAnestesiologos() {
  const url = `${API}/bases/anestesiologos/`;
  return fetchJSONWithCache(
    "catalogo:anestesiologos",
    url,
    (arr) => (Array.isArray(arr) ? arr : [])
  );
}