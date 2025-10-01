# 🚀 Instrucciones de Deploy - Corrección de API_BASE

## 🔍 **Problema Identificado:**
- Error: `"Can't find variable: API_BASE"`
- Causa: La variable `API_BASE` no se está importando correctamente en producción
- Solución: Implementado fallback automático para `API_BASE`

## 🛠️ **Cambios Implementados:**

### 1. **Configuración mejorada en `config.js`:**
- ✅ Exportación correcta de `API_BASE`
- ✅ Debugging detallado
- ✅ Verificación de HTTPS

### 2. **Fallback automático en `api.js`:**
- ✅ Verificación de `API_BASE` antes de usar
- ✅ Fallback automático a URL de producción
- ✅ Debugging de la URL final

### 3. **Corrección de CORS:**
- ✅ URLs HTTPS forzadas en producción
- ✅ Interceptor de errores mejorado
- ✅ Retry automático con HTTPS

## 🚀 **Para Deployar:**

### **Opción 1: Script automático**
```bash
cd /Users/damiancolomb/Desktop/App/Frontend/endoscopia-app
./deploy-vercel-fix.sh
```

### **Opción 2: Manual**
```bash
cd /Users/damiancolomb/Desktop/App/Frontend/endoscopia-app
npm run build
npx vercel --prod
```

## 🔍 **Verificación Post-Deploy:**

1. **Abre:** https://hc-damian.vercel.app
2. **Abre la consola** del navegador (F12)
3. **Busca estos logs:**
   ```
   🔧 [api.js] API_BASE_FINAL: https://endoscopia-backend-production.up.railway.app
   🔗 [url] Generando URL: coberturas → https://endoscopia-backend-production.up.railway.app/coberturas/
   🔒 [url] ¿Es HTTPS?: true
   ```

4. **Haz clic en "Gestionar coberturas"**
5. **Verifica que no aparezca el error:**
   ```
   ❌ ERROR: Error al cargar coberturas - Can't find variable: API_BASE
   ```

## ✅ **Resultado Esperado:**
- ✅ El modal de coberturas debería cargar sin errores
- ✅ Los logs deberían mostrar URLs HTTPS
- ✅ No deberían aparecer errores de `API_BASE`
- ✅ Las coberturas deberían cargar correctamente

## 🆘 **Si persiste el problema:**
1. Verifica que el backend esté funcionando en HTTPS
2. Revisa la configuración de CORS del backend
3. Contacta al administrador del backend
