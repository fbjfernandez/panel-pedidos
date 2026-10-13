import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

const { SUPABASE_URL, SUPABASE_ANON_KEY, WEB_ORIGIN = 'http://localhost:5173' } = process.env
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en Vercel o api/.env')
const app = express()
app.use(cors({ origin: WEB_ORIGIN.split(',') }))
app.use(express.json({ limit: '40kb' }))
const newClient = (jwt) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
app.use('/api', async (req, res, next) => {
  const jwt = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1]
  if (!jwt) return res.status(401).json({ error: 'Inicia sesión' })
  const { data, error } = await authClient.auth.getUser(jwt)
  if (error || !data.user) return res.status(401).json({ error: 'Sesión inválida' })
  req.user = data.user
  req.db = newClient(jwt)
  const { data: profile, error: profileError } = await req.db.from('app_users').select('role').eq('id', data.user.id).maybeSingle()
  if (profileError) return sendError(res, profileError, 500)
  if (!profile) return sendError(res, new Error('La cuenta no tiene un rol asignado. Solicita ayuda al administrador.'), 403)
  req.userRole = profile.role
  next()
})
const orderSchema = z.object({
  customer_name: z.string().trim().min(2).max(120).regex(/^[\p{L}\s]+$/u, 'El destinatario solo puede contener letras'),
  customer_dni: z.string().trim().regex(/^\d{8}$|^\d{11}$/, 'DNI 8 dígitos o RUC 11 dígitos'),
  destination: z.enum(['Lima', 'Shalom', 'Olva']),
  agency: z.string().trim().max(100).default(''),
  address: z.string().trim().min(3).max(250),
  phone: z.string().trim().regex(/^\d{0,9}$/, 'El celular debe tener hasta 9 dígitos').default(''),
  amount: z.coerce.number().finite().nonnegative().max(99999999),
})
const paymentSchema = z.object({ method: z.enum(['Yape', 'Plin', 'Transferencia']), reference: z.string().trim().max(100).optional().default('') })
const sendError = (res, error, status = 400) => res.status(status).json({ error: error?.message || 'Error de solicitud' })
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.userRole)) return sendError(res, new Error('No tienes permisos para realizar esta acción'), 403)
  next()
}
app.get('/api/me', (req, res) => res.json({ role: req.userRole }))
app.get('/api/orders', async (req, res) => {
  const destination = req.query.destination
  if (destination && !['Lima', 'Shalom', 'Olva'].includes(destination)) return sendError(res, new Error('Destino inválido'))
  const { from, to } = req.query
  const validTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value))
  if ((from !== undefined && !validTimestamp(from)) || (to !== undefined && !validTimestamp(to))) {
    return sendError(res, new Error('El rango de fechas no es válido'))
  }
  if (from && to && Date.parse(from) >= Date.parse(to)) return sendError(res, new Error('La fecha inicial debe ser anterior a la fecha final'))
  const data = []
  for (let start = 0; ; start += 1000) {
    let q = req.db.from('orders').select('*, payments(id,method,reference,proof_path,created_at)').order('created_at', { ascending: false }).order('id', { ascending: true }).range(start, start + 999)
    if (destination) q = q.eq('destination', destination)
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lt('created_at', to)
    const { data: page, error } = await q
    if (error) return sendError(res, error)
    data.push(...page)
    if (page.length < 1000) break
  }
  res.json(data.map(order => ({ ...order, can_manage: ['admin', 'operator'].includes(req.userRole), can_delete: req.userRole === 'admin' })))
})
app.get('/api/users', requireRole('admin'), async (req, res) => {
  const { data, error } = await req.db.from('app_users').select('id,email,role').order('email')
  if (error) return sendError(res, error)
  res.json(data)
})
app.patch('/api/users/:id/role', requireRole('admin'), async (req, res) => {
  const parsed = z.object({ role: z.enum(['admin', 'operator', 'viewer']) }).safeParse(req.body)
  if (!parsed.success) return sendError(res, new Error('Rol inválido'))
  if (!z.string().uuid().safeParse(req.params.id).success) return sendError(res, new Error('Usuario inválido'))
  if (req.params.id === req.user.id && parsed.data.role !== 'admin') {
    return sendError(res, new Error('No puedes quitarte el rol de administrador a ti mismo'), 409)
  }
  const { data: target, error: targetError } = await req.db.from('app_users').select('id,role').eq('id', req.params.id).maybeSingle()
  if (targetError) return sendError(res, targetError)
  if (!target) return sendError(res, new Error('Usuario no encontrado'), 404)
  if (target.role === 'admin' && parsed.data.role !== 'admin') {
    const { count, error: countError } = await req.db.from('app_users').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (countError) return sendError(res, countError)
    if (count <= 1) return sendError(res, new Error('Debe quedar al menos un administrador'), 409)
  }
  const { data, error } = await req.db.from('app_users').update({ role: parsed.data.role }).eq('id', req.params.id).select('id,email,role').single()
  if (error) return sendError(res, error)
  res.json(data)
})
app.post('/api/orders', requireRole('admin', 'operator'), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, new Error(parsed.error.issues[0].message))
  const { data: memberships, error: me } = await req.db.from('organization_members').select('organization_id').eq('user_id', req.user.id).limit(1)
  if (me || !memberships?.length) return sendError(res, new Error('No tienes una organización asignada'), 403)
  const { data, error } = await req.db.from('orders').insert({ ...parsed.data, organization_id: memberships[0].organization_id, created_by: req.user.id }).select().single()
  if (error) return sendError(res, error)
  res.status(201).json(data)
})
app.patch('/api/orders/:id', requireRole('admin', 'operator'), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, new Error(parsed.error.issues[0].message))
  const { data, error } = await req.db.from('orders').update(parsed.data).eq('id', req.params.id).select().single()
  if (error || !data) return sendError(res, error || new Error('Pedido no encontrado'), 404)
  res.json(data)
})
app.delete('/api/orders/:id', requireRole('admin'), async (req, res) => {
  const { data: order, error: orderError } = await req.db.from('orders').select('id').eq('id', req.params.id).maybeSingle()
  if (orderError) return sendError(res, orderError)
  if (!order) return sendError(res, new Error('Pedido no encontrado'), 404)
  const { data: payments, error: paymentsError } = await req.db.from('payments').select('proof_path').eq('order_id', req.params.id)
  if (paymentsError) return sendError(res, paymentsError)
  const { data, error } = await req.db.from('orders').delete().eq('id', req.params.id).select('id').maybeSingle()
  if (error) return sendError(res, error, error.code === '42501' ? 403 : 400)
  if (!data) return sendError(res, new Error('No se pudo eliminar el pedido. Verifica que la política "admins delete orders" esté habilitada en Supabase.'), 403)
  const paths = payments.map(payment => payment.proof_path)
  if (paths.length) {
    const { error: cleanupError } = await req.db.storage.from('payment-proofs').remove(paths)
    if (cleanupError) {
      console.error('Pedido eliminado, pero no se pudieron borrar todos sus comprobantes:', cleanupError)
      return res.json({ warning: 'El pedido se eliminó, pero no se pudieron borrar sus archivos de comprobante.' })
    }
  }
  res.json({ success: true })
})
app.patch('/api/orders/:id/status', requireRole('admin', 'operator'), async (req, res) => {
  const parsed = z.object({ status: z.enum(['Nuevo', 'Preparando', 'Enviado', 'Entregado']) }).safeParse(req.body)
  if (!parsed.success) return sendError(res, new Error('Estado inválido'))
  const { data, error } = await req.db.from('orders').update({ status: parsed.data.status }).eq('id', req.params.id).select().single()
  if (error || !data) return sendError(res, error || new Error('Pedido no encontrado'), 404)
  res.json(data)
})
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
app.post('/api/orders/:id/payment', requireRole('admin', 'operator'), upload.single('proof'), async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, new Error(parsed.error.issues[0].message))
  if (!req.file) return sendError(res, new Error('Adjunta el comprobante'))
  const allowed = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf', 'image/webp': 'webp' }
  const ext = allowed[req.file.mimetype]
  if (!ext) return sendError(res, new Error('Solo JPG, PNG, WEBP o PDF'))
  const { data: order, error: findErr } = await req.db.from('orders').select('id,organization_id').eq('id', req.params.id).single()
  if (findErr || !order) return sendError(res, new Error('Pedido no encontrado'), 404)
  const path = `${order.organization_id}/${order.id}/${randomUUID()}.${ext}`
  const { error: uploadErr } = await req.db.storage.from('payment-proofs').upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false })
  if (uploadErr) return sendError(res, uploadErr)
  const { data, error } = await req.db.from('payments').insert({ order_id: order.id, organization_id: order.organization_id, method: parsed.data.method, reference: parsed.data.reference, proof_path: path, created_by: req.user.id }).select().single()
  if (error) { await req.db.storage.from('payment-proofs').remove([path]); return sendError(res, error) }
  res.status(201).json(data)
})
app.get('/api/orders/:id/proof', async (req, res) => {
  const { data: order, error: orderErr } = await req.db.from('orders').select('id').eq('id', req.params.id).single()
  if (orderErr || !order) return sendError(res, new Error('Pedido no encontrado'), 404)
  const { data: payments, error } = await req.db.from('payments').select('proof_path').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1)
  if (error || !payments?.length) return sendError(res, new Error('Sin comprobante'), 404)
  const signed = await req.db.storage.from('payment-proofs').createSignedUrl(payments[0].proof_path, 60)
  if (signed.error) return sendError(res, signed.error)
  res.json({ url: signed.data.signedUrl })
})
app.use((req, res) => {
  const route = `${req.method} ${req.path}`
  console.warn(`API route not found: ${route}`)
  res.status(404).json({ error: `Ruta no encontrada: ${route}` })
})
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return sendError(res, new Error('Archivo superior a 5 MB'))
  console.error(err)
  res.status(500).json({ error: 'Error inesperado' })
})
export default app
