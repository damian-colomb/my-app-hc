# 🚀 Guía de Deployment - App Clínica

## 📋 Resumen de la Aplicación

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Base de datos**: PostgreSQL (Neon)

## 🎯 Opciones de Deployment

### Opción 1: Railway (Recomendado) - Todo en uno

#### Backend en Railway:
1. Ve a [railway.app](https://railway.app)
2. Conecta tu repositorio de GitHub
3. Railway detectará automáticamente el `railway.json`
4. Configura las variables de entorno:
   - `DATABASE_URL`: Tu URL de Neon
   - `ENV`: `prod`
   - `FRONTEND_ORIGINS`: URL de tu frontend

#### Frontend en Vercel:
1. Ve a [vercel.com](https://vercel.com)
2. Conecta tu repositorio
3. Configura el directorio: `Frontend/endoscopia-app`
4. Agrega variable de entorno:
   - `VITE_API_BASE_URL`: URL de tu backend en Railway

### Opción 2: Render (Gratuito)

#### Backend en Render:
1. Ve a [render.com](https://render.com)
2. Crea un nuevo "Web Service"
3. Conecta tu repositorio
4. Configura:
   - Build Command: `cd Backend && pip install -r requirements.txt`
   - Start Command: `cd Backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

#### Frontend en Render:
1. Crea un nuevo "Static Site"
2. Configura:
   - Build Command: `cd Frontend/endoscopia-app && npm install && npm run build`
   - Publish Directory: `Frontend/endoscopia-app/dist`

## 🔧 Configuración de Variables de Entorno

### Backend:
```bash
DATABASE_URL=postgresql://usuario:password@host:puerto/database
ENV=prod
FRONTEND_ORIGINS=https://tu-frontend.vercel.app
```

### Frontend:
```bash
VITE_API_BASE_URL=https://tu-backend.railway.app
```

## 📁 Archivos Creados para Deployment

- `Backend/requirements.txt` - Dependencias de Python
- `Backend/Dockerfile` - Configuración de Docker
- `railway.json` - Configuración de Railway
- `vercel.json` - Configuración de Vercel
- `env.example` - Ejemplo de variables de entorno

## 🚀 Pasos para Deploy

### 1. Preparar el repositorio:
```bash
# Asegúrate de que todos los archivos estén en tu repositorio
git add .
git commit -m "Preparar para deployment"
git push origin main
```

### 2. Deploy Backend (Railway):
1. Ve a railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repositorio
4. Railway detectará automáticamente la configuración
5. Agrega las variables de entorno
6. Deploy!

### 3. Deploy Frontend (Vercel):
1. Ve a vercel.com
2. "New Project" → Importar desde GitHub
3. Selecciona tu repositorio
4. Configura:
   - Root Directory: `Frontend/endoscopia-app`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Agrega la variable `VITE_API_BASE_URL` con la URL de tu backend
6. Deploy!

## 🔍 Verificación

Después del deploy, verifica:
- Backend: `https://tu-backend.railway.app/__up`
- Frontend: Debería cargar correctamente
- API: El frontend debería poder hacer requests al backend

## 🆘 Troubleshooting

### Si el backend no conecta a la DB:
- Verifica que `DATABASE_URL` esté correcta
- Asegúrate de que la DB de Neon esté activa

### Si el frontend no conecta al backend:
- Verifica `VITE_API_BASE_URL`
- Revisa los CORS en el backend
- Verifica que `FRONTEND_ORIGINS` incluya tu dominio de Vercel

### Logs:
- Railway: Ve a tu proyecto → "Deployments" → Click en el deployment → "View Logs"
- Vercel: Ve a tu proyecto → "Functions" → "View Function Logs"
