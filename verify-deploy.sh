#!/bin/bash

# Script para verificar que el deploy funcionó correctamente
# Verifica tanto backend como frontend

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "🔍 VERIFICACIÓN POST-DEPLOY"
echo "============================"
echo ""

# URLs de producción
FRONTEND_URL="https://hc-damian.vercel.app"
BACKEND_URL="https://endoscopia-backend-production.onrender.com"

log "Verificando servicios..."

# 1. Verificar Backend
echo "1. Backend (Render):"
if curl -s "$BACKEND_URL/test" | grep -q "BACKEND"; then
    success "Backend funcionando"
else
    error "Backend no responde"
    exit 1
fi

# 2. Verificar Endpoint de Plantillas
echo "2. Endpoint Plantillas:"
if curl -s "$BACKEND_URL/plantillas/plantillas_tecnicas_cx" | grep -q "tecnica"; then
    success "Endpoint plantillas funcionando"
else
    error "Endpoint plantillas no responde"
fi

# 3. Verificar Frontend (básico)
echo "3. Frontend (Vercel):"
if curl -s "$FRONTEND_URL" | grep -q "Historia Clínica"; then
    success "Frontend cargando"
else
    error "Frontend no responde"
fi

echo ""
echo "📋 INSTRUCCIONES PARA VERIFICAR MANUALMENTE:"
echo "1. Abre: $FRONTEND_URL"
echo "2. Presiona Ctrl+F5 (forzar recarga sin caché)"
echo "3. Abre consola del navegador (F12)"
echo "4. Busca en los logs:"
echo "   ✅ Debería aparecer: onrender.com"
echo "   ❌ NO debería aparecer: up.railway.app"
echo ""
echo "5. Prueba cargar pacientes - debería funcionar sin errores"
echo ""

# 4. Verificar que no hay referencias a Railway
log "Verificando configuración..."
if grep -r "up.railway.app" Frontend/endoscopia-app/src/ > /dev/null 2>&1; then
    error "Aún hay referencias a Railway en el código"
    echo "Archivos con referencias a Railway:"
    grep -r "up.railway.app" Frontend/endoscopia-app/src/
else
    success "No hay referencias a Railway en el código"
fi

echo ""
success "🎉 Verificación completada!"
echo ""
echo "🔗 URLs de Producción:"
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo "  Test:     $BACKEND_URL/test"
echo "  Plantillas: $BACKEND_URL/plantillas/plantillas_tecnicas_cx"
