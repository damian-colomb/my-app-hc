#!/usr/bin/env python3
"""
Script para inicializar la tabla de login en la base de datos
"""
import os
from sqlalchemy import text
from database import engine, SessionLocal
from models_login import LoginCredentials, Base

def init_login_table():
    """Crear tabla de login e insertar credencial inicial"""
    print("🔧 Inicializando tabla de login...")
    
    try:
        # Crear la tabla
        Base.metadata.create_all(bind=engine)
        print("✅ Tabla login_credentials creada")
        
        # Verificar si ya existe una credencial
        db = SessionLocal()
        existing = db.query(LoginCredentials).filter(
            LoginCredentials.is_active == True
        ).first()
        
        if existing:
            print(f"✅ Ya existe una credencial activa: {existing.username}")
        else:
            # Crear credencial inicial
            initial_credential = LoginCredentials(
                username="admin",
                password_hash="hospital2024",
                is_active=True
            )
            db.add(initial_credential)
            db.commit()
            print("✅ Credencial inicial creada: admin / hospital2024")
        
        db.close()
        print("🎉 Inicialización completada")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    init_login_table()
