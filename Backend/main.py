# -*- coding: utf-8 -*-
"""
main.py
Punto de entrada ASGI de FastAPI para la app clínica.

Ordenado y comentado:
- Carga de .env
- App + CORS
- Sesión DB y helpers
- Supabase (opcional)
- Bootstrap de tablas y ping a DB
- Registro de Routers
- Endpoints de health
"""

from dotenv import load_dotenv
load_dotenv()

import os
import logging
import time
from datetime import datetime
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
# from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session as _Session
from collections import defaultdict


from database import engine, SessionLocal, Base

# ----------------------------
# CONFIGURACIÓN DE LOGGING
# ----------------------------
# Configurar logging estructurado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)

logger = logging.getLogger(__name__)

# ----------------------------
# Routers
# ----------------------------
from routers import (
    BasesSelect,                 # /bases/*
    pacientes,                   # /pacientes/*
    derivadores,                 # /derivadores/*
    turnos,                      # /turnos/*
    antecedentes,                # /antecedentes/*
    consultas,                   # /consultas/*
    evoluciones,                 # /evoluciones/*
    interconsultas,              # /interconsultas/*
    examenes_complementarios,    # /examenes/*
    procedimientos,              # /procedimientos/*
    patologia,                   # /patologias/*
    profesionales,               # /profesionales/*
    protocolos_cx,               # /partes/* y /catalogos/*
    pdf_cx,                     # /pdf/*
    pdf_hc,                     # /pdf/* (historia clínica)
    auth,                       # /auth/* (autenticación)
)

from routers import codigos_facturacion   # /facturacion/*
from routers import procedimientosFotosCx   # /procedimientos/*/fotos

from routers.PlantillasTecnicas import router_catalogos as plantillas_tecnicas_router  # /plantillas/*
# from routers.PlantillasTecnicasSimple import router_simple as plantillas_tecnicas_router  # /plantillas/*


# ----------------------------
# FastAPI app (ASGI export)
# ----------------------------
app = FastAPI(title="Backend Clínica", version="1.0.0")

# ----------------------------
# CORS SEGURO
# ----------------------------
# Configuración base de orígenes
origins = []

# Orígenes de desarrollo
if os.getenv("ENV", "prod").lower() == "dev":
    origins.extend([
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ])

# Para desarrollo local, agregar localhost dinámicamente
import socket
try:
    # Detectar si estamos en localhost
    hostname = socket.gethostname()
    if hostname == "localhost" or "127.0.0.1" in str(socket.gethostbyname(hostname)):
        origins.extend([
            "http://localhost:3000",
            "http://127.0.0.1:3000", 
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://localhost:5176",
            "http://127.0.0.1:5176"
        ])
except:
    # Force redeploy - $(date)
    pass

# Orígenes de producción - Solo el dominio principal
if os.getenv("ENV", "prod").lower() == "prod":
    origins.extend([
        "https://hc-damian.vercel.app"
    ])

# Agregar orígenes adicionales desde variable de entorno si existen
_frontends = os.getenv("FRONTEND_ORIGINS", "")
if _frontends:
    additional_origins = [o.strip() for o in _frontends.split(",") if o.strip()]
    origins.extend(additional_origins)

# CORS SEGURO - Solo métodos y headers necesarios
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,  # Cambiado a False - no necesitamos cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
)

# ----------------------------
# MIDDLEWARE DE SEGURIDAD
# ----------------------------

# 1. GZIP Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. Trusted Host (completamente eliminado)
# logger.info("TrustedHostMiddleware deshabilitado completamente")

# Configuración para Render
logger.info("Render configurado - CORS manejado en sección principal")

# 3. Rate Limiting básico
rate_limit_storage = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    client_ip = request.client.host
    now = time.time()
    
    # Limpiar requests antiguos (últimos 60 segundos)
    rate_limit_storage[client_ip] = [
        req_time for req_time in rate_limit_storage[client_ip] 
        if now - req_time < 60
    ]
    
    # Verificar límite (100 requests por minuto)
    if len(rate_limit_storage[client_ip]) >= 100:
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(
            status_code=429, 
            content={"detail": "Rate limit exceeded"}
        )
    
    # Agregar request actual
    rate_limit_storage[client_ip].append(now)
    
    response = await call_next(request)
    return response

# Middleware de logging de requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log del request
    logger.info(f"Request: {request.method} {request.url.path} from {request.client.host}")
    
    # Procesar request
    response = await call_next(request)
    
    # Calcular tiempo de procesamiento
    process_time = time.time() - start_time
    
    # Log de la respuesta
    logger.info(f"Response: {response.status_code} in {process_time:.3f}s")
    
    # Agregar header de tiempo de procesamiento
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

