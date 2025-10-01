#!/bin/bash

# Script para verificar configuración de producción
echo "🔍 Verificando configuración de producción..."

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

echo "📋 Verificando archivos de configuración..."

# Verificar archivos de configuración
if [ -f "Backend/env.production" ]; then
    success "Backend/env.production existe"
    
    # Verificar variables críticas del backend
    if grep -q "DATABASE_URL=" Backend/env.production; then
        success "DATABASE_URL configurada"
    else
        error "DATABASE_URL no encontrada"
    fi
    
    if grep -q "FRONTEND_ORIGINS=" Backend/env.production; then
        success "FRONTEND_ORIGINS configurada"
    else
        error "FRONTEND_ORIGINS no encontrada"
    fi
    
    if grep -q "ENV=prod" Backend/env.production; then
        success "ENV=prod configurado"
    else
        error "ENV=prod no encontrado"
    fi
else
    error "Backend/env.production no existe"
fi

if [ -f "Frontend/endoscopia-app/env.production" ]; then
    success "Frontend/endoscopia-app/env.production existe"
    
    # Verificar variables críticas del frontend
    if grep -q "VITE_API_BASE_URL=" Frontend/endoscopia-app/env.production; then
        success "VITE_API_BASE_URL configurada"
        
        # Verificar que la URL sea correcta
        if grep -q "https://endoscopia-backend-production.up.railway.app" Frontend/endoscopia-app/env.production; then
            success "URL del backend es correcta"
        else
            error "URL del backend no es correcta"
        fi
    else
        error "VITE_API_BASE_URL no encontrada"
    fi
else
    error "Frontend/endoscopia-app/env.production no existe"
fi

echo ""
echo "🔗 Verificando URLs de producción..."

# Verificar que las URLs estén en los archivos correctos
if grep -r "https://hc-damian.vercel.app" Backend/ > /dev/null 2>&1; then
    success "URL del frontend encontrada en configuración del backend"
else
    warning "URL del frontend no encontrada en configuración del backend"
fi

if grep -r "https://endoscopia-backend-production.up.railway.app" Frontend/endoscopia-app/src/ > /dev/null 2>&1; then
    success "URL del backend encontrada en configuración del frontend"
else
    warning "URL del backend no encontrada en configuración del frontend"
fi

echo ""
echo "📝 Resumen de configuración:"
echo "  🌐 Frontend: https://hc-damian.vercel.app"
echo "  🚂 Backend: https://endoscopia-backend-production.up.railway.app"
echo "  🗄️ Base de datos: Neon PostgreSQL"
echo "  📁 Storage: Supabase"

echo ""
echo "🚀 Para deployar:"
echo "  1. Backend: cd Backend && ./deploy-railway.sh"
echo "  2. Frontend: cd Frontend/endoscopia-app && ./deploy-vercel-fix.sh"

echo ""
echo "🔍 Para verificar después del deploy:"
echo "  - Backend: https://endoscopia-backend-production.up.railway.app/__up"
echo "  - CORS Debug: https://endoscopia-backend-production.up.railway.app/cors-debug"
echo "  - Frontend: https://hc-damian.vercel.app"
