// src/pages/Modulos/elementosPartes/constants.js
import { API_BASE } from "../../../config.js";

export const DEBUG = import.meta?.env?.VITE_DEBUG === "true";
// Usar la configuración centralizada
export const API = API_BASE;
// Default real del backend para técnicas
export const TECNICAS_PATH = import.meta?.env?.VITE_TECNICAS_PATH || "/bases/tecnicas";

export const PARTES_PATH = "/partes/"; // POST alta, PUT `${id}/`
export const FOTOS_PROC_PATH = "/procedimientos/"; // para fotos: `${id}/fotos`

export const MAX_CODIGOS = 24;
export const LONG_LABEL_CHARS = 48;

// Mientras el trigger de DB esté pendiente, mantenelo en true
export const BLOCK_SAVE_TEMP = false;

