#!/bin/bash

echo "🔍 Verificando corrección de API_BASE en producción..."

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

echo "🌐 URLs de producción:"
echo "  Frontend: https://hc-damian.vercel.app"
echo "  Backend: https://endoscopia-backend-production.onrender.com"
echo ""

echo "🔍 Verificando servicios..."

# Verificar backend
if curl -s "https://endoscopia-backend-production.onrender.com/test" | grep -q "BACKEND"; then
    success "Backend funcionando"
else
    error "Backend no responde"
fi

# Verificar frontend
if curl -s -I "https://hc-damian.vercel.app" | grep -q "200 OK"; then
    success "Frontend funcionando"
else
    error "Frontend no responde"
fi

echo ""
echo "📝 Para probar la corrección:"
echo "1. Abre: https://hc-damian.vercel.app"
echo "2. Abre la consola del navegador (F12)"
echo "3. Busca en los logs:"
echo "   ✅ [config] API_BASE final = https://endoscopia-backend-production.onrender.com"
echo "   ❌ NO debería aparecer: http://localhost:8000"
echo ""
echo "4. Prueba cargar pacientes - debería funcionar sin errores de CORS"
echo ""
echo "🎯 Si ves errores de 'localhost:8000', la corrección no se aplicó correctamente"
echo "🎯 Si ves 'endoscopia-backend-production.onrender.com', ¡la corrección funcionó!"
