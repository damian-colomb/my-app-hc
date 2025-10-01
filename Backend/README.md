# Endoscopia Backend

Backend API para la aplicación de historia clínica endoscópica.

## Deploy en Render

1. Conecta tu repositorio de GitHub a Render
2. Selecciona este directorio como raíz del proyecto
3. Usa Python como runtime
4. Comando de build: `pip install -r requirements.txt`
5. Comando de start: `python start.py`

## Variables de entorno necesarias

- `DATABASE_URL`: URL de la base de datos PostgreSQL
- `SUPABASE_URL`: URL de Supabase
- `SUPABASE_SERVICE_KEY`: Clave de servicio de Supabase
- `ENV`: Entorno (prod)
- `JWT_SECRET_KEY`: Clave secreta para JWT
- `JWT_ALGORITHM`: Algoritmo JWT (HS256)
- `JWT_EXPIRE_MINUTES`: Tiempo de expiración del JWT
