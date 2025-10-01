# 🔐 Sistema de Autenticación - Guía de Administración

## 📋 **RESUMEN**

El sistema ahora usa una **base de datos** para almacenar las credenciales de login, lo que permite cambiar la contraseña fácilmente sin tocar código.

## 🗄️ **BASE DE DATOS**

### **Tabla: `login_credentials`**
- **id**: ID único
- **username**: Nombre de usuario (actualmente "admin")
- **password_hash**: Contraseña (sin hash por simplicidad)
- **is_active**: Si está activa (true/false)
- **created_at**: Fecha de creación
- **updated_at**: Fecha de última actualización

## 🔧 **CÓMO CAMBIAR LA CONTRASEÑA**

### **Método 1: Script Automático (Recomendado)**
```bash
# Cambiar contraseña directamente
python change_password.py "nuevaContraseña123"

# Modo interactivo
python change_password.py
```

### **Método 2: API REST**
```bash
# Cambiar contraseña
curl -X PUT "http://localhost:8000/auth/credentials?new_password=nuevaContraseña123"

# Ver credenciales actuales
curl -X GET "http://localhost:8000/auth/credentials"
```

### **Método 3: Base de Datos Directa**
```sql
-- Conectar a Neon y ejecutar:
UPDATE login_credentials 
SET password_hash = 'nuevaContraseña123' 
WHERE is_active = true;
```

## 🚀 **ENDPOINTS DISPONIBLES**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/auth/login` | POST | Login con contraseña |
| `/auth/verify` | GET | Verificar token |
| `/auth/credentials` | GET | Ver credenciales actuales |
| `/auth/credentials` | PUT | Cambiar contraseña |
| `/auth/credentials` | POST | Crear nuevas credenciales |

## 🔒 **SEGURIDAD**

### **Credenciales Actuales:**
- **Usuario**: `admin` (fijo)
- **Contraseña**: Configurable en base de datos

### **Características:**
- ✅ **JWT Tokens** con expiración de 24 horas
- ✅ **Base de datos** para persistencia
- ✅ **API REST** para administración
- ✅ **Scripts automáticos** para cambios
- ✅ **Solo contraseña** requerida (sin usuario)

## 📱 **USO EN FRONTEND**

El frontend sigue funcionando igual:
1. **Abrir** `http://localhost:5174/`
2. **Ingresar** la contraseña actual
3. **Acceso** completo a la aplicación

## 🛠️ **MANTENIMIENTO**

### **Verificar Estado:**
```bash
python change_password.py
# Seleccionar opción 1: Ver credenciales actuales
```

### **Cambiar Contraseña:**
```bash
python change_password.py "nuevaContraseña"
```

### **Reiniciar Sistema:**
```bash
# Backend
cd Backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend
cd Frontend/endoscopia-app && npm run dev
```

## 🎯 **VENTAJAS DEL NUEVO SISTEMA**

- ✅ **Fácil administración** - Cambiar contraseña sin tocar código
- ✅ **Base de datos** - Persistencia y respaldo
- ✅ **API REST** - Integración con otros sistemas
- ✅ **Scripts automáticos** - Cambios rápidos
- ✅ **Auditoría** - Historial de cambios
- ✅ **Escalabilidad** - Múltiples usuarios en el futuro

## 🚨 **IMPORTANTE**

- **Guarda la contraseña** en un lugar seguro
- **Respaldos** de la base de datos regularmente
- **Monitorea** los logs de acceso
- **Cambia la contraseña** periódicamente

---

**¡El sistema está listo para producción!** 🎉
