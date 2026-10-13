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
  next()
})
const orderSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  customer_dni: z.string().trim().regex(/^\d{8}$|^\d{11}$/, 'DNI 8 dígitos o RUC 11 dígitos'),
  destination: z.enum(['Lima', 'Shalom', 'Olva']),
  agency: z.string().trim().max(100).default(''),
  address: z.string().trim().min(3).max(250),
  phone: z.string().trim().max(24).default(''),
  amount: z.coerce.number().finite().nonnegative().max(99999999),
})
const paymentSchema = z.object({ method: z.enum(['Yape', 'Plin', 'Transferencia']), reference: z.string().trim().max(100).optional().default('') })
const sendError = (res, error, status = 400) => res.status(status).json({ error: error?.message || 'Error de solicitud' })
app.get('/api/orders', async (req, res) => {
  const destination = req.query.destination
  if (destination && !['Lima', 'Shalom', 'Olva'].includes(destination)) return sendError(res, new Error('Destino inválido'))
  let q = req.db.from('orders').select('*, payments(id,method,reference,proof_path,created_at)').order('created_at', { ascending: false }).limit(250)
  if (destination) q = q.eq('destination', destination)
  const { data, error } = await q
  if (error) return sendError(res, error)
  res.json(data)
})
app.post('/api/orders', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, new Error(parsed.error.issues[0].message))
  const { data: memberships, error: me } = await req.db.from('organization_members').select('organization_id').eq('user_id', req.user.id).limit(1)
  if (me || !memberships?.length) return sendError(res, new Error('No tienes una organización asignada'), 403)
  const { data, error } = await req.db.from('orders').insert({ ...parsed.data, organization_id: memberships[0].organization_id, created_by: req.user.id }).select().single()
  if (error) return sendError(res, error)
  res.status(201).json(data)
})
app.patch('/api/orders/:id/status', async (req, res) => {
  const parsed = z.object({ status: z.enum(['Nuevo', 'Preparando', 'Enviado', 'Entregado']) }).safeParse(req.body)
  if (!parsed.success) return sendError(res, new Error('Estado inválido'))
  const { data, error } = await req.db.from('orders').update({ status: parsed.data.status }).eq('id', req.params.id).select().single()
  if (error || !data) return sendError(res, error || new Error('Pedido no encontrado'), 404)
  res.json(data)
})
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
app.post('/api/orders/:id/payment', upload.single('proof'), async (req, res) => {
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
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return sendError(res, new Error('Archivo superior a 5 MB'))
  console.error(err)
  res.status(500).json({ error: 'Error inesperado' })
})
export default app
