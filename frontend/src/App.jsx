import { useState, useCallback, useEffect } from 'react'
import GraphCanvas from './components/GraphCanvas'
import UploadZone from './components/UploadZone'
import NodePanel from './components/NodePanel'
import QueryChat from './components/QueryChat'
import { uploadDocument, pollStatus, fetchGraph, queryGraph, exportGraphUrl } from './api/client'

export default function App() {
  const [docId, setDocId]               = useState(null)
  const [filename, setFilename]         = useState(null)
  const [graphData, setGraphData]       = useState(null)
  const [status, setStatus]             = useState('idle')
  const [errorMsg, setErrorMsg]         = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [highlightIds, setHighlightIds] = useState([])

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
    try {
      const { document_id, filename: fn } = await uploadDocument(file)
      setDocId(document_id)
      setFilename(fn)
      setStatus('processing')
    } catch (e) {
      setStatus('error')
      setErrorMsg(e.message)
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
  }, [])

  const showSidebar = status === 'ready'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e8e8e8' }}>

      {/* ── TOP TOOLBAR ── */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 16px', background: '#f6f6f6',
        borderBottom: '1px solid #ddd',
      }}>
        {/* Window dots */}
        <div style={{ display: 'flex', gap: 6, marginRight: 16 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#27c93f' }} />
        </div>

        {/* Nav arrows */}
        <button style={toolbarBtn}>←</button>
        <button style={toolbarBtn}>→</button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, fontSize: 13, color: '#666' }}>
          <span style={{ color: '#999' }}>Knowledge Graph</span>
          {filename && (
            <>
              <span style={{ color: '#ccc' }}>/</span>
              <span style={{ color: '#333', fontWeight: 500 }}>{filename}</span>
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right toolbar buttons */}
        {status === 'ready' && docId && (
          <a
            href={exportGraphUrl(docId)}
            download
            style={{
              fontSize: 12, color: '#666', textDecoration: 'none', padding: '4px 10px',
              borderRadius: 6, border: '1px solid #ddd', background: '#fff',
            }}
          >
            Export JSON
          </a>
        )}
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── CANVAS ── */}
        <div style={{ flex: 1, position: 'relative', background: '#efefef', overflow: 'hidden' }}>

          {/* Idle / uploading / processing states */}
          {status !== 'ready' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 20,
            }}>
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
                    <p style={{ fontSize: 15, color: '#999', marginTop: 12 }}>Upload a document to generate your knowledge graph</p>
                  </div>
                  <UploadZone
                    onUpload={handleUpload}
                    disabled={false}
                  />
                  {status === 'error' && (
                    <div style={{
                      fontSize: 13, padding: '8px 16px', borderRadius: 8,
                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                    }}>
                      {errorMsg || 'Something went wrong'}
                    </div>
                  )}
                </>
              )}
              {status === 'uploading' && (
                <div style={{ fontSize: 14, color: '#888', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                  Uploading…
                </div>
              )}
              {status === 'processing' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>
                    Analyzing document…
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    Extracting concepts, building graph — this takes ~30 seconds
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Graph */}
          {status === 'ready' && graphData && (
            <GraphCanvas
              data={graphData}
              onNodeClick={handleNodeClick}
              highlightIds={highlightIds}
            />
          )}

          {/* Bottom bar with zoom hint */}
          {status === 'ready' && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px 16px', background: 'rgba(246,246,246,0.85)',
              borderTop: '1px solid #e0e0e0', gap: 16,
            }}>
              <span style={{ fontSize: 11, color: '#999' }}>Scroll to zoom · Drag to pan · Click a card to inspect</span>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        {showSidebar && (
          <aside style={{
            width: 340, flexShrink: 0, background: '#fff',
            borderLeft: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
          }}>
            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Stats summary */}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999' }}>
                <span><strong style={{ color: '#333' }}>{graphData?.nodes.length}</strong> concepts</span>
                <span><strong style={{ color: '#333' }}>{graphData?.links.length}</strong> edges</span>
              </div>

              {/* Selected node detail */}
              {selectedNode ? (
                <NodePanel node={selectedNode} onClose={() => { setSelectedNode(null); setHighlightIds([]) }} />
              ) : (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  Click a concept card on the canvas to see its details
                </div>
              )}

              {/* Divider */}
              <div style={{ borderTop: '1px solid #eee' }} />

              {/* Query */}
              <QueryChat onQuery={handleQuery} disabled={status !== 'ready'} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

const toolbarBtn = {
  background: 'none', border: 'none', fontSize: 16, color: '#999',
  cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
}
