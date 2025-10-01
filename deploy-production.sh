#!/bin/bash

# Script para deploy completo a producción
# Backend: Render (automático)
# Frontend: Vercel (automático)

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de logging
log() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 DEPLOY COMPLETO A PRODUCCIÓN"
echo "================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -d "Backend" ] || [ ! -d "Frontend" ]; then
    error "No estás en el directorio raíz del proyecto"
    exit 1
fi

# Verificar que no hay cambios sin commitear
if [ -n "$(git status --porcelain)" ]; then
    warning "Hay cambios sin commitear. ¿Quieres continuar? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log "Deploy cancelado"
        exit 1
    fi
fi

# 1. Build del frontend (con cache busting)
log "Construyendo frontend con cache busting..."
cd Frontend/endoscopia-app
# Limpiar build anterior
rm -rf dist
# Build limpio
npm run build
success "Frontend construido correctamente (sin caché)"
cd ../..

# 2. Commit y push a GitHub
log "Haciendo commit y push a GitHub..."
git add .
git commit -m "Deploy production - $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main
success "Cambios enviados a GitHub"

# 3. Información de URLs
echo ""
echo "🌐 URLs de Producción:"
echo "  Frontend: https://hc-damian.vercel.app"
echo "  Backend:  https://endoscopia-backend-production.onrender.com"
echo ""

# 4. Verificación automática (opcional)
log "Verificando servicios..."
sleep 10

# Verificar backend
if curl -s "https://endoscopia-backend-production.onrender.com/test" | grep -q "BACKEND"; then
    success "Backend funcionando"
else
    warning "Backend puede estar iniciando..."
fi

echo ""
success "🎉 Deploy completado!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Espera 2-3 minutos para que Vercel redesplegue el frontend"
echo "2. Recarga https://hc-damian.vercel.app"
echo "3. Verifica que no hay errores en la consola del navegador"
echo ""
echo "🔍 Para verificar:"
echo "  - Frontend: https://hc-damian.vercel.app"
echo "  - Backend: https://endoscopia-backend-production.onrender.com/test"
echo "  - Plantillas: https://endoscopia-backend-production.onrender.com/plantillas/plantillas_tecnicas_cx"
