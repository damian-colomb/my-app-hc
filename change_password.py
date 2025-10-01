#!/usr/bin/env python3
"""
Script para cambiar la contraseña del sistema de login
"""
import requests
import sys

def change_password(new_password):
    """Cambiar la contraseña del sistema"""
    try:
        # URL del endpoint
        url = "http://localhost:8000/auth/credentials"
        
        # Hacer la petición
        response = requests.put(url, params={"new_password": new_password})
        
        if response.status_code == 200:
            print(f"✅ Contraseña cambiada exitosamente a: {new_password}")
            print(f"   La contraseña se guardó en la tabla 'login' con id_clave=1")
            return True
        else:
            print(f"❌ Error: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: No se puede conectar al servidor. Asegúrate de que el backend esté ejecutándose.")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return False

def get_current_credentials():
    """Obtener información de las credenciales actuales"""
    try:
        url = "http://localhost:8000/auth/credentials"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print(f"📋 Credenciales actuales:")
            print(f"   Usuario: {data.get('username', 'N/A')}")
            print(f"   Activo: {data.get('is_active', 'N/A')}")
            print(f"   Creado: {data.get('created_at', 'N/A')}")
        else:
            print(f"❌ Error al obtener credenciales: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: No se puede conectar al servidor.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🔐 Gestor de Contraseñas del Sistema")
    print("=" * 40)
    
    if len(sys.argv) > 1:
        # Contraseña proporcionada como argumento
        new_password = sys.argv[1]
        change_password(new_password)
    else:
        # Modo interactivo
        print("\nOpciones:")
        print("1. Ver credenciales actuales")
        print("2. Cambiar contraseña")
        print("3. Salir")
        
        while True:
            choice = input("\nSelecciona una opción (1-3): ").strip()
            
            if choice == "1":
                get_current_credentials()
            elif choice == "2":
                new_password = input("Ingresa la nueva contraseña: ").strip()
                if new_password:
                    change_password(new_password)
                else:
                    print("❌ La contraseña no puede estar vacía")
            elif choice == "3":
                print("👋 ¡Hasta luego!")
                break
            else:
                print("❌ Opción inválida")
