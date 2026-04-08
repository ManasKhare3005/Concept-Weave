const TYPE_LABELS = {
  PERSON: { color: '#2563eb', bg: '#eff6ff' },
  ORG: { color: '#0d9488', bg: '#f0fdfa' },
  GPE: { color: '#d97706', bg: '#fffbeb' },
  CONCEPT: { color: '#7c3aed', bg: '#f5f3ff' },
  default: { color: '#6b7280', bg: '#f9fafb' },
}

function parseSummary(summary) {
  if (!summary) return []
  const lines = summary.split('\n').map((l) => l.trim()).filter(Boolean)
  const bullets = lines.filter((l) => /^[-*]/.test(l)).map((l) => l.replace(/^[-*]\s*/, ''))
  if (bullets.length >= 2) return bullets

  const sentenceFallback = summary
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .map((s) => s.replace(/\.$/, ''))

  return sentenceFallback
}

function parseDetailSections(details) {
  if (!details) return []
  const chunks = details.split(/\n(?=##\s+)/).map((part) => part.trim()).filter(Boolean)
  const sections = []

  for (const chunk of chunks) {
    const lines = chunk.split('\n')
    const headingLine = lines[0] || ''
    const headingMatch = headingLine.match(/^##\s+(.+)/)
    const heading = headingMatch ? headingMatch[1].trim() : 'Details'
    const body = headingMatch ? lines.slice(1).join('\n').trim() : chunk
    if (!body) continue

    const bulletLines = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, '').trim())

    if (bulletLines.length >= 2) {
      sections.push({ heading, bullets: bulletLines, paragraphs: [] })
      continue
    }

    const paragraphs = body
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, ' ').trim())
      .filter(Boolean)

    sections.push({ heading, bullets: [], paragraphs })
  }

  return sections
}

function RichText({ text }) {
  const parts = text.split(/(\*\*.+?\*\*)/)
  return (
    <span>
      {parts.map((part, index) => (
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={index} style={{ color: '#1a1a1a', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
          : <span key={index}>{part}</span>
      ))}
    </span>
  )
}

function DetailSection({ section }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 13, color: '#111', fontWeight: 700 }}>{section.heading}</h3>
      {section.bullets.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {section.bullets.map((bullet, index) => (
            <li key={index} style={{ fontSize: 13, color: '#444', lineHeight: 1.55 }}>
              <RichText text={bullet} />
            </li>
          ))}
        </ul>
      )}
      {section.paragraphs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.6 }}>
              <RichText text={paragraph} />
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NodePanel({ node, onClose, loadingDetails = false }) {
  if (!node) return null

  const typeColor = TYPE_LABELS[node.entity_type] || TYPE_LABELS.default
  const bullets = parseSummary(node.summary)
  const detailSections = parseDetailSections(node.details)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, margin: 0 }}>
          {node.label}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close details"
          style={{
            color: '#888',
            background: 'none',
            fontSize: 12,
            cursor: 'pointer',
            lineHeight: 1,
            flexShrink: 0,
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
          }}
        >
          Close
        </button>
      </div>

      <span
        style={{
          alignSelf: 'flex-start',
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 10px',
          borderRadius: 99,
          background: typeColor.bg,
          color: typeColor.color,
        }}
      >
        {node.entity_type}
      </span>

      {bullets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: '#111', fontWeight: 700 }}>Quick Summary</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bullets.map((bullet, index) => (
              <li key={index} style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
                <RichText text={bullet} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ borderTop: '1px solid #eee' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#111', fontWeight: 700 }}>Deep Dive</div>
        {loadingDetails && (
          <div
            style={{
              fontSize: 13,
              padding: '10px 12px',
              borderRadius: 8,
              background: '#f9fafb',
              color: '#6b7280',
              border: '1px solid #e5e7eb',
            }}
          >
            Generating richer details from the source excerpts...
          </div>
        )}
        {!loadingDetails && detailSections.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {detailSections.map((section, index) => (
              <DetailSection key={`${section.heading}-${index}`} section={section} />
            ))}
          </div>
        )}
        {!loadingDetails && detailSections.length === 0 && (
          <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5 }}>
            No deep details available yet for this concept.
          </div>
        )}
        {node.details_error && (
          <div
            style={{
              fontSize: 12,
              padding: '8px 10px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
            }}
          >
            Could not load deep details: {node.details_error}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #eee' }} />

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10 }}>Info</div>
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

      {node.excerpts?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10 }}>
            Source Excerpts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {node.excerpts.slice(0, 3).map((excerpt, index) => (
              <blockquote
                key={index}
                style={{
                  borderLeft: '3px solid #e5e7eb',
                  paddingLeft: 12,
                  fontSize: 13,
                  color: '#666',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {excerpt.length > 280 ? `${excerpt.slice(0, 278)}...` : excerpt}
              </blockquote>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
