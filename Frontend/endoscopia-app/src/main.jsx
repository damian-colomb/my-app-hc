import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import './index.css';

// Importante: agregás BrowserRouter para manejar rutas
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
);// Force Vercel redeploy - Tue Sep 30 12:05:39 -03 2025
// Force cache bust Tue Sep 30 16:33:33 -03 2025
// Force Vercel cache refresh Tue Sep 30 17:48:17 -03 2025
/* VERCEL_FORCE_REDEPLOY_1759327343 */
