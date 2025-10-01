# Deploy a GitHub Pages

## Configuración automática

Este proyecto está configurado para hacer deploy automático a GitHub Pages cuando se hace push a la rama `main`.

### URL de la aplicación
Una vez configurado GitHub Pages, tu aplicación estará disponible en:
`https://damian-colomb.github.io/historia-clinica/`

### Configuración en GitHub

1. Ve a tu repositorio en GitHub: `https://github.com/damian-colomb/historia-clinica`
2. Ve a **Settings** → **Pages**
3. En **Source**, selecciona **GitHub Actions**
4. El workflow se ejecutará automáticamente en cada push a `main`

### Configuración del backend

Asegúrate de que tu backend en Render esté configurado para aceptar requests desde el dominio de GitHub Pages:

- URL del frontend: `https://damian-colomb.github.io/historia-clinica/`
- Configura CORS en tu backend para permitir este dominio

### Variables de entorno

Si necesitas variables de entorno para producción, puedes configurarlas en:
- GitHub → Settings → Secrets and variables → Actions

### Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build local
npm run build

# Preview del build
npm run preview
```

### Troubleshooting

Si el deploy no funciona:
1. Verifica que el workflow se ejecute en la pestaña **Actions**
2. Revisa los logs del workflow
3. Asegúrate de que GitHub Pages esté habilitado en Settings
