import React from 'react';
import { useAuth } from '../hooks/useAuth';
import Login from './Login';

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) {
        return <Login onLogin={(user) => window.location.reload()} />;
    }

    return children;
}
