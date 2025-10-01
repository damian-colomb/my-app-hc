// OptimizedPanelPacientes.jsx
// =======================
// Vista optimizada de gestión de pacientes con lazy loading y cache

import React, { useState, useCallback, useMemo } from "react";
import { useOptimizedAPI } from "../hooks/useOptimizedAPI";
import ModalNuevoPaciente from "../components/ModalNuevoPaciente";
import { EyeIcon, ClipboardDocumentListIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

export default function OptimizedPanelPacientes() {
    // ===============================
    // 1. ESTADOS
    // ===============================
    const [busqueda, setBusqueda] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false);
    const [pacienteEnEdicion, setPacienteEnEdicion] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);

    const navigate = useNavigate();

    // ===============================
    // 2. API OPTIMIZADA
    // ===============================
    
    // Construir URL con parámetros
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: pageSize.toString(),
            ...(busqueda.trim() && { search: busqueda.trim() })
        });
        return `/pacientes/?${params.toString()}`;
    }, [page, pageSize, busqueda, reloadToken]);

    // Hook optimizado para cargar pacientes
    const {
        data: pacientesData,
        loading,
        error,
        refetch
    } = useOptimizedAPI(apiUrl, {
        debounceMs: 300,
        cacheKey: `pacientes_${busqueda}_${page}_${pageSize}`,
        retryAttempts: 2
    });

    // ===============================
    // 3. FUNCIONES OPTIMIZADAS
    // ===============================

    const handleBusquedaChange = useCallback((e) => {
        setBusqueda(e.target.value);
        setPage(1); // Reset a página 1 en nueva búsqueda
    }, []);

    const handlePageChange = useCallback((newPage) => {
        setPage(newPage);
        // Scroll suave al top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handlePageSizeChange = useCallback((newSize) => {
        setPageSize(newSize);
        setPage(1);
    }, []);

    const handleVerHistoria = useCallback((paciente) => {
        navigate("/hc", { state: { paciente } });
    }, [navigate]);

    const handleEditarPaciente = useCallback((paciente) => {
        setPacienteEnEdicion(paciente);
        setModalEdicionAbierto(true);
    }, []);

    const handleEliminarPaciente = useCallback(async (idPaciente) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este paciente?')) return;
        
        try {
            // Aquí iría la llamada API para eliminar
            console.log('Eliminando paciente:', idPaciente);
            // await api.delete(`/pacientes/${idPaciente}`);
            refetch(); // Recargar datos
        } catch (error) {
            console.error('Error eliminando paciente:', error);
        }
    }, [refetch]);

    const handleModalClose = useCallback(() => {
        setModalEdicionAbierto(false);
        setPacienteEnEdicion(null);
    }, []);

    const handlePacienteGuardado = useCallback(() => {
        setReloadToken(prev => prev + 1); // Forzar recarga
        handleModalClose();
    }, [handleModalClose]);

    // ===============================
    // 4. RENDERIZADO OPTIMIZADO
    // ===============================

    const pacientes = pacientesData?.items || [];
    const totalPacientes = pacientesData?.total || 0;
    const totalPages = Math.ceil(totalPacientes / pageSize);

    // Memoizar la lista de pacientes para evitar re-renders innecesarios
    const pacientesList = useMemo(() => {
        return pacientes.map((paciente) => (
            <tr key={paciente.id_paciente} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {paciente.nombre}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {paciente.dni}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {paciente.nombre_cobertura || 'Sin cobertura'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {paciente.telefono || 'Sin teléfono'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handleVerHistoria(paciente)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver historia clínica"
                        >
                            <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => handleEditarPaciente(paciente)}
                            className="text-green-600 hover:text-green-900"
                            title="Editar paciente"
                        >
                            <ClipboardDocumentListIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => handleEliminarPaciente(paciente.id_paciente)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar paciente"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </td>
            </tr>
        ));
    }, [pacientes, handleVerHistoria, handleEditarPaciente, handleEliminarPaciente]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="px-4 py-6 sm:px-0">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-900">Gestión de Pacientes</h1>
                        <button
                            onClick={() => setModalEdicionAbierto(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                            Nuevo Paciente
                        </button>
                    </div>
                </div>

                {/* Filtros y búsqueda */}
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Buscar paciente
                            </label>
                            <input
                                type="text"
                                value={busqueda}
                                onChange={handleBusquedaChange}
                                placeholder="Nombre o DNI..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Registros por página
                            </label>
                            <select
                                value={pageSize}
                                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={refetch}
                                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                            >
                                Actualizar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabla de pacientes */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            <span className="ml-4 text-gray-600">Cargando pacientes...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-600">Error cargando pacientes: {error.message}</p>
                            <button
                                onClick={refetch}
                                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : (
                        <>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Nombre
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            DNI
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Cobertura
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Teléfono
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {pacientesList}
                                </tbody>
                            </table>

                            {/* Paginación */}
                            {totalPages > 1 && (
                                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                                    <div className="flex-1 flex justify-between sm:hidden">
                                        <button
                                            onClick={() => handlePageChange(page - 1)}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(page + 1)}
                                            disabled={page === totalPages}
                                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Mostrando <span className="font-medium">{((page - 1) * pageSize) + 1}</span> a{' '}
                                                <span className="font-medium">{Math.min(page * pageSize, totalPacientes)}</span> de{' '}
                                                <span className="font-medium">{totalPacientes}</span> resultados
                                            </p>
                                        </div>
                                        <div>
                                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => handlePageChange(pageNum)}
                                                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                            pageNum === page
                                                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                ))}
                                            </nav>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal de edición */}
            {modalEdicionAbierto && (
                <ModalNuevoPaciente
                    isOpen={modalEdicionAbierto}
                    onClose={handleModalClose}
                    onPacienteGuardado={handlePacienteGuardado}
                    pacienteExistente={pacienteEnEdicion}
                />
            )}
        </div>
    );
}
