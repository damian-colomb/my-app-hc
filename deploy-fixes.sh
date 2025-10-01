#!/bin/bash

# Script para deployar las correcciones
echo "🚀 Deployando correcciones de producción..."

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar éxito
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Función para mostrar error
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Función para mostrar advertencia
warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Función para mostrar info
info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

echo "📋 Resumen de correcciones aplicadas:"
echo "  1. ✅ Corregido error 'Can't find variable: API_BASE'"
echo "  2. ✅ Mejorada configuración de CORS"
echo "  3. ✅ Corregidas URLs de producción"
echo "  4. ✅ Verificadas variables de entorno"
echo ""

echo "🚀 Iniciando deploy..."

# 1. Deploy del Backend
echo "1. Deployando Backend a Railway..."
cd Backend

if [ -f "deploy-railway.sh" ]; then
    info "Ejecutando deploy-railway.sh..."
    ./deploy-railway.sh
    if [ $? -eq 0 ]; then
        success "Backend deployado correctamente"
    else
        error "Error en deploy del backend"
        exit 1
    fi
else
    error "Script deploy-railway.sh no encontrado"
    exit 1
fi

cd ..

# 2. Deploy del Frontend
echo "2. Deployando Frontend a Vercel..."
cd Frontend/endoscopia-app

if [ -f "deploy-vercel-fix.sh" ]; then
    info "Ejecutando deploy-vercel-fix.sh..."
    ./deploy-vercel-fix.sh
    if [ $? -eq 0 ]; then
        success "Frontend deployado correctamente"
    else
        error "Error en deploy del frontend"
        exit 1
    fi
else
    error "Script deploy-vercel-fix.sh no encontrado"
    exit 1
fi

cd ../..

echo ""
echo "🎉 Deploy completado!"
echo ""
echo "🔍 Verificando deployment..."

# Esperar un poco para que los servicios se activen
info "Esperando 30 segundos para que los servicios se activen..."
sleep 30

# Verificar backend
echo "Verificando backend..."
if curl -s "https://endoscopia-backend-production.up.railway.app/__up" | grep -q "ok"; then
    success "Backend funcionando"
else
    error "Backend no responde"
fi

# Verificar frontend
echo "Verificando frontend..."
if curl -s -I "https://hc-damian.vercel.app" | grep -q "200 OK"; then
    success "Frontend funcionando"
else
    error "Frontend no responde"
fi

echo ""
echo "🎯 URLs de producción:"
echo "  🌐 Frontend: https://hc-damian.vercel.app"
echo "  🚂 Backend: https://endoscopia-backend-production.up.railway.app"
echo "  🔍 CORS Debug: https://endoscopia-backend-production.up.railway.app/cors-debug"
echo ""
echo "📝 Próximos pasos:"
echo "  1. Abre https://hc-damian.vercel.app"
echo "  2. Abre la consola del navegador (F12)"
echo "  3. Verifica que no haya errores de 'API_BASE'"
echo "  4. Prueba hacer login"
echo "  5. Prueba cargar datos (pacientes, coberturas, etc.)"
echo ""
echo "🆘 Si hay problemas:"
echo "  - Revisa los logs en Railway y Vercel"
echo "  - Usa el endpoint de CORS debug"
echo "  - Verifica las variables de entorno"
