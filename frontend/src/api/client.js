const rawBase = import.meta.env.VITE_API_BASE_URL || '/api'
const BASE = rawBase.replace(/\/+$/, '')

export async function uploadDocument(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/documents/upload`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function pollStatus(docId) {
  const res = await fetch(`${BASE}/documents/${docId}/status`)
  if (!res.ok) throw new Error('Status check failed')
  return res.json()
}

export async function fetchGraph(docId) {
  const res = await fetch(`${BASE}/graph/${docId}`)
  if (!res.ok) throw new Error('Failed to load graph')
  return res.json()
}

export async function queryGraph(docId, question) {
  const res = await fetch(`${BASE}/query/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: docId, question }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Query failed')
  }
  return res.json()
}

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents/`)
  if (!res.ok) return []
  return res.json()
}

export function exportGraphUrl(docId) {
  return `${BASE}/graph/${docId}/export`
}
