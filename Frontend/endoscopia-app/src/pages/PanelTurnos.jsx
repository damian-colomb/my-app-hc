// src/pages/PanelTurnos.jsx
import { useState, useEffect } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { useNavigate } from "react-router-dom";
import ModalListaEditable from "../components/ModalListaEditable";
import ModalMensaje from "../components/ModalMensaje";
            
function PanelTurnos() {
    const [turnos, setTurnos] = useState([]);
    // Nuevo estado: todos los turnos traídos del backend (no filtrados)
    const [todosLosTurnos, setTodosLosTurnos] = useState([]);
    const [nombre, setNombre] = useState("");
    const [fecha, setFecha] = useState("");
    const [motivo, setMotivo] = useState("");
    const [botonCargado, setBotonCargado] = useState(false);

    // Nuevo estado para fecha de búsqueda
    const [fechaBusqueda, setFechaBusqueda] = useState("");

    const [diasConTurnos, setDiasConTurnos] = useState([]);

    // Estado para filtrar turnos por nombre
    const [filtroTurnos, setFiltroTurnos] = useState("");

    // Estado para modal de borrar turno
    const [mostrarModalBorrar, setMostrarModalBorrar] = useState(false);
    const [turnoAEliminar, setTurnoAEliminar] = useState(null);

    // Estado para mostrar el modal de éxito al agregar turno
    const [mostrarModalExito, setMostrarModalExito] = useState(false);

    useEffect(() => {
        fetch("/api/turnos/")
            .then(res => res.json())
            .then(data => {
                const fechas = data.map(t => t.fecha);
                setDiasConTurnos(fechas);
            })
            .catch(err => console.error("Error al traer fechas de turnos:", err));
    }, []);

    // Derivadores
    const [derivador, setDerivador] = useState("");
    const [listaDerivadores, setListaDerivadores] = useState([]);
    const [mostrarModalDerivador, setMostrarModalDerivador] = useState(false);

useEffect(() => {
    fetch("/api/derivadores/")
        .then((res) => res.json())
        .then((data) => {
            const ordenados = data.sort((a, b) =>
                a.nombre_derivador.localeCompare(b.nombre_derivador)
            );
            setListaDerivadores(ordenados);
        })
        .catch((err) => console.error("Error al obtener derivadores:", err));
}, []);

    useEffect(() => {
        // Este efecto ahora solo se ejecuta una vez al montar el componente
    }, []);  // Se ejecuta solo una vez
    const handleBuscarTurnos = async () => {
        try {
            const res = await fetch("/api/turnos/");
            if (!res.ok) throw new Error("Error al obtener turnos");
            const data = await res.json();

            const mapeados = data.map(t => {
                const derivadorData = listaDerivadores.find(d => d.id_derivador === t.derivador);
                return {
                    ...t,
                    nombre_derivador: derivadorData ? derivadorData.nombre_derivador : "-"
                };
            });

            const ordenados = mapeados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            setTodosLosTurnos(ordenados);
        } catch (err) {
            console.error("Error al traer turnos:", err);
        }
    };
    // Cargar todos los turnos al montar el componente o cuando se actualiza la lista de derivadores
    useEffect(() => {
        if (listaDerivadores.length > 0) {
            handleBuscarTurnos();
        }
    }, [listaDerivadores]);

    const agregarTurno = () => {
        if (!nombre || !fecha ) return;

        // Buscar el id del derivador por nombre
        const derivadorSeleccionado = listaDerivadores.find(d => d.nombre_derivador === derivador);
        const derivadorId = derivadorSeleccionado ? derivadorSeleccionado.id_derivador : null;

        const nuevoTurno = {
            nombre,
            fecha,
            motivo,
            derivador: derivadorId
        };

        fetch("/api/turnos/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nuevoTurno),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Error al crear el turno");
                return res.json();
            })
            .then((data) => {
                // Actualiza todosLosTurnos para mantener fuente de verdad
                setTodosLosTurnos(prev => [
                    ...prev,
                    {
                        ...data,
                        nombre_derivador: derivadorSeleccionado?.nombre_derivador || ""
                    }
                ]);
                setNombre("");
                setFecha("");
                setMotivo("");
                setDerivador("");
                setFechaBusqueda(data.fecha);  // Seleccionar el día del turno cargado
                setBotonCargado(true);
                setTimeout(() => {
                    setBotonCargado(false);
                }, 2000);

                // Actualizar los días con turnos después de agregar uno nuevo (más rápido)
                setDiasConTurnos(prev => [...prev, data.fecha]);
            })
            .catch((err) => console.error("Error al cargar turno:", err));
    };

    const eliminarTurnoConfirmado = () => {
        if (!turnoAEliminar) return;
        fetch(`/api/turnos/${turnoAEliminar}`, {
            method: "DELETE"
        })
            .then(res => {
                if (!res.ok) throw new Error("Error al eliminar turno");
                setTodosLosTurnos(prev => prev.filter(t => t.id_turno !== turnoAEliminar));
                setTurnoAEliminar(null);
                setMostrarModalBorrar(false);
            })
            .catch(err => console.error("Error al eliminar turno:", err));
    };

    const navigate = useNavigate();

    // Función auxiliar para formatear la fecha
    const formatearFecha = (fechaStr) => {
        const [year, month, day] = fechaStr.split("-");
        return `${day}/${month}/${year}`;
    };

    // Estado para controlar el mes actual visible en el calendario
    const [fechaInicio, setFechaInicio] = useState(new Date());

    // Interceptar click sobre el label del calendario (ej: "Julio de 2025")
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const labelBtn = document.querySelector('.react-calendar__navigation__label');
            if (labelBtn) {
                labelBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Obtener mes y año directamente del texto del label
                    const labelText = labelBtn.textContent;
                    const meses = {
                        "enero": "01",
                        "febrero": "02",
                        "marzo": "03",
                        "abril": "04",
                        "mayo": "05",
                        "junio": "06",
                        "julio": "07",
                        "agosto": "08",
                        "septiembre": "09",
                        "octubre": "10",
                        "noviembre": "11",
                        "diciembre": "12"
                    };

                    const partes = labelText.toLowerCase().split(" de ");
                    const mes = meses[partes[0]];
                    const anio = partes[1];

                    if (mes && anio) {
                        const formatoMes = `${anio}-${mes}`;
                        setFechaBusqueda(formatoMes);
                    }
                };
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    // Filtrado dinámico de turnos antes del return
    const turnosFiltrados = todosLosTurnos.filter(t => {
        const coincideNombre = filtroTurnos !== "" ? t.nombre.toLowerCase().includes(filtroTurnos.toLowerCase()) : true;
        const coincideFecha = fechaBusqueda !== "" ? t.fecha === fechaBusqueda : true;

        if (filtroTurnos !== "") {
            return coincideNombre;
        }

        if (fechaBusqueda !== "") {
            return coincideFecha;
        }

        return false;
    });

    return (
        <div className="max-w-4xl mx-auto p-4 text-white">
            <h2 className="text-3xl font-bold mb-4 text-center text-blue-400 tracking-wide flex items-center justify-center gap-2 transition-opacity duration-700 ease-in-out opacity-100 hover:opacity-90">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                TURNOS
            </h2>
            <button
                onClick={() => navigate("/")}
                className="mb-6 border border-blue-400 text-blue-300 px-6 py-2 rounded hover:bg-blue-950 hover:text-blue-200 text-md font-semibold flex items-center gap-2 transition"
            >
                ← Volver
            </button>

            <div className="bg-gray-800 p-4 rounded mb-4 space-y-3 mb-4">
                <div className="flex flex-wrap gap-4 items-center justify-start">
                    <input
                        className="w-[300px] bg-gray-700 p-2 rounded"
                        placeholder="Nombre del paciente"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                    />

                    <div className="flex gap-2 items-center">
                        <select
                            className="w-[260px] bg-gray-700 p-2 rounded text-white"
                            value={derivador}
                            onChange={e => setDerivador(e.target.value)}
                        >
                            <option value="">Seleccionar derivador</option>
                            {listaDerivadores.map((d) => (
                                <option key={d.id_derivador} value={d.nombre_derivador}>
                                    {d.nombre_derivador}
                                </option>
                            ))}
                        </select>
                        <button
                            className="bg-blue-700 text-white px-2 rounded hover:bg-blue-800"
                            onClick={() => setMostrarModalDerivador(true)}
                        >
                            +
                        </button>
                    </div>

                    <div className="relative">
                        <input
                            type="date"
                            className="w-[130px] bg-gray-700 p-2 pl-8 rounded cursor-pointer text-white placeholder-gray-400"
                            placeholder="Seleccioná una fecha"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                        />
                        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                            📅
                        </div>
                    </div>

                    <input
                        className="w-[400px] bg-gray-700 p-2 rounded"
                        placeholder="Motivo (opcional)"
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                    />

                    <div className="flex items-center gap-3 mt-2">
                        <button
                            onClick={agregarTurno}
                            className={`border px-4 py-1 rounded text-sm transition duration-300 ${
                                botonCargado
                                    ? 'bg-green-500 text-white border-green-500'
                                    : 'border-green-400 text-green-400 hover:text-white hover:bg-green-600'
                            }`}
                        >
                            {botonCargado ? '✔ Cargado' : 'Cargar turno'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded mb-4 flex flex-col md:flex-row gap-4">
                <div className="w-[280px]">
                    <h3 className="text-md font-semibold text-white mb-2">Calendario de Turnos</h3>
                    <Calendar
                        className="rounded-lg shadow-md p-1 bg-white text-black text-sm"
                        view="month"
                        locale="es-AR"
                        activeStartDate={fechaInicio}
                        onActiveStartDateChange={({ activeStartDate }) => setFechaInicio(activeStartDate)}
                        onViewChange={() => {}}
                        onClickDay={(value) => {
                            const fechaISO = value.toISOString().split("T")[0];
                            setFechaBusqueda(fechaISO);
                        }}
                        tileContent={({ date, view }) => {
                            const fechaStr = date.toISOString().split("T")[0];
                            if (    view === "month") {
                                const cantidad = diasConTurnos.filter(f => f === fechaStr).length;
                                if (cantidad > 0) {
                                    return (
                                        <div className="flex justify-center gap-[1px] mt-1">
                                            {[...Array(cantidad)].map((_, idx) => (
                                                <div key={idx} className="h-1 w-1 bg-blue-400 rounded-full"></div>
                                            ))}
                                        </div>
                                    );
                                }
                            }
                            return null;
                        }}
                        tileClassName={({ date, view }) => {
                            const fechaStr = date.toISOString().split("T")[0];
                            if (view === "month" && fechaStr === fechaBusqueda) {
                                return "react-calendar__tile--active";
                            }
                            return "";
                        }}
                    />
                </div>
                <div className="ml-4 flex-1">
                    <div className="mb-2">
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            className="w-[220px] bg-gray-700 text-white p-2 rounded"
                            value={filtroTurnos}
                            onChange={(e) => setFiltroTurnos(e.target.value)}
                        />
                    </div>

                    {filtroTurnos !== "" || fechaBusqueda ? (
                        turnosFiltrados.length > 0 ? (
                            <>
                                <h3 className="text-md font-semibold text-blue-300 mb-2">Turnos encontrados</h3>
                                <div className="bg-gray-900 rounded overflow-hidden shadow-md">
                                    <div className="grid grid-cols-3 font-semibold text-sm text-white border-b border-gray-700 px-3 py-2">
                                        <div className="text-left">Nombre</div>
                                        <div className="text-left">Derivador</div>
                                        <div className="text-left">Motivo</div>
                                    </div>
                                    {turnosFiltrados.map((t, i) => (
                                        <div key={`Preview-${i}`}>
                                            <div className="grid grid-cols-3 px-3 py-2 border-b border-gray-800 hover:bg-gray-800 transition items-center">
                                                <p className="text-white break-words whitespace-normal text-sm">{t.nombre}</p>
                                                <p className="text-blue-400 break-words whitespace-normal text-sm">{t.nombre_derivador || "-"}</p>
                                                <div className="flex justify-between items-center text-gray-400 text-sm">
                                                    <span className="break-words whitespace-normal">{t.motivo || "-"}</span>
                                                    <button
                                                        onClick={() => {
                                                            setTurnoAEliminar(t.id_turno);
                                                            setMostrarModalBorrar(true);
                                                        }}
                                                        className="text-red-400 hover:text-red-600 text-xs px-2"
                                                        title="Eliminar turno"
                                                        style={{ background: "transparent", border: "none" }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-gray-400 text-sm">No hay turnos para mostrar</p>
                        )
                    ) : null}
                </div>
            </div>


            {/* Eliminado bloque VER TURNOS */}
            
            
            {mostrarModalDerivador && (
                <ModalListaEditable
                    titulo="Derivadores"
                    endpoint="derivadores"
                    campoNombre="nombre_derivador"
                    idCampo="id_derivador"
                    tipoEntidad="derivador"
                    mostrar={mostrarModalDerivador}
                    onClose={() => setMostrarModalDerivador(false)}
                />
            )}
            {mostrarModalBorrar && (
                <ModalMensaje
                    tipo="borrar_consulta"
                    mensaje="¿Estás seguro que querés borrar el turno?"
                    onClose={() => setMostrarModalBorrar(false)}
                    onConfirm={eliminarTurnoConfirmado}
                />
            )}
        {/* Calendario personalizado estilos */}
        <style>{`
    .react-calendar__tile--active {
        background-color: #2563eb !important;
        color: white !important;
    }

    .react-calendar__navigation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
    }

    .react-calendar__navigation__arrow {
        font-size: 1rem;
    }

    .react-calendar__navigation__label {
        font-size: 0.75rem;
        font-weight: 600;
        text-align: center;
        flex-grow: 1;
    }
`}</style>
    </div>
    );
}

export default PanelTurnos;         