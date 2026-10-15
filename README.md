# Panel de Pedidos
https://panel-pedidos-pi.vercel.app
 ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
### 🚀 [**Ver Demo en Vivo →**](https://panel-pedidos-h9q74bz70-fbjfernandezs-projects.vercel.app)

## 🧪 Cómo probar la demo

1. Entra a la [demo en Vercel](https://panel-pedidos-h9q74bz70-fbjfernandezs-projects.vercel.app)
2. Inicia sesión con las credenciales de prueba provistas(`fbjfernandez8103@gmail.com` / Contraseña: `cody1234`) o regístrate con un nuevo correo para explorar la bandeja unificada de pedidos 
3. Utiliza los filtros superiores para alternar entre los canales de envío (**Lima, Shalom, Olva**)
4. Prueba las acciones rápidas en cada tarjeta de pedido: genera la vista previa para impresión térmica con el botón **Ticket**, actualiza la conciliación de pago, edita los datos o elimina un registro de prueba según lo necesites.
Sistema web que unifica tus pedidos y elimina los chats de WhatsApp como sistema de control. Cada pago queda vinculado a su comprobante y cada pedido genera su ticket de envio con un solo boton, listo para imprimir directo. Todo es rapido y se controla desde el celular, para mantener un orden absoluto.
 
## Que hace
 
- **Pedidos centralizados:** registra destinatario, DNI/RUC, destino (Lima, Shalom u Olva), agencia, direccion, celular y monto.
- **Pagos con comprobante:** registra el pago (Yape, Plin o Transferencia) con su referencia y adjunta el comprobante (JPG, PNG, WEBP o PDF, hasta 5 MB). Queda guardado en un bucket privado de Supabase y se consulta con enlaces firmados de 60 segundos.
- **Ticket de envio en un clic:** genera el ticket "Despacho" con destino, destinatario, DNI/RUC, telefono, agencia y direccion, y abre la impresion directa. Soporta papel termico de **58 mm** y **80 mm**.
- **Estados de preparacion:** Nuevo, Preparando, Enviado y Entregado.
- **Filtros:** por destino (Todos, Lima, Shalom, Olva) y por rango de fechas, con resumen de cantidad e importe total del resultado.
- **Pensado para el celular:** interfaz responsive para operar desde el telefono.
- **Autenticacion y recuperacion de contrasena** con Supabase Auth.
## Roles
 
| Accion | Operador | Administrador |
| --- | :---: | :---: |
| Ver pedidos, pagos y comprobantes | Si | Si |
| Registrar y editar pedidos | Si | Si |
| Cambiar estado de preparacion | Si | Si |
| Registrar pagos y subir comprobantes | Si | Si |
| Imprimir tickets | Si | Si |
| Eliminar pedidos | Si | Si |
| Gestionar usuarios y roles | No | Si |
 
- Las cuentas nuevas empiezan como **Operador**.
- En esta demo los roles se asignan directamente desde Supabase → SQL Editor:
```sql
  -- Dar rol de administrador
  update public.app_users set role = 'admin' where email = 'correo@ejemplo.com';
 
  -- Dejar como operador
  update public.app_users set role = 'operator' where email = 'correo@ejemplo.com';
```
 
- El sistema impide quedarse sin ningun administrador.
## Stack
 
- **Frontend:** React , Vite, Tailwind CSS , lucide-react
- **Backend:** Express (corre como funcion Node.js en Vercel), Zod, Multer
- **Base de datos, auth y storage:** Supabase (PostgreSQL con RLS)
- **Despliegue:** Vercel
## Estructura
 
```
panel-pedidos/
├── api/          # API Express (rutas /api/orders, /api/users, /api/me)
├── web/          # Frontend React + Vite
├── supabase/     # schema.sql y migraciones
└── vercel.json   # Configuracion de build y despliegue
```
 
## Desarrollo local
 
Requisitos: Node.js 20.19+ o 22.12+ y un proyecto de Supabase.
 
1. Instala dependencias en la raiz:
```bash
   npm install
```
 
2. Crea `api/.env` y `web/.env` a partir de sus `.env.example`:
```env
   # api/.env
   PORT=4000
   SUPABASE_URL=https://TU_PROYECTO.supabase.co
   SUPABASE_ANON_KEY=TU_ANON_KEY
   WEB_ORIGIN=http://localhost:5173
 
   # web/.env
   VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```
 
3. En Supabase → SQL Editor ejecuta `supabase/schema.sql` (instalacion nueva).
4. Levanta todo:
```bash
   npm run dev
```
 
   Frontend en http://localhost:5173 y API en http://localhost:4000 (Vite reenvia `/api`).
 
5. Promueve tu primera cuenta a administrador (cambia el correo):
```sql
   update public.app_users set role = 'admin' where email = 'tu-correo@ejemplo.com';
```
 
6. En Supabase → Authentication → URL Configuration agrega `http://localhost:5173` (y tu dominio de produccion) en **Redirect URLs** para la recuperacion de contrasena.
## Despliegue en Vercel
 
- Conecta el repositorio (rama `main`) con **Root Directory vacio**.
- Framework: Vite. Build: `npm run build`. Output: `web/dist` (ya definidos en `vercel.json`).
- Variables de entorno (Production y, opcional, Preview):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - `WEB_ORIGIN`: URL real del sitio (varias separadas por coma)
- Despues de cambiar variables, vuelve a desplegar.
**Verificacion rapida:** abre `https://TU-DOMINIO.vercel.app/api/orders` sin sesion. Debe responder JSON `{"error":"Inicia sesión"}` con codigo 401. Un 404 `NOT_FOUND` indica que Vercel no publico la funcion.
 
## Migraciones (base ya existente)
 
Si tu base Supabase ya estaba creada, no repitas `schema.sql`. Ejecuta el contenido completo de cada archivo, en este orden:
 
1. `supabase/migrations/20261013_share_orders.sql`
2. `supabase/migrations/20261014_roles.sql`
3. `supabase/migrations/20261015_two_roles.sql`
## API
 
| Metodo | Ruta | Rol |
| --- | --- | --- |
| GET | `/api/me` | Cualquiera |
| GET | `/api/orders` (filtros `destination`, `from`, `to`) | Cualquiera |
| POST | `/api/orders` | Operador, Admin |
| PATCH | `/api/orders/:id` | Operador, Admin |
| PATCH | `/api/orders/:id/status` | Operador, Admin |
| POST | `/api/orders/:id/payment` | Operador, Admin |
| GET | `/api/orders/:id/proof` | Cualquiera |
| DELETE | `/api/orders/:id` | Admin |
| GET | `/api/users` | Admin |
| PATCH | `/api/users/:id/role` | Admin |
 
## Alcance y seguridad
 
- No confirma movimientos bancarios automaticamente ni se conecta con WhatsApp, Shalom u Olva.
- Seguridad con Supabase Auth y politicas RLS; los comprobantes viven en un bucket privado.
- Manten los secretos fuera del repositorio y del frontend (solo se usa la clave publica anon).
## Autor
 
Fernando Fernandez · [@fbjfernandez](https://github.com/fbjfernandez)
