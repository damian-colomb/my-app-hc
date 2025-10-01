import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

export default function LogoutButton() {
    const { logout, user } = useAuth();

    const handleLogout = () => {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            logout();
            window.location.reload();
        }
    };

    return (
        <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
                Bienvenido, {user?.name || user?.username}
            </span>
            <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-red-600 hover:text-red-800 transition-colors"
                title="Cerrar sesión"
            >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span className="text-sm">Salir</span>
            </button>
        </div>
    );
}
