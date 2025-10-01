#!/bin/bash

# Script de deploy a Vercel con corrección de API_BASE
echo "🚀 Iniciando deploy a Vercel con corrección de API_BASE..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json. Asegúrate de estar en el directorio del frontend."
    exit 1
fi

# Limpiar build anterior
echo "🧹 Limpiando build anterior..."
rm -rf dist/

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# Build con corrección de API_BASE
echo "🔨 Construyendo con corrección de API_BASE..."
npm run build

# Verificar que el build se completó
if [ -d "dist" ]; then
    echo "✅ Build completado exitosamente"
    echo "📁 Archivos generados:"
    ls -la dist/
else
    echo "❌ Error en el build"
    exit 1
fi

# Deploy a Vercel
echo "🌐 Desplegando a Vercel..."
npx vercel --prod

echo "🎯 Deploy completado con corrección de API_BASE"
echo "🔗 Verifica en: https://hc-damian.vercel.app"
echo "📋 Revisa la consola para ver los logs de debugging"
