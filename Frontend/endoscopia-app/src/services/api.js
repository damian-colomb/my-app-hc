import cfg from "../config";

function buildUrl(path) {
    const base = (cfg?.API_BASE || "/api").replace(/\/$/, "");
    if (/^https?:/i.test(path)) return path; // si ya viene absoluto
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
    }

    export async function fetchJSON(path, options = {}) {
    const url = buildUrl(path);
    const opts = { headers: { "Content-Type": "application/json" }, ...options };
    const res = await fetch(url, opts);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(`HTTP ${res.status} on ${url}`);
        err.status = res.status; err.url = url; err.body = text;
        throw err;
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
}

export default { fetchJSON };