import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import ModalListaEditable from "./ModalListaEditable";
import ModalMensaje from "./ModalMensaje";

import { API_BASE } from "../config.js";
const url = (ep) => `${API_BASE.replace(/\/+$/, "")}/${String(ep).replace(/^\/+/, "")}`;

export default function ModalPaciente({ paciente, onClose, onEdit }) {
    const [modoEdicion, setModoEdicion] = useState(false);
    const [coberturas, setCoberturas] = useState([]);
    const [nacionalidades, setNacionalidades] = useState([]);
    const [localidades, setLocalidades] = useState([]);
    const [sexos, setSexos] = useState([]);
    const [datosEditables, setDatosEditables] = useState({ ...paciente });
    const [mostrarModalCobertura, setMostrarModalCobertura] = useState(false);
    // Estado para mostrar modal de nacionalidad editable
    const [mostrarModalNacionalidad, setMostrarModalNacionalidad] = useState(false);
    // Estado para mostrar modal de localidad editable
    const [mostrarModalLocalidad, setMostrarModalLocalidad] = useState(false);
    const [modalMensaje, setModalMensaje] = useState(null);

    const fetchCoberturas = async () => {
        try {
            const res = await api.get("coberturas");
            setCoberturas(res.data);
        } catch (error) {
            console.error("Error al recargar coberturas:", error);
        }
    };

    useEffect(() => {
        setDatosEditables({ ...paciente });
    }, [paciente]);

    // Función para cargar todas las opciones de listas desplegables
    const fetchOpciones = async () => {
        try {
            await Promise.all([
                fetchCoberturas(),
                api.get("nacionalidades").then(res => setNacionalidades(res.data)),
                api.get("localidades").then(res => setLocalidades(res.data)),
                api.get("sexo").then(res => setSexos(res.data))
            ]);
        } catch (error) {
            console.error("Error al cargar opciones:", error);
        }
    };

    useEffect(() => {
        fetchOpciones();
    }, []);

    useEffect(() => {
    }, [coberturas, nacionalidades, localidades, sexos]);

    if (!paciente) return null;

    

    function calcularEdad(fechaNacimiento) {
        const hoy = new Date();
        const nacimiento = new Date(fechaNacimiento);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg py-6 px-8 w-full max-w-4xl shadow-lg">
                <h3 className="text-xl font-semibold mb-8 text-center text-white dark:text-white">
                    DATOS DE: <span className="text-green-400 font-bold">{datosEditables?.nombre?.toUpperCase()}</span>
                </h3>
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                    <div>
                        <label className="text-white font-bold text-sm text-center block mb-1">NOMBRE</label>
                        <input
                            type="text"
                            value={datosEditables.nombre}
                            onChange={(e) => setDatosEditables({ ...datosEditables, nombre: e.target.value })}
                            disabled={!modoEdicion}
                            className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-full text-sm px-2 py-1 rounded shadow`}
                        />
                    </div>
                    <div>
                        <label className="text-white font-bold text-sm text-center block mb-1">DNI</label>
                        <input
                            type="text"
                            value={datosEditables.dni}
                            onChange={(e) => setDatosEditables({ ...datosEditables, dni: e.target.value })}
                            disabled={!modoEdicion}
                            className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-full text-sm px-2 py-1 rounded shadow`}
                        />
                    </div>

                    <div className="col-span-2 flex gap-4">
                        <div className="w-1/3">
                            <label className="text-white font-bold text-sm text-center block mb-1">SEXO</label>
                            <select
                                value={Number(datosEditables.sexo) || ""}
                                disabled={!modoEdicion}
                                onChange={(e) => {
                                    setDatosEditables({ ...datosEditables, sexo: Number(e.target.value) });
                                }}
                                className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-full text-sm px-2 py-1 rounded shadow text-center mx-auto`}
                            >
                                {sexos?.map(s => {
                                    return (
                                        <option key={s.id_sexo} value={s.id_sexo}>
                                            {s.sexo}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="w-1/3">
                            <label className="text-white font-bold text-sm text-center block mb-1">FECHA DE NACIMIENTO</label>
                            <input
                                type={modoEdicion ? "date" : "text"}
                                value={modoEdicion ? datosEditables.fecha_nacimiento : datosEditables.fecha_nacimiento}
                                onChange={(e) => setDatosEditables({ ...datosEditables, fecha_nacimiento: e.target.value })}
                                disabled={!modoEdicion}
                                className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-full text-sm px-2 py-1 rounded shadow text-center`}
                                max={new Date().toISOString().split("T")[0]}
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="text-white font-bold text-sm text-center block mb-1">EDAD</label>
                            <input
                                type="text"
                                value={calcularEdad(datosEditables.fecha_nacimiento)}
                                onChange={() => {}}
                                disabled={!modoEdicion}
                                className="bg-gray-900 text-white font-semibold w-full text-sm px-2 py-1 rounded text-center cursor-default"
                            />
                        </div>
                    </div>

                    {/* Cobertura con botón "+" para editar lista cuando está en modo edición */}
                    <div className="relative">
                        <label className="text-white font-bold text-sm text-center block mb-1">COBERTURA</label>
                        <select
                            value={Number(datosEditables.cobertura) || ""}
                            disabled={!modoEdicion}
                            onChange={(e) => setDatosEditables({ ...datosEditables, cobertura: Number(e.target.value) })}
                            className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-[calc(100%-3rem)] pr-8 text-sm px-2 py-1 rounded shadow text-center mx-auto`}
                        >
                            {coberturas?.map(c => (
                                <option key={c.id_cobertura} value={c.id_cobertura}>{c.nombre_cobertura}</option>
                            ))}
                        </select>
                        {modoEdicion && (
                            <button
                                onClick={() => setMostrarModalCobertura(true)}
                                className="absolute top-[1.5rem] right-1 bg-black text-green-400 border border-green-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold hover:bg-green-700 hover:text-white"
                            >
                                +
                            </button>
                        )}
                    </div>
                    <div>
                        <label className="text-white font-bold text-sm text-center block mb-1">BENEFICIO</label>
                        <input
                            type="text"
                            value={datosEditables.beneficio}
                            onChange={(e) => setDatosEditables({ ...datosEditables, beneficio: e.target.value })}
                            disabled={!modoEdicion}
                            className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-full text-sm px-2 py-1 rounded shadow`}
                        />
                    </div>

                    {/* Nacionalidad con botón "+" para editar lista cuando está en modo edición */}
                    <div className="relative">
                        <label className="text-white font-bold text-sm text-center block mb-1">NACIONALIDAD</label>
                        <select
                            value={Number(datosEditables.nacionalidad) || ""}
                            disabled={!modoEdicion}
                            onChange={(e) => setDatosEditables({ ...datosEditables, nacionalidad: Number(e.target.value) })}
                            className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-[calc(100%-3rem)] pr-8 text-sm px-2 py-1 rounded shadow text-center mx-auto`}
                        >
                            {nacionalidades?.map(n => (
                                <option key={n.id_nacionalidad} value={n.id_nacionalidad}>{n.nombre_nacionalidad}</option>
                            ))}
                        </select>
                        {modoEdicion && (
                            <button
                                onClick={() => setMostrarModalNacionalidad(true)}
                                className="absolute top-[1.5rem] right-1 bg-black text-green-400 border border-green-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold hover:bg-green-700 hover:text-white"
                            >
                                +
                            </button>
                        )}
                    </div>

                    {/* Localidad con botón "+" para editar lista cuando está en modo edición */}
                    <div className="relative">
                        <label className="text-white font-bold text-sm text-center block mb-1">LOCALIDAD</label>
                        <select
                            value={Number(datosEditables.localidad) || ""}
                            disabled={!modoEdicion}
                            onChange={(e) => setDatosEditables({ ...datosEditables, localidad: Number(e.target.value) })}
                            className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-[calc(100%-3rem)] pr-8 text-sm px-2 py-1 rounded shadow text-center mx-auto`}
                        >
                            {localidades?.map(l => (
                                <option key={l.id_localidad} value={l.id_localidad}>{l.nombre_localidad}</option>
                            ))}
                        </select>
                        {modoEdicion && (
                            <button
                                onClick={() => setMostrarModalLocalidad(true)}
                                className="absolute top-[1.5rem] right-1 bg-black text-green-400 border border-green-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold hover:bg-green-700 hover:text-white"
                            >
                                +
                            </button>
                        )}
                    </div>

                    <div className="col-span-2 mt-2">
                        <label className="text-white font-bold text-sm text-center block mb-1">ANEXO</label>
                        <textarea
                            value={datosEditables.anexo}
                            onChange={(e) => setDatosEditables({ ...datosEditables, anexo: e.target.value })}
                            disabled={!modoEdicion}
                            className={`${modoEdicion ? "bg-blue-100 text-black" : "bg-gray-700 text-white"} font-semibold w-full min-h-[100px] text-sm px-2 py-1 rounded shadow resize-none`}
                        />
                    </div>
                </div>
                <div className="mt-6 mb-2 flex justify-end space-x-4">
                    {!modoEdicion ? (
                        <button
                            onClick={() => setModoEdicion(true)}
                            className="bg-black border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black px-6 py-2 rounded shadow-lg transition duration-200"
                        >
                            Editar
                        </button>
                    ) : (
                        <button
                            onClick={() => setModoEdicion(false)}
                            className="bg-black border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-black px-6 py-2 rounded shadow-lg transition duration-200"
                        >
                            Volver
                        </button>
                    )}
                    {modoEdicion && (
                        <button
                            onClick={async () => {
                                try {
                                    const response = await api.put(
                                        url(`pacientes/${Number(datosEditables.id_paciente)}`),
                                        datosEditables
                                    );
                                    setModoEdicion(false);
                                    if (typeof onEdit === 'function') {
                                        onEdit();  // Notifica a PanelPacientes que se actualizó el paciente
                                    }
                                    
                                } catch (error) {
                                    const status = error?.response?.status;
                                    const data = error?.response?.data;
                                    console.log("Error de backend recibido:", JSON.stringify(data, null, 2)); // AGREGAR ESTA LÍNEA
                                    console.log("DNI que se manda al modal:", datosEditables.dni);
                                    if (status === 400 && data?.detail?.error === "DNI duplicado") {
                                            setModalMensaje({
                                            tipo: "dni_duplicado",
                                            dni: datosEditables.dni,
                                            nombreExistente: data.detail.pacienteExistente,
                                            onCerrar: () => setModalMensaje(null),
                                        });
                                        return;
                                    }
                                        console.error("Error desconocido al guardar paciente:", error);
                                }
                            }}
                            className="bg-black border border-green-500 text-green-500 hover:bg-green-500 hover:text-black px-6 py-2 rounded shadow-lg transition duration-200"
                        >
                            Guardar
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (typeof onEdit === 'function') {
                                onEdit();  // Asegura que se refresque la tabla al salir
                            }
                            if (typeof onClose === 'function') {
                                onClose();
                            }
                        }}
                        className="bg-black border border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-black px-6 py-2 rounded shadow-lg transition duration-200"
                    >
                        Salir
                    </button>
                </div>
            </div>

            {/* Modal para editar lista de Coberturas */}
            {mostrarModalCobertura && (
                <ModalListaEditable
                    titulo="Cobertura"
                    endpoint="coberturas"
                    campoNombre="nombre_cobertura"
                    idCampo="id_cobertura"
                    onClose={() => {
                        setMostrarModalCobertura(false);
                        fetchCoberturas(); // Recarga lista de coberturas al cerrar modal
                    }}
                />
            )}

            {/* Modal para editar lista de Nacionalidades */}
            {mostrarModalNacionalidad && (
                <ModalListaEditable
                    titulo="Nacionalidad"
                    endpoint="nacionalidades"
                    campoNombre="nombre_nacionalidad"
                    idCampo="id_nacionalidad"
                    onClose={() => {
                        setMostrarModalNacionalidad(false);
                        fetchOpciones(); // Recarga todas las opciones al cerrar modal
                    }}
                />
            )}

            {/* Modal para editar lista de Localidades */}
            {mostrarModalLocalidad && (
                <ModalListaEditable
                    titulo="Localidad"
                    endpoint="localidades"
                    campoNombre="nombre_localidad"
                    idCampo="id_localidad"
                    onClose={() => {
                        setMostrarModalLocalidad(false);
                        fetchOpciones(); // Recarga todas las opciones al cerrar modal
                    }}
                />
            )}
            
            {modalMensaje && (
                <ModalMensaje
                    tipo={modalMensaje.tipo}
                    titulo={modalMensaje.titulo}
                    mensaje={modalMensaje.mensaje}
                    nombre={modalMensaje.nombre}
                    nombreExistente={modalMensaje.nombreExistente}
                    dni={modalMensaje?.dni}
                    tipoEntidad={modalMensaje.tipoEntidad}
                    onCerrar={modalMensaje.onCerrar}
                />
            )}
        </div>
    );
    }