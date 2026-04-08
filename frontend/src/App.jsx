import { useState, useCallback, useEffect } from 'react'
import GraphCanvas from './components/GraphCanvas'
import UploadZone from './components/UploadZone'
import NodePanel from './components/NodePanel'
import QueryChat from './components/QueryChat'
import {
  uploadDocument,
  pollStatus,
  fetchGraph,
  queryGraph,
  fetchConceptDetails,
  exportGraphUrl,
} from './api/client'

const STATUS_META = {
  idle: { label: 'Ready For Upload', bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  uploading: { label: 'Uploading', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  processing: { label: 'Processing', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  ready: { label: 'Graph Ready', bg: '#dcfce7', color: '#166534', border: '#86efac' },
  error: { label: 'Needs Attention', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
}

const headerStatPill = {
  fontSize: 12,
  color: '#374151',
  background: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: 999,
  padding: '4px 10px',
  fontWeight: 600,
}

export default function App() {
  const [docId, setDocId] = useState(null)
  const [filename, setFilename] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [highlightIds, setHighlightIds] = useState([])
  const [loadingNodeDetailsId, setLoadingNodeDetailsId] = useState(null)

  useEffect(() => {
    if (!docId || status !== 'processing') return
    const interval = setInterval(async () => {
      try {
        const { status: s } = await pollStatus(docId)
        if (s === 'ready') {
          clearInterval(interval)
          const data = await fetchGraph(docId)
          setGraphData(data)
          setStatus('ready')
        } else if (s === 'error') {
          clearInterval(interval)
          setStatus('error')
          setErrorMsg('Pipeline failed. Check backend logs.')
        }
      } catch (e) {
        clearInterval(interval)
        setStatus('error')
        setErrorMsg(e.message)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [docId, status])

  const handleUpload = useCallback(async (file) => {
    setStatus('uploading')
    setErrorMsg('')
    setGraphData(null)
    setSelectedNode(null)
    setHighlightIds([])
    setLoadingNodeDetailsId(null)
    try {
      const { document_id, filename: fn } = await uploadDocument(file)
      setDocId(document_id)
      setFilename(fn)
      setStatus('processing')
    } catch (e) {
      setStatus('error')
      setErrorMsg(e.message)
      setLoadingNodeDetailsId(null)
    }
  }, [])

  const handleQuery = useCallback(async (question) => {
    const res = await queryGraph(docId, question)
    setHighlightIds(res.relevant_nodes || [])
    return res
  }, [docId])

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    setHighlightIds([node.id])
    if (node.details) return

    setLoadingNodeDetailsId(node.id)
    fetchConceptDetails(node.id)
      .then((enriched) => {
        setGraphData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            nodes: prev.nodes.map((n) => (
              n.id === node.id
                ? { ...n, summary: enriched.summary || n.summary, details: enriched.details || n.details }
                : n
            )),
          }
        })

        setSelectedNode((prev) => {
          if (!prev || prev.id !== node.id) return prev
          return {
            ...prev,
            summary: enriched.summary || prev.summary,
            details: enriched.details || prev.details,
            details_error: null,
          }
        })
      })
      .catch((e) => {
        setSelectedNode((prev) => {
          if (!prev || prev.id !== node.id) return prev
          return { ...prev, details_error: e.message }
        })
      })
      .finally(() => {
        setLoadingNodeDetailsId((prev) => (prev === node.id ? null : prev))
      })
  }, [])

  const handleReset = useCallback(() => {
    setDocId(null)
    setFilename(null)
    setGraphData(null)
    setStatus('idle')
    setErrorMsg('')
    setSelectedNode(null)
    setHighlightIds([])
    setLoadingNodeDetailsId(null)
  }, [])

  const showSidebar = status === 'ready'
  const statusMeta = STATUS_META[status] || STATUS_META.idle

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e8e8e8' }}>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '10px 16px',
          background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
          borderBottom: '1px solid #d1d5db',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 300px', minWidth: 220 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: '#1f2937',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            CW
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: 0.7 }}>
              CONCEPTWEAVE
            </span>
            <span
              title={filename || ''}
              style={{
                fontSize: 13,
                color: '#111827',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '56vw',
              }}
            >
              {filename || 'Upload a PDF, TXT, or MD document to build a graph'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${statusMeta.border}`,
              background: statusMeta.bg,
              color: statusMeta.color,
              fontWeight: 700,
            }}
          >
            {statusMeta.label}
          </span>

          {status === 'ready' && graphData && (
            <>
              <span style={headerStatPill}>{graphData.nodes.length} concepts</span>
              <span style={headerStatPill}>{graphData.links.length} edges</span>
            </>
          )}

          {status === 'processing' && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Extracting concepts and generating relationships...
            </span>
          )}

          {status === 'error' && errorMsg && (
            <span
              title={errorMsg}
              style={{
                fontSize: 12,
                color: '#b91c1c',
                maxWidth: 320,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {errorMsg}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button
            onClick={handleReset}
            disabled={status === 'uploading'}
            style={{
              fontSize: 12,
              color: '#374151',
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
              opacity: status === 'uploading' ? 0.5 : 1,
            }}
          >
            New Document
          </button>

          {status === 'ready' && docId && (
            <a
              href={exportGraphUrl(docId)}
              download
              style={{
                fontSize: 12,
                color: '#fff',
                textDecoration: 'none',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #1f2937',
                background: '#1f2937',
                fontWeight: 600,
              }}
            >
              Export JSON
            </a>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative', background: '#efefef', overflow: 'hidden' }}>
          {status !== 'ready' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
              }}
            >
              {(status === 'idle' || status === 'error') && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                      <circle cx="32" cy="20" r="5" fill="#bbb" />
                      <circle cx="16" cy="46" r="4" fill="#bbb" />
                      <circle cx="48" cy="46" r="4" fill="#bbb" />
                      <line x1="32" y1="25" x2="18" y2="43" stroke="#ccc" strokeWidth="1.5" />
                      <line x1="32" y1="25" x2="46" y2="43" stroke="#ccc" strokeWidth="1.5" />
                      <line x1="20" y1="46" x2="44" y2="46" stroke="#ccc" strokeWidth="1.5" />
                    </svg>
                    <p style={{ fontSize: 15, color: '#999', marginTop: 12 }}>
                      Upload a document to generate your knowledge graph
                    </p>
                  </div>
                  <UploadZone onUpload={handleUpload} disabled={false} />
                  {status === 'error' && (
                    <div
                      style={{
                        fontSize: 13,
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                      }}
                    >
                      {errorMsg || 'Something went wrong'}
                    </div>
                  )}
                </>
              )}
              {status === 'uploading' && (
                <div style={{ fontSize: 14, color: '#888' }}>
                  Uploading...
                </div>
              )}
              {status === 'processing' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>
                    Analyzing document...
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    Extracting concepts and building graph. This takes around 30 seconds.
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'ready' && graphData && (
            <GraphCanvas
              data={graphData}
              onNodeClick={handleNodeClick}
              highlightIds={highlightIds}
            />
          )}

          {status === 'ready' && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                background: 'rgba(246,246,246,0.85)',
                borderTop: '1px solid #e0e0e0',
              }}
            >
              <span style={{ fontSize: 11, color: '#999' }}>
                Scroll to zoom | Drag to pan | Click a card to inspect
              </span>
            </div>
          )}
        </div>

        {showSidebar && (
          <aside
            style={{
              width: 340,
              flexShrink: 0,
              background: '#fff',
              borderLeft: '1px solid #e0e0e0',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999' }}>
                <span><strong style={{ color: '#333' }}>{graphData?.nodes.length}</strong> concepts</span>
                <span><strong style={{ color: '#333' }}>{graphData?.links.length}</strong> edges</span>
              </div>

              {selectedNode ? (
                <NodePanel
                  node={selectedNode}
                  loadingDetails={loadingNodeDetailsId === selectedNode.id}
                  onClose={() => {
                    setSelectedNode(null)
                    setHighlightIds([])
                  }}
                />
              ) : (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  Click a concept card on the canvas to see its details
                </div>
              )}

              <div style={{ borderTop: '1px solid #eee' }} />
              <QueryChat onQuery={handleQuery} disabled={status !== 'ready'} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
