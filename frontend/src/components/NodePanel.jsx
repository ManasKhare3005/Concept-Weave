const TYPE_LABELS = {
  PERSON:  { color: '#2563eb', bg: '#eff6ff' },
  ORG:     { color: '#0d9488', bg: '#f0fdfa' },
  GPE:     { color: '#d97706', bg: '#fffbeb' },
  CONCEPT: { color: '#7c3aed', bg: '#f5f3ff' },
  default: { color: '#6b7280', bg: '#f9fafb' },
}

function parseSummary(summary) {
  if (!summary) return []
  // Try splitting by newlines first
  let lines = summary.split('\n').map(l => l.trim()).filter(Boolean)
  let bullets = lines.filter(l => /^[•\-\*]/.test(l)).map(l => l.replace(/^[•\-\*]\s*/, ''))
  if (bullets.length >= 2) return bullets
  // Handle all on one line separated by •
  const parts = summary.split(/\s*[•]\s*/).map(s => s.trim()).filter(s => s.length > 5)
  if (parts.length >= 2) return parts
  // Fallback: split by sentences
  return summary.split(/\.\s+/).filter(s => s.length > 8).map(s => s.replace(/\.$/, ''))
}

function BulletText({ text }) {
  // Render **bold** markers as <strong>
  const parts = text.split(/(\*\*.+?\*\*)/)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: '#1a1a1a', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}

export default function NodePanel({ node, onClose }) {
  if (!node) return null
  const tc = TYPE_LABELS[node.entity_type] || TYPE_LABELS.default
  const bullets = parseSummary(node.summary)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, margin: 0 }}>
          {node.label}
        </h2>
        <button
          onClick={onClose}
          style={{
            color: '#aaa', background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Entity type badge */}
      <span style={{
        alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, padding: '3px 10px',
        borderRadius: 99, background: tc.bg, color: tc.color,
      }}>
        {node.entity_type}
      </span>

      {/* Summary as bullet points */}
      {bullets.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
              <BulletText text={b} />
            </li>
          ))}
        </ul>
      )}

      {/* Info section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', marginBottom: 10 }}>
          <span>ⓘ</span> <span style={{ fontWeight: 500 }}>Info</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          {node.cluster !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>Cluster</span>
              <span style={{ color: '#333' }}>{parseInt(node.cluster) + 1}</span>
            </div>
          )}
          {node.excerpts && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>Excerpts</span>
              <span style={{ color: '#333' }}>{node.excerpts.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Source excerpts */}
      {node.excerpts?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#999', marginBottom: 10 }}>
            Source excerpts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {node.excerpts.slice(0, 3).map((ex, i) => (
              <blockquote key={i} style={{
                borderLeft: '3px solid #e5e7eb', paddingLeft: 12,
                fontSize: 13, color: '#666', lineHeight: 1.7, margin: 0,
              }}>
                {ex.length > 250 ? ex.slice(0, 248) + '…' : ex}
              </blockquote>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
