# Panel de pedidos · Demo Vercel + Supabase

Proyecto de demostración con React, Vite, Tailwind, Express y Supabase. **No necesita backend externo** para publicar en Vercel: `api/[...path].js` sirve las rutas Express como función Node.js.

## Subir a GitHub (sin crear una carpeta extra)

1. Descarga el ZIP y **descomprímelo**.
2. Abre tu repositorio `fbjfernandez/panel-pedidos` en GitHub.
3. Carga el **contenido de la carpeta `panel-pedidos-listo`**, no la carpeta que lo contiene. Las carpetas `web`, `api` y `supabase` y los archivos `package.json` y `vercel.json` deben quedar en la **raíz** del repositorio.
4. **Importante:** si ya existen archivos del mismo nombre, reemplázalos con esta versión. GitHub web puede resultar incómodo para sobrescribir muchos archivos; puedes hacerlo con GitHub Desktop (ver instrucciones más abajo).
5. No subas archivos `.env`, claves privadas, `node_modules` ni `dist`.

## Configurar Vercel (proyecto existente o nuevo)

- Conecta el repositorio a Vercel, rama `main`.
- **Root Directory: vacío** (raíz del repositorio; NO `web`, NO `dist`).
- Framework: **Vite**.
- Build Command: `npm run build` (viene en `vercel.json`).
- Output Directory: `web/dist` (viene en `vercel.json`).
- Install Command: `npm install` (viene en `vercel.json`).
- No introduzcas valores contradictorios en Overrides.
- Variables de entorno (**Production**, y opcionalmente **Preview**):
  - `VITE_SUPABASE_URL`: Project URL de Supabase.
  - `VITE_SUPABASE_ANON_KEY`: clave pública anon/legacy de Supabase.
  - `SUPABASE_URL`: misma Project URL.
  - `SUPABASE_ANON_KEY`: misma clave pública anon/legacy.
  - `WEB_ORIGIN`: URL real del sitio `https://panel-pedidos-navy.vercel.app` (o tu dominio actual). Si usas otros dominios de preview, sepáralos por comas.
- `PORT` no es necesario en Vercel; sólo se utiliza para el servidor local.
- Después de configurar variables, **despliega una nueva compilación**.

## Verificar

1. Abre `https://TU-DOMINIO.vercel.app/api/orders` sin sesión. Debe responder un JSON: `{"error":"Inicia sesión"}` con código 401, **no 404**. Si hay 500, consulta Runtime Logs; suelen indicar variables faltantes.
2. Abre tu página, inicia sesión, verifica los pedidos.
3. Revisa en Supabase que hayas ejecutado `supabase/schema.sql` usando SQL Editor. Sólo hazlo si el esquema aún no existe; si ya existe, revisa antes de repetir migraciones.
4. Si el esquema ya estaba creado, habilita la eliminación de pedidos ejecutando en SQL Editor:

   ```sql
   drop policy if exists "members delete orders" on public.orders;
   create policy "members delete orders" on public.orders for delete to authenticated using (
     exists (
       select 1 from public.organization_members m
       where m.organization_id = orders.organization_id and m.user_id = (select auth.uid())
     )
   );
   ```

## Desarrollo local

Node.js 20.19+ / 22.12+, ejecuta `npm install` en raíz, configura `web/.env` y `api/.env` basándote en sus `.env.example`, y ejecuta `npm run dev`. Frontend: http://localhost:5173; API: http://localhost:4000. Vite reenvía `/api` automáticamente.

## Publicación con GitHub Desktop (forma recomendada para reemplazar todo)

1. GitHub Desktop → File → Clone repository → `fbjfernandez/panel-pedidos`.
2. Copia los archivos **dentro** de `panel-pedidos-listo` al directorio local del repositorio, aceptando reemplazar los que ya están. No borres `.git`.
3. En GitHub Desktop revisa los cambios, Commit to main y Push origin.
4. Revisa el nuevo Deployment en Vercel.

## Alcance y privacidad

El panel centraliza pedidos, comprobantes privados y tickets térmicos. No confirma movimientos bancarios automáticamente ni conecta con WhatsApp, Shalom u Olva. Supabase usa autenticación y políticas RLS; mantén secretos privados fuera del repositorio y del frontend.
