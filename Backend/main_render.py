#!/usr/bin/env python3
"""
main_render.py
Versión simplificada para Render
"""

import os
import sys
from pathlib import Path

# Agregar el directorio actual al path
sys.path.insert(0, str(Path(__file__).parent))

# Importar la aplicación principal
from main import app

if __name__ == "__main__":
    import uvicorn
    
    # Obtener el puerto de la variable de entorno
    port = int(os.environ.get("PORT", 8000))
    
    # Ejecutar la aplicación
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
