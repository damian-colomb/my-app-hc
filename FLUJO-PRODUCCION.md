# 🚀 Flujo de Trabajo para Producción

## 📋 Resumen del Sistema

- **Backend**: Render (https://endoscopia-backend-production.onrender.com)
- **Frontend**: Vercel (https://hc-damian.vercel.app)
- **Base de datos**: Neon DB
- **Repositorio**: GitHub (fuente única)

## 🔄 Flujo Automático

### ✅ Lo que Pasa Automáticamente:

1. **Haces `git push`** → GitHub recibe los cambios
2. **Render detecta cambios** → Redesplega el backend automáticamente
3. **Vercel detecta cambios** → Redesplega el frontend automáticamente
4. **Todo funciona** sin intervención manual

## 🛠️ Scripts Disponibles

### 1. Deploy Completo
```bash
./deploy-production.sh
```
**Usar cuando:**
- Cambias backend Y frontend
- Cambias configuración
- Primera vez o cambios importantes

### 2. Deploy Rápido (Solo Frontend)
```bash
./deploy-frontend.sh
```
**Usar cuando:**
- Solo cambias código del frontend
- Cambios de UI/UX
- Correcciones menores

## 📝 Proceso Manual (Si Necesitas)

### Para Cambios en Backend:
1. Edita archivos en `Backend/`
2. `git add . && git commit -m "Descripción" && git push`
3. Render redesplegará automáticamente

### Para Cambios en Frontend:
1. Edita archivos en `Frontend/endoscopia-app/src/`
2. `cd Frontend/endoscopia-app && npm run build`
3. `git add . && git commit -m "Frontend update" && git push`
4. Vercel redesplegará automáticamente

## 🔍 Verificación

### URLs de Producción:
- **Frontend**: https://hc-damian.vercel.app
- **Backend**: https://endoscopia-backend-production.onrender.com
- **Test Backend**: https://endoscopia-backend-production.onrender.com/test
- **Plantillas**: https://endoscopia-backend-production.onrender.com/plantillas/plantillas_tecnicas_cx

### Cómo Verificar que Funciona:
1. Abre https://hc-damian.vercel.app
2. Abre consola del navegador (F12)
3. Busca errores de CORS o URLs incorrectas
4. Debería cargar pacientes sin problemas

## ⚡ Tips para Desarrollo Rápido

### Cambios Rápidos:
```bash
# Solo frontend
./deploy-frontend.sh

# Todo
./deploy-production.sh

# Verificar que funcionó
./verify-deploy.sh
```

## 🚫 Anti-Caché (MUY IMPORTANTE)

### ✅ Configurado Automáticamente:
- **Vite**: Genera nombres únicos para archivos (hash)
- **Vercel**: Headers anti-caché configurados
- **Scripts**: Limpian build anterior automáticamente

### 🔍 Cómo Verificar que No Hay Caché:
1. **Después de cada deploy**: Usa `./verify-deploy.sh`
2. **En el navegador**: Presiona **Ctrl+F5** (forzar recarga)
3. **En consola**: Busca que use `onrender.com`, no `up.railway.app`

### ⚠️ Si Ves Problemas de Caché:
```bash
# Forzar redeploy completo
./deploy-production.sh

# Verificar
./verify-deploy.sh
```

### Verificar Estado:
```bash
# Backend
curl https://endoscopia-backend-production.onrender.com/test

# Plantillas
curl https://endoscopia-backend-production.onrender.com/plantillas/plantillas_tecnicas_cx
```

## 🚨 Solución de Problemas

### Si el Frontend No Se Actualiza:
1. Espera 3-5 minutos
2. Recarga con Ctrl+F5 (forzar caché)
3. Verifica en Vercel dashboard

### Si el Backend No Se Actualiza:
1. Verifica logs en Render dashboard
2. Espera 2-3 minutos
3. Prueba el endpoint `/test`

### Si Hay Errores de CORS:
1. Verifica que el frontend use `onrender.com`
2. No `up.railway.app`
3. Recompila el frontend si es necesario

## 📊 Monitoreo

### Logs de Render:
- Ve a tu proyecto en Render
- Click en "Logs" para ver errores

### Logs de Vercel:
- Ve a tu proyecto en Vercel
- Click en "Functions" → "View Logs"

### Estado del Sistema:
- Backend: https://endoscopia-backend-production.onrender.com/test
- Frontend: https://hc-damian.vercel.app