# ----------------------------
# DB dependency
# ----------------------------
def get_db():
    """
    Dependency de sesión de DB para inyectar en endpoints.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------------------
# Supabase (opcional, seguro)
# ----------------------------
try:
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Faltan SUPABASE_URL/SUPABASE_KEY")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("🧰 Supabase OK")
except Exception as e:
    supabase = None
    print(f"⚠️ Supabase no inicializado: {e}")

# ----------------------------
# Bootstrap de DB
# ----------------------------
try:
    with engine.begin() as conn:
        # Crea/actualiza metadatos de SQLAlchemy si existen modelos declarativos
        Base.metadata.create_all(conn)
        # Ping simple
        conn.execute(text("SELECT 1"))
    print("📦 Tablas OK")
except Exception as e:
    print(f"⚠️ Error al crear/verificar tablas: {e}")

# ----------------------------
# Registro de Routers
# ----------------------------
# Nota: algunos routers ya definen sus propios prefijos.
# Mantenemos lo que venía funcionando antes.

app.include_router(pacientes.router)  # /pacientes/*
app.include_router(derivadores.router)
app.include_router(turnos.router)
app.include_router(BasesSelect.router)  # /bases/*
app.include_router(antecedentes.router)
app.include_router(consultas.router, prefix="/consultas", tags=["Consultas"])
app.include_router(evoluciones.router)
app.include_router(examenes_complementarios.router)  # /examenes/*
app.include_router(interconsultas.router, prefix="/interconsultas", tags=["interconsultas"])
app.include_router(procedimientos.router)
app.include_router(procedimientosFotosCx.router)
app.include_router(codigos_facturacion.router, prefix="/facturacion", tags=["Códigos Facturación"])
app.include_router(patologia.router)
app.include_router(profesionales.router, tags=["Profesionales"])
# Protocolos/Partes Quirúrgicos + catálogos propios
app.include_router(protocolos_cx.router)             # /partes/*
app.include_router(protocolos_cx.router_cx)          # alias /protocolos_cx/*
app.include_router(protocolos_cx.router_catalogos)   # /catalogos/* (otros catálogos)
app.include_router(plantillas_tecnicas_router)      # /catalogos/plantillas_tecnicas_cx/*

# Debug endpoint para verificar si el router está montado
@app.get("/debug/plantillas")
def debug_plantillas():
    return {
        "message": "Router plantillas montado correctamente", 
        "router_prefix": "/plantillas",
        "available_routes": [
            "/plantillas/test",
            "/plantillas/plantillas_tecnicas_cx"
        ]
    }
app.include_router(pdf_cx.router)          # /pdf/*
app.include_router(pdf_hc.router)          # /pdf/* (historia clínica)

# Autenticación
app.include_router(auth.router)           # /auth/*

# ----------------------------
# Health & Debug
# ----------------------------
@app.get("/__up")
def __up():
    return {"ok": True}

@app.get("/test")
def test():
    return {"message": "🚀 BACKEND COMPLETAMENTE REINICIADO - VERSION 4.0 - SIN CACHE - PLANTILLAS FUNCIONANDO"}

@app.get("/cors-debug")
def cors_debug():
    """Endpoint para debug de CORS - muestra orígenes permitidos"""
    return {
        "allowed_origins": origins,
        "environment": os.getenv("ENV", "prod"),
        "render_env": os.getenv("ENV"),
        "frontend_origins_env": os.getenv("FRONTEND_ORIGINS", "No configurado")
    }

@app.get("/health/db")
def health_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"db": "ok"}
    except Exception as e:
        return {"db": "error", "detail": str(e)}

@app.get("/health/storage")
def health_storage():
    if not supabase:
        return {"storage": "error", "detail": "Supabase no inicializado"}
    try:
        buckets = supabase.storage.list_buckets()
        # Nota: list_buckets devuelve objetos; los serializamos light
        return {"storage": "ok", "buckets": buckets}
    except Exception as e:
        return {"storage": "error", "detail": str(e)}

@app.get("/health/metrics")
def health_metrics():
    """Endpoint de métricas para monitoreo"""
    try:
        # Métricas básicas del sistema
        import psutil
        
        return {
            "timestamp": datetime.now().isoformat(),
            "system": {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": psutil.disk_usage('/').percent
            },
            "app": {
                "rate_limit_ips": len(rate_limit_storage),
                "total_requests": sum(len(requests) for requests in rate_limit_storage.values())
            }
        }
    except ImportError:
        return {"error": "psutil not installed"}
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        return {"error": str(e)}

@app.get("/health/logs")
def health_logs():
    """Endpoint para ver logs recientes"""
    try:
        if os.path.exists('app.log'):
            with open('app.log', 'r') as f:
                lines = f.readlines()
                # Últimas 50 líneas
                recent_logs = lines[-50:] if len(lines) > 50 else lines
                return {"logs": recent_logs}
        else:
            return {"logs": "No log file found"}
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        return {"error": str(e)}

# Export explícito (útil para import de uvicorn/gunicorn)
__all__ = ["app", "supabase", "get_db"]# Force redeploy Tue Sep 30 11:45:47 -03 2025
