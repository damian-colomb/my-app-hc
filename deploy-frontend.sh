#!/bin/bash

# Script para deploy rápido del frontend
# Úsalo cuando solo cambies código del frontend

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo "🚀 DEPLOY RÁPIDO - FRONTEND"
echo "=========================="
echo ""

# Build del frontend (con cache busting)
log "Construyendo frontend con cache busting..."
cd Frontend/endoscopia-app
# Limpiar build anterior
rm -rf dist
# Build limpio
npm run build
success "Frontend construido (sin caché)"
cd ../..

# Commit y push
log "Enviando cambios a GitHub..."
git add .
git commit -m "Frontend update - $(date '+%H:%M:%S')"
git push origin main
success "Cambios enviados"

echo ""
success "🎉 Frontend actualizado!"
echo "⏱️ Espera 2-3 minutos y recarga https://hc-damian.vercel.app"
