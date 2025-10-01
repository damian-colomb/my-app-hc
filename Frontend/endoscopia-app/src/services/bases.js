// src/api/bases.js
import axios from "axios";
import { API_URL } from "../config";

const http = axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
});

// Formato estándar esperado por el back: { id, nombre }
export async function listBase(resource, params = {}) {
    const { data } = await http.get(`/bases/${resource}/`, { params });
    return Array.isArray(data) ? data : [];
}

export async function createBase(resource, payload) {
    // payload típico: { nombre: "Texto" }
    const { data } = await http.post(`/bases/${resource}/`, payload);
    return data;
}

export async function updateBase(resource, id, payload) {
    const { data } = await http.put(`/bases/${resource}/${id}`, payload);
    return data;
}

export async function deleteBase(resource, id) {
    const { data } = await http.delete(`/bases/${resource}/${id}`);
    return data;
}

export async function searchBase(resource, q) {
    // si más adelante agregamos ?q= al backend, quedará plug&play
    const { data } = await http.get(`/bases/${resource}/`, { params: { q } });
    return Array.isArray(data) ? data : [];
}

/* ------------------------------------------------------------------
   Procedimientos – helpers de fotos (usa el mismo http/axios)
   Endpoints backend:
    GET    /procedimientos/{id_proc_pac}/fotos
    POST   /procedimientos/{id_proc_pac}/fotos   (multipart: files[])
    DELETE /procedimientos/{id_proc_pac}/fotos/{id_foto}
------------------------------------------------------------------- */

export async function getFotosProcedimiento(idProcPac) {
    const { data } = await http.get(`/procedimientos/${idProcPac}/fotos`);
    return Array.isArray(data) ? data : [];
}

export async function uploadFotosProcedimiento(idProcPac, fileList) {
    const fd = new FormData();
    [...fileList].forEach((f) => fd.append("files", f));
    const { data } = await http.post(`/procedimientos/${idProcPac}/fotos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return Array.isArray(data) ? data : [];
}

export async function deleteFotoProcedimiento(idProcPac, idFoto) {
    const { data } = await http.delete(`/procedimientos/${idProcPac}/fotos/${idFoto}`);
    return data;
}