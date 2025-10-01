#!/bin/bash

# Script para probar funcionalidad en producción
echo "🧪 Probando funcionalidad en producción..."

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URLs de producción
BACKEND_URL="https://endoscopia-backend-production.up.railway.app"
FRONTEND_URL="https://hc-damian.vercel.app"

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

echo "🔍 Probando endpoints del backend..."

# Probar endpoint de salud
echo "1. Probando endpoint de salud..."
if curl -s "$BACKEND_URL/__up" | grep -q "ok"; then
    success "Backend está funcionando"
else
    error "Backend no responde"
fi

# Probar endpoint de test
echo "2. Probando endpoint de test..."
if curl -s "$BACKEND_URL/test" | grep -q "funcionando"; then
    success "Endpoint de test funciona"
else
    error "Endpoint de test no funciona"
fi

# Probar endpoint de CORS debug
echo "3. Probando endpoint de CORS debug..."
if curl -s "$BACKEND_URL/cors-debug" | grep -q "origin"; then
    success "Endpoint de CORS debug funciona"
else
    error "Endpoint de CORS debug no funciona"
fi

# Probar endpoint de base de datos
echo "4. Probando conexión a base de datos..."
if curl -s "$BACKEND_URL/health/db" | grep -q "ok"; then
    success "Base de datos conectada"
else
    error "Base de datos no conecta"
fi

# Probar endpoint de storage
echo "5. Probando conexión a Supabase..."
if curl -s "$BACKEND_URL/health/storage" | grep -q "ok"; then
    success "Supabase conectado"
else
    warning "Supabase no conecta (puede ser normal si no está configurado)"
fi

echo ""
echo "🌐 Probando frontend..."

# Verificar que el frontend esté accesible
echo "6. Probando accesibilidad del frontend..."
if curl -s -I "$FRONTEND_URL" | grep -q "200 OK"; then
    success "Frontend está accesible"
else
    error "Frontend no está accesible"
fi

echo ""
echo "🔗 Probando comunicación Frontend-Backend..."

# Simular una petición desde el frontend al backend
echo "7. Probando CORS desde frontend..."
if curl -s -H "Origin: $FRONTEND_URL" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Content-Type" -X OPTIONS "$BACKEND_URL/cors-debug" | grep -q "Access-Control-Allow-Origin"; then
    success "CORS configurado correctamente"
else
    error "CORS no está configurado correctamente"
fi

echo ""
echo "📊 Resumen de pruebas:"
echo "  🚂 Backend: $BACKEND_URL"
echo "  🌐 Frontend: $FRONTEND_URL"
echo "  🗄️ Base de datos: Neon PostgreSQL"
echo "  📁 Storage: Supabase"

echo ""
echo "🔍 Para probar manualmente:"
echo "  1. Abre: $FRONTEND_URL"
echo "  2. Abre la consola del navegador (F12)"
echo "  3. Verifica que no haya errores de CORS"
echo "  4. Prueba hacer login"
echo "  5. Prueba cargar datos (pacientes, coberturas, etc.)"

echo ""
echo "🆘 Si hay problemas:"
echo "  - Revisa los logs del backend en Railway"
echo "  - Revisa los logs del frontend en Vercel"
echo "  - Verifica las variables de entorno"
echo "  - Usa el endpoint de CORS debug: $BACKEND_URL/cors-debug"
