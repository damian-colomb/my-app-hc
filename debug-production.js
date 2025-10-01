// Script para debuggear la configuración en producción
console.log("=== DEBUG PRODUCCIÓN ===");
console.log("Hostname:", window.location.hostname);
console.log("Origin:", window.location.origin);
console.log("Protocol:", window.location.protocol);

// Simular la lógica de config.js
const hostname = window?.location?.hostname;
let API_BASE;

if (hostname === "localhost") {
    API_BASE = "http://localhost:8000";
} else {
    API_BASE = "https://endoscopia-backend-production.onrender.com";
}

console.log("API_BASE calculado:", API_BASE);
console.log("¿Es HTTPS?", API_BASE.startsWith("https://"));

// Probar la URL de coberturas
const urlCoberturas = `${API_BASE}/coberturas/`;
console.log("URL de coberturas:", urlCoberturas);

// Probar hacer un fetch
fetch(urlCoberturas)
    .then(response => {
        console.log("Response status:", response.status);
        console.log("Response headers:", [...response.headers.entries()]);
        return response.text();
    })
    .then(data => {
        console.log("Response data:", data);
    })
    .catch(error => {
        console.error("Error en fetch:", error);
    });
