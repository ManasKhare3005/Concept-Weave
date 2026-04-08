import { useState, useRef, useEffect } from 'react'

export default function QueryChat({ onQuery, disabled }) {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = async () => {
    const q = input.trim()
    if (!q || loading || disabled) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await onQuery(q)
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer, concepts: res.top_concepts }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${err.message}`, error: true }])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const SUGGESTIONS = [
    'What are the main topics?',
    'Which concepts are most connected?',
    'Summarize the key themes.',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#999' }}>Ask the graph</div>

      {messages.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              style={{
                textAlign: 'left', fontSize: 12, color: '#888', padding: '7px 10px',
                borderRadius: 6, background: '#f9fafb', border: '1px solid #eee',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ textAlign: m.role === 'user' ? 'right' : 'left' }}>
              {m.role === 'user' ? (
                <span style={{
                  display: 'inline-block', background: '#eff6ff', color: '#1d4ed8',
                  fontSize: 12, padding: '6px 12px', borderRadius: 10, maxWidth: '90%',
                }}>
                  {m.text}
                </span>
              ) : (
                <div style={{
                  fontSize: 13, lineHeight: 1.7, padding: '8px 12px', borderRadius: 10,
                  background: m.error ? '#fef2f2' : '#f9fafb',
                  color: m.error ? '#dc2626' : '#444',
                  border: `1px solid ${m.error ? '#fecaca' : '#eee'}`,
                }}>
                  {m.text}
                  {m.concepts?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {m.concepts.map((c) => (
                        <span key={c} style={{
                          background: '#f5f3ff', color: '#7c3aed',
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{
              fontSize: 12, padding: '8px 12px', borderRadius: 10,
              background: '#f9fafb', color: '#aaa', border: '1px solid #eee',
            }}>
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about concepts…"
          disabled={disabled || loading}
          style={{
            flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
            padding: '8px 12px', fontSize: 12, color: '#333',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={submit}
          disabled={disabled || loading || !input.trim()}
          style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
            padding: '0 12px', fontSize: 13, cursor: 'pointer', height: 34, flexShrink: 0,
            opacity: (disabled || loading || !input.trim()) ? 0.4 : 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}
