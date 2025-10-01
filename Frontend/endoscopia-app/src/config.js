const hostname = window?.location?.hostname;

// Configuración de API base
let API_BASE;
if (hostname === "localhost") {
    API_BASE = "http://localhost:8001";
} else {
    // SIEMPRE usar HTTPS en producción - sin depender de variables de entorno
    API_BASE = "https://endoscopia-backend-production.onrender.com";
}

// Forzar HTTPS en producción (por seguridad)
if (hostname !== "localhost") {
    if (!API_BASE.startsWith("https://")) {
        console.warn("[config] Forzando HTTPS en producción");
        API_BASE = API_BASE.replace("http://", "https://");
    }
    // Asegurar que NUNCA use HTTP en producción
    if (API_BASE.startsWith("http://")) {
        console.error("[config] ERROR: Usando HTTP en producción, forzando HTTPS");
        API_BASE = API_BASE.replace("http://", "https://");
    }
}

// NO agregar barra final - las rutas se construyen dinámicamente

// Aliases por compatibilidad
export const API_URL = API_BASE;
export const url = API_BASE;


export { API_BASE };
export default { API_BASE };
