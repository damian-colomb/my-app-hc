import React, { useState, useEffect } from "react";

const ModalCargaProfesional = ({ isOpen, onClose, onSave, tipo, profesional }) => {
    const [nombre, setNombre] = useState("");

    useEffect(() => {
        if (profesional && profesional.nombre) {
            setNombre(profesional.nombre);
        } else {
            setNombre("");
        }
    }, [profesional, isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSave = () => {
        onSave({ nombre });
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onMouseDown={() => { /* no cerrar por click fuera */ }}
        >
            <div
                className="bg-gray-900 rounded-lg p-6 w-full max-w-md"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-semibold mb-4 text-white">
                    {profesional ? `Editar ${tipo}` : `Agregar ${tipo}`}
                </h2>
                <input
                    type="text"
                    className="w-full p-2 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white mb-6"
                    placeholder="Nombre completo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                />
                <div className="flex justify-end space-x-3">
                    <button
                        className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600"
                        onClick={onClose}
                        type="button"
                    >
                        Cancelar
                    </button>
                    <button
                        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                        onClick={handleSave}
                        type="button"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalCargaProfesional;