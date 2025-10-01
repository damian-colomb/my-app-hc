import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { API_BASE } from '../config';

export default function Login({ onLogin }) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Simular autenticación (en producción esto iría al backend)
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                onLogin(data.user);
            } else {
                const errorData = await response.json();
                setError(errorData.detail || 'Contraseña incorrecta');
            }
        } catch (error) {
            // Fallback para desarrollo - contraseña hardcodeada
            if (password === 'hospital2024') {
                const mockUser = {
                    id: 1,
                    username: 'admin',
                    name: 'Administrador',
                    role: 'admin'
                };
                localStorage.setItem('authToken', 'mock-token-' + Date.now());
                localStorage.setItem('user', JSON.stringify(mockUser));
                onLogin(mockUser);
            } else {
                setError('Contraseña incorrecta');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setPassword(e.target.value);
        setError(''); // Limpiar error al escribir
    };

    return (
        <div className="min-h-screen bg-[#050b16] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Efecto de fondo similar al MenuPrincipal */}
            <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -top-40 left-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
                    HISTORIA CLÍNICA
                </h2>
                
                <div className="flex justify-center mt-4">
                    {/* Tu icono personalizado sin fondo */}
                    <img 
                        src="/cirujano.png" 
                        alt="Logo cirujano" 
                        className="w-20 h-20 object-contain"
                    />
                </div>
                
                <p className="mt-4 text-center text-lg text-blue-200 font-semibold">
                    Damián Colomb
                </p>
                <p className="mt-1 text-center text-sm text-blue-300">
                    Cirugía General
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-[#0b1625] border border-blue-500/30 py-8 px-4 shadow-2xl sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-white">
                                Contraseña
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 pr-10 border border-blue-400/50 bg-[#050b16] text-white rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="Ingresa la contraseña"
                                />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center bg-transparent border-none outline-none hover:bg-transparent focus:bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                                            ) : (
                                                <EyeIcon className="h-4 w-4 text-gray-400" />
                                            )}
                                        </button>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {loading ? (
                                    <div className="flex items-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Iniciando sesión...
                                    </div>
                                ) : (
                                    'Iniciar Sesión'
                                )}
                            </button>
                        </div>
                    </form>

                </div>
            </div>
        </div>
    );
}
