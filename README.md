# Panel de pedidos · Demo Vercel + Supabase

Proyecto de demostración con React, Vite, Tailwind, Express y Supabase. **No necesita backend externo** para publicar en Vercel: `api/[...path].js` sirve las rutas Express como función Node.js.

## Subir a GitHub (sin crear una carpeta extra)



- Conecta el repositorio a Vercel, rama `main`. Si el repositorio contiene una carpeta `panel-pedidos` además de los archivos del proyecto, confirma que **Root Directory** apunte a la carpeta que contiene el `vercel.json` y las carpetas `api`, `web` y `supabase` que quieres desplegar.
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
  - `WEB_ORIGIN`: URL real del sitio que aparece en Vercel, sin asumir un nombre de dominio específico. Si usas otros dominios de preview, sepáralos por comas.
- `PORT` no es necesario en Vercel; sólo se utiliza para el servidor local.
- Después de configurar variables, **despliega una nueva compilación**.

## Verificar

1. Copia el dominio asignado al proyecto en Vercel y abre `https://TU-DOMINIO.vercel.app/api/orders` sin sesión. Debe responder JSON con `{"error":"Inicia sesión"}` y código 401, no una página de Vercel. Prueba también `https://TU-DOMINIO.vercel.app/api/orders/test-id/proof`: debe responder JSON 401. Un 401 confirma que la ruta llegó a la función; un 404 de texto `NOT_FOUND` significa que Vercel no publicó/enrutó la función.
2. En Vercel → Deployments, confirma que el deployment Production usa la rama `main` y el commit más reciente de GitHub. En Settings → Build and Deployment, deja **Root Directory vacío** (raíz del repositorio, donde están `vercel.json`, `api/` y `web/`). En el detalle del deployment → Functions, confirma que aparecen las funciones de `api/orders`. Si el deployment apunta a otro commit o no lista esas funciones, despliega la última versión de `main`; no cambies las rutas de Supabase para corregir un `NOT_FOUND` de Vercel.
3. Abre tu página, inicia sesión, verifica los pedidos.
4. Revisa en Supabase que hayas ejecutado `supabase/schema.sql` usando SQL Editor. Sólo hazlo si el esquema aún no existe; si ya existe, revisa antes de repetir migraciones.
5. Si el esquema ya existe, no vuelvas a ejecutar `supabase/schema.sql`. Aplica las migraciones pendientes en orden, tal como se explica en las secciones siguientes.

## Desarrollo local

Node.js 20.19+ / 22.12+, ejecuta `npm install` en raíz, configura `web/.env` y `api/.env` basándote en sus `.env.example`, y ejecuta `npm run dev`. Frontend: http://localhost:5173; API: http://localhost:4000. Vite reenvía `/api` automáticamente.

## Publicación con GitHub Desktop (forma recomendada para reemplazar todo)

1. GitHub Desktop → File → Clone repository → `fbjfernandez/panel-pedidos`.
2. Copia los archivos **dentro** de `panel-pedidos-listo` al directorio local del repositorio, aceptando reemplazar los que ya están. No borres `.git`.
3. En GitHub Desktop revisa los cambios, Commit to main y Push origin.
4. Revisa el nuevo Deployment en Vercel.

## Compartir pedidos y recuperar contraseña

- Las cuentas autenticadas pueden consultar los pedidos, pagos y comprobantes. Consulta de pedidos por fechas se basa en cuándo se registró cada pedido; el resumen muestra cantidad e importe total del resultado.
- Para aplicar esto a una base Supabase ya creada, ejecuta una sola vez [`supabase/migrations/20261013_share_orders.sql`](./supabase/migrations/20261013_share_orders.sql) desde Supabase → SQL Editor.
- Para una instalación nueva, `supabase/schema.sql` ya contiene las políticas de lectura compartida.
- En Supabase → Authentication → URL Configuration, agrega el dominio del panel (y el dominio local `http://localhost:5173` si lo usas) a **Redirect URLs**. El enlace de recuperación regresa al origen del panel; desde ahí se establece la nueva contraseña.

## Roles de usuario

- **Operador:** registra pedidos, completa/edita datos, cambia el estado de preparación y registra pagos.
- **Solo lectura:** consulta e imprime pedidos, sin poder modificarlos.
- **Administrador:** tiene permisos de operador, puede eliminar pedidos y asignar roles desde el botón **Usuarios**.
- Las cuentas nuevas empiezan como **Solo lectura**. Para aplicar roles a una base existente, ejecuta [`supabase/migrations/20261014_roles.sql`](./supabase/migrations/20261014_roles.sql) después de la migración de pedidos compartidos. Para una instalación nueva, los roles están incluidos en `supabase/schema.sql`.
- Después de la migración, promueve la cuenta inicial a administradora desde Supabase → SQL Editor, reemplazando el correo por el de esa cuenta:

  ```sql
  update public.app_users set role = 'admin' where email = 'admin@example.com';
  ```

- Luego el administrador asigna **Operador** o **Solo lectura** a las demás cuentas desde el panel. No es posible quitar desde la interfaz el último rol de administrador.

## Alcance y privacidad

El panel centraliza pedidos, comprobantes privados y tickets térmicos. No confirma movimientos bancarios automáticamente ni conecta con WhatsApp, Shalom u Olva. Supabase usa autenticación y políticas RLS; mantén secretos privados fuera del repositorio y del frontend.
