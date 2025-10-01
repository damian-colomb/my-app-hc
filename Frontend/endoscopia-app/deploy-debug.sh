#!/bin/bash

# Script de deploy con debugging habilitado
echo "🚀 Iniciando deploy con debugging..."

# Limpiar build anterior
echo "🧹 Limpiando build anterior..."
rm -rf dist/

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# Build con debugging
echo "🔨 Construyendo con debugging habilitado..."
NODE_ENV=development npm run build

# Verificar que el build se completó
if [ -d "dist" ]; then
    echo "✅ Build completado exitosamente"
    echo "📁 Archivos generados:"
    ls -la dist/
else
    echo "❌ Error en el build"
    exit 1
fi

echo "🎯 Deploy con debugging listo para producción"
