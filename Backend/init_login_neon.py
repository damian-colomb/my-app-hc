#!/usr/bin/env python3
"""
Script para inicializar la tabla login en Neon
"""
import os
from sqlalchemy import text
from database import engine, SessionLocal
from models_login_neon import LoginNeon, Base

def init_login_neon():
    """Crear tabla login e insertar credencial inicial"""
    print("🔧 Inicializando tabla login en Neon...")
    
    try:
        # Crear la tabla si no existe
        Base.metadata.create_all(bind=engine)
        print("✅ Tabla login creada/verificada")
        
        # Verificar si ya existe una credencial
        db = SessionLocal()
        existing = db.query(LoginNeon).filter(
            LoginNeon.Id_clave == 1
        ).first()
        
        if existing:
            print(f"✅ Ya existe una credencial con Id_clave=1")
            print(f"   Contraseña actual: {existing.clave}")
        else:
            # Crear credencial inicial
            initial_credential = LoginNeon(
                Id_clave=1,
                clave="hospital2024"  # Contraseña inicial
            )
            db.add(initial_credential)
            db.commit()
            print("✅ Credencial inicial creada: Id_clave=1, clave=hospital2024")
        
        db.close()
        print("🎉 Inicialización completada")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    init_login_neon()
