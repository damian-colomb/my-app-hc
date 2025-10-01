#!/bin/bash

# Script de deploy a Vercel con corrección de CORS
echo "🚀 Iniciando deploy a Vercel con corrección de CORS..."

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

# Build con corrección de CORS
echo "🔨 Construyendo con corrección de CORS..."
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

echo "🎯 Deploy completado con corrección de CORS"
echo "🔗 Verifica en: https://hc-damian.vercel.app"
