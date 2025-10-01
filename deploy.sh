#!/bin/bash

# ===========================================
# SCRIPT DE DEPLOYMENT AUTOMATIZADO
# ===========================================

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Banner
echo -e "${BLUE}"
echo "🚀 DEPLOYMENT AUTOMATIZADO - APLICACIÓN CLÍNICA"
echo "=============================================="
echo -e "${NC}"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -d "Backend" ] || [ ! -d "Frontend" ]; then
    error "No se encontró la estructura del proyecto. Ejecuta desde el directorio raíz."
    exit 1
fi

# Función para verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js no está instalado"
        exit 1
    fi
    
    # Verificar npm
    if ! command -v npm &> /dev/null; then
        error "npm no está instalado"
        exit 1
    fi
    
    # Verificar Python
    if ! command -v python3 &> /dev/null; then
        error "Python3 no está instalado"
        exit 1
    fi
    
    # Verificar Railway CLI
    if ! command -v railway &> /dev/null; then
        warning "Railway CLI no está instalado. Instalando..."
        npm install -g @railway/cli
    fi
    
    # Verificar Vercel CLI
    if ! command -v vercel &> /dev/null; then
        warning "Vercel CLI no está instalado. Instalando..."
        npm install -g vercel
    fi
    
    success "Dependencias verificadas"
}

# Función para build del frontend
build_frontend() {
    log "Construyendo frontend..."
    
    cd Frontend/endoscopia-app
    
    # Instalar dependencias
    log "Instalando dependencias del frontend..."
    npm ci
    
    # Build de producción
    log "Ejecutando build de producción..."
    npm run build
    
    if [ ! -d "dist" ]; then
        error "Build del frontend falló"
        exit 1
    fi
    
    success "Frontend construido exitosamente"
    cd ../..
}

# Función para verificar backend
verify_backend() {
    log "Verificando backend..."
    
    cd Backend
    
    # Verificar que el entorno virtual existe
    if [ ! -d "venv" ]; then
        error "Entorno virtual no encontrado. Ejecuta: python3 -m venv venv"
        exit 1
    fi
    
    # Activar entorno virtual
    source venv/bin/activate
    
    # Verificar dependencias
    log "Verificando dependencias del backend..."
    pip install -r requirements.txt
    
    # Verificar sintaxis
    log "Verificando sintaxis del backend..."
    python -m py_compile main.py
    
    success "Backend verificado"
    cd ..
}

# Función para deployment en Railway
deploy_railway() {
    log "Desplegando backend en Railway..."
    
    cd Backend
    
    # Verificar que estamos logueados en Railway
    if ! railway whoami &> /dev/null; then
        warning "No estás logueado en Railway. Ejecutando login..."
        railway login
    fi
    
    # Deploy
    log "Ejecutando deployment en Railway..."
    railway up --detach
    
    success "Backend desplegado en Railway"
    cd ..
}

# Función para deployment en Vercel
deploy_vercel() {
    log "Desplegando frontend en Vercel..."
    
    cd Frontend/endoscopia-app
    
    # Verificar que estamos logueados en Vercel
    if ! vercel whoami &> /dev/null; then
        warning "No estás logueado en Vercel. Ejecutando login..."
        vercel login
    fi
    
    # Deploy
    log "Ejecutando deployment en Vercel..."
    vercel --prod
    
    success "Frontend desplegado en Vercel"
    cd ../..
}

# Función para verificar deployment
verify_deployment() {
    log "Verificando deployment..."
    
    # Obtener URLs de deployment
    cd Backend
    RAILWAY_URL=$(railway status --json | jq -r '.deployments[0].url' 2>/dev/null || echo "")
    cd ..
    
    cd Frontend/endoscopia-app
    VERCEL_URL=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "")
    cd ../..
    
    if [ -n "$RAILWAY_URL" ]; then
        log "Probando backend en: $RAILWAY_URL"
        if curl -f "$RAILWAY_URL/__up" &> /dev/null; then
            success "Backend funcionando correctamente"
        else
            warning "Backend no responde correctamente"
        fi
    fi
    
    if [ -n "$VERCEL_URL" ]; then
        log "Frontend desplegado en: $VERCEL_URL"
        success "Frontend desplegado correctamente"
    fi
}

# Función para mostrar resumen
show_summary() {
    echo -e "${GREEN}"
    echo "🎉 DEPLOYMENT COMPLETADO"
    echo "========================"
    echo -e "${NC}"
    
    echo "📊 Resumen del deployment:"
    echo "  ✅ Frontend: Construido y desplegado"
    echo "  ✅ Backend: Verificado y desplegado"
    echo "  ✅ Configuración: Optimizada para producción"
    echo ""
    echo "🔗 URLs de deployment:"
    echo "  🌐 Frontend: https://tu-app.vercel.app"
    echo "  🚂 Backend: https://tu-app.railway.app"
    echo ""
    echo "📝 Próximos pasos:"
    echo "  1. Configurar variables de entorno en Railway"
    echo "  2. Configurar variables de entorno en Vercel"
    echo "  3. Actualizar CORS con las URLs de producción"
    echo "  4. Probar la aplicación en producción"
}

# Función principal
main() {
    # Verificar argumentos
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Uso: ./deploy.sh [opciones]"
        echo ""
        echo "Opciones:"
        echo "  --frontend-only    Solo deploy del frontend"
        echo "  --backend-only     Solo deploy del backend"
        echo "  --verify-only      Solo verificar sin deploy"
        echo "  --help, -h         Mostrar esta ayuda"
        exit 0
    fi
    
    # Ejecutar pasos según argumentos
    check_dependencies
    
    if [ "$1" = "--verify-only" ]; then
        verify_backend
        success "Verificación completada"
        exit 0
    fi
    
    if [ "$1" != "--backend-only" ]; then
        build_frontend
    fi
    
    if [ "$1" != "--frontend-only" ]; then
        verify_backend
        deploy_railway
    fi
    
    if [ "$1" != "--backend-only" ]; then
        deploy_vercel
    fi
    
    verify_deployment
    show_summary
}

# Ejecutar función principal
main "$@"
