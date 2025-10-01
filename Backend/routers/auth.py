from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
from models_login_neon import LoginNeon
from password_utils import hash_password, verify_password, is_hashed

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()

# Modelos
class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    token: str
    user: dict

# Función para obtener sesión de base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Configuración JWT
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "tu_clave_secreta_muy_larga_y_segura_para_produccion")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

def create_token(username: str) -> str:
    """Crear token JWT"""
    payload = {
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verificar token JWT"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("username")
        if username is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return {"username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Endpoint de login"""
    password = request.password
    
    # Buscar credenciales en la tabla login de Neon (Id_clave = 1)
    credentials = db.query(LoginNeon).filter(
        LoginNeon.Id_clave == 1
    ).first()
    
    if not credentials:
        raise HTTPException(status_code=401, detail="No hay credenciales configuradas")
    
    # Verificar contraseña (compatible con texto plano y hashed)
    if is_hashed(credentials.clave):
        # Contraseña ya está encriptada
        if not verify_password(password, credentials.clave):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    else:
        # Contraseña en texto plano (migración automática)
        if credentials.clave != password:
            raise HTTPException(status_code=401, detail="Contraseña incorrecta")
        # Migrar a hashed automáticamente
        credentials.clave = hash_password(password)
        db.commit()
    
    # Crear token
    token = create_token("admin")
    
    # Información del usuario
    user_info = {
        "id": credentials.Id_clave,
        "username": "admin",
        "name": "Damián Colomb",
        "role": "admin"
    }
    
    return LoginResponse(token=token, user=user_info)

@router.get("/verify")
def verify_auth(current_user: dict = Depends(verify_token)):
    """Verificar autenticación"""
    return {"authenticated": True, "user": current_user}

# Endpoints para gestión de credenciales
@router.get("/credentials")
def get_credentials(db: Session = Depends(get_db)):
    """Obtener credenciales (solo para administración)"""
    credentials = db.query(LoginNeon).filter(
        LoginNeon.Id_clave == 1
    ).first()
    
    if not credentials:
        return {"message": "No hay credenciales configuradas"}
    
    return {
        "id": credentials.Id_clave,
        "clave": "***" + credentials.clave[-3:] if len(credentials.clave) > 3 else "***"
    }

@router.put("/credentials")
def update_password(new_password: str, db: Session = Depends(get_db)):
    """Actualizar contraseña"""
    credentials = db.query(LoginNeon).filter(
        LoginNeon.Id_clave == 1
    ).first()
    
    if not credentials:
        raise HTTPException(status_code=404, detail="No hay credenciales configuradas")
    
    credentials.clave = hash_password(new_password)
    db.commit()
    
    return {"message": "Contraseña actualizada correctamente"}

@router.post("/reset-password")
def reset_password(password: str, db: Session = Depends(get_db)):
    """Reset password endpoint (temporary, no auth required)"""
    # Verificar si ya existe
    existing = db.query(LoginNeon).filter(
        LoginNeon.Id_clave == 1
    ).first()
    
    if existing:
        # Actualizar contraseña existente
        existing.clave = hash_password(password)
        db.commit()
        return {"message": f"Contraseña actualizada a: {password}"}
    else:
        # Crear nueva credencial
        new_credentials = LoginNeon(
            Id_clave=1,
            clave=hash_password(password)
        )
        db.add(new_credentials)
        db.commit()
        return {"message": f"Credenciales creadas con contraseña: {password}"}

@router.post("/clear-test-data")
def clear_test_data(db: Session = Depends(get_db)):
    """Limpiar datos de prueba (temporary, no auth required)"""
    try:
        # Importar el modelo de pacientes
        from models import Paciente
        
        # Eliminar todos los pacientes
        db.query(Paciente).delete()
        db.commit()
        
        return {"message": "Datos de prueba eliminados correctamente. La base de datos está lista para pacientes reales."}
    except Exception as e:
        return {"error": f"Error al limpiar datos: {str(e)}"}

@router.post("/credentials")
def create_credentials(password: str, db: Session = Depends(get_db)):
    """Crear nuevas credenciales (solo contraseña)"""
    # Verificar si ya existe
    existing = db.query(LoginNeon).filter(
        LoginNeon.Id_clave == 1
    ).first()
    
    if existing:
        # Actualizar contraseña existente
        existing.clave = hash_password(password)
        db.commit()
        return {"message": "Contraseña actualizada correctamente"}
    else:
        # Crear nueva credencial
        new_credentials = LoginNeon(
            Id_clave=1,
            clave=hash_password(password)
        )
        db.add(new_credentials)
        db.commit()
        return {"message": "Credenciales creadas correctamente"}
