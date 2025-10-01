// Importamos los componentes de rutas desde react-router-dom
import { Routes, Route } from "react-router-dom";

// Importamos las vistas/páginas que vamos a renderizar en cada ruta
import MenuPrincipal from "./pages/MenuPrincipal";
import PanelEstadistica from "./pages/PanelEstadistica";
import PanelCirugia from "./pages/PanelCirugia";
import PanelEndoscopia from "./pages/PanelEndoscopia";
import PanelPacientes from "./pages/PanelPacientes";
import PanelHistoriaClinica from "./pages/PanelHistoriaClinica";
import PanelTurnos from "./pages/PanelTurnos";
import PartesQuirurgicos from "./pages/Modulos/PartesQuirurgicos";

// Importamos el componente de protección de rutas
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
    return (
        // Fondo oscuro, texto blanco y padding general de la app
        <div className="min-h-screen bg-[#0b1625] text-white p-6">
            {/* Configuración de rutas protegidas */}
            <Routes>
                <Route path="/" element={
                    <ProtectedRoute>
                        <MenuPrincipal />
                    </ProtectedRoute>
                } />
                <Route path="/estadistica" element={
                    <ProtectedRoute>
                        <PanelEstadistica />
                    </ProtectedRoute>
                } />
                <Route path="/cirugia" element={
                    <ProtectedRoute>
                        <PanelCirugia />
                    </ProtectedRoute>
                } />
                <Route path="/endoscopia" element={
                    <ProtectedRoute>
                        <PanelEndoscopia />
                    </ProtectedRoute>
                } />
                <Route path="/pacientes" element={
                    <ProtectedRoute>
                        <PanelPacientes />
                    </ProtectedRoute>
                } />
                <Route path="/hc" element={
                    <ProtectedRoute>
                        <PanelHistoriaClinica />
                    </ProtectedRoute>
                } />
                <Route path="/turnos" element={
                    <ProtectedRoute>
                        <PanelTurnos />
                    </ProtectedRoute>
                } />
                <Route path="/partes/:id_pp" element={
                    <ProtectedRoute>
                        <PartesQuirurgicos />
                    </ProtectedRoute>
                } />
            </Routes>
        </div>
    );
}

export default App;
