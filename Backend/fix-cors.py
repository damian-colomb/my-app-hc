#!/usr/bin/env python3
"""
Script para configurar CORS temporalmente en Railway
"""
import os

# Configurar variable de entorno para CORS más permisivo
os.environ["DEBUG_CORS"] = "true"
os.environ["FRONTEND_ORIGINS"] = "https://*.vercel.app,https://hc-damian.vercel.app"

print("🔧 Configuración de CORS aplicada:")
print(f"DEBUG_CORS: {os.environ.get('DEBUG_CORS')}")
print(f"FRONTEND_ORIGINS: {os.environ.get('FRONTEND_ORIGINS')}")
print("✅ Variables configuradas para Railway")
