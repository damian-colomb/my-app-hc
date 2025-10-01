# Importamos los módulos necesarios de SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Cargar variables de entorno desde .env si existe
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# --- Config de URLs SEGURA ---
# Variables de entorno opcionales:
#   ENV=dev            -> usa base local
#   DATABASE_URL       -> URL de Neon (o remota)
#   DATABASE_URL_LOCAL -> URL local para desarrollo
ENV = os.getenv("ENV", "prod").lower()

# NUNCA hardcodear credenciales en producción
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Solo usar local en desarrollo
if ENV == "dev":
    DATABASE_URL_LOCAL = os.getenv("DATABASE_URL_LOCAL")
    if DATABASE_URL_LOCAL:
        DATABASE_URL = DATABASE_URL_LOCAL

# --- Conexión robusta ---
# Armamos connect_args con keepalives y timeout. Agregamos sslmode=require sólo si no está en la URL
connect_args = {
    "connect_timeout": 5,
    # keepalives para conexiones inestables (Neon que despierta, etc.)
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 5,
}

# Si no es entorno dev y la URL no incluye sslmode, lo forzamos
if ENV != "dev" and "sslmode=" not in DATABASE_URL:
    connect_args["sslmode"] = "require"

# Creamos el motor de conexión (engine)
# pool_pre_ping=True: chequear conexión antes de usarla para evitar cuelgues
# Configuración optimizada para producción
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=3,  # Reducido para producción
    max_overflow=5,  # Reducido
    pool_recycle=300,  # 5 minutos
    connect_args=connect_args,
    echo=False,
)

# Creamos una clase SessionLocal que usaremos para interactuar con la DB
# `autocommit=False`: no confirma automáticamente los cambios (hay que hacer .commit())
# `autoflush=False`: no sincroniza automáticamente los objetos con la DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base: clase base de la que heredan todos los modelos de SQLAlchemy
# Esto permite que las clases se comporten como tablas
Base = declarative_base()

# Dependencia para FastAPI: se encarga de abrir y cerrar la sesión de DB por cada request
# `yield` permite que el código del endpoint se ejecute con la DB abierta
# `finally`: asegura que se cierre la conexión después de usarla

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()