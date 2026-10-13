import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null
export async function api(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesión expirada')
  const res = await fetch('/api' + path, {
    ...options,
    headers: { ...(!(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${session.access_token}`, ...options.headers },
  })
  const body = await res.text()
  let data
  try { data = body ? JSON.parse(body) : null }
  catch {
    const detail = body.trim().slice(0, 200)
    throw new Error(`La API respondió texto en vez de JSON (HTTP ${res.status})${detail ? `: ${detail}` : ''}. Revisa Functions/Runtime Logs en Vercel.`)
  }
  if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`)
  return data
}
