import { useCallback, useState } from 'react'

export default function UploadZone({ onUpload, disabled }) {
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback((file) => {
    if (!file) return
    const allowed = ['.pdf', '.txt', '.md']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowed.includes(ext)) {
      alert('Please upload a PDF, TXT, or MD file.')
      return
    }
    onUpload(file)
  }, [onUpload])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const onInputChange = useCallback((e) => {
    handleFile(e.target.files[0])
    e.target.value = ''
  }, [handleFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        position: 'relative',
        background: dragging ? '#f0f4ff' : '#fff',
        border: `2px dashed ${dragging ? '#6366f1' : '#d1d5db'}`,
        borderRadius: 12, padding: '24px 32px', textAlign: 'center',
        cursor: 'pointer', width: 360,
        transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <input
        type="file"
        accept=".pdf,.txt,.md"
        onChange={onInputChange}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
        disabled={disabled}
      />
      <div style={{ fontSize: 28, marginBottom: 8, color: '#aaa' }}>+</div>
      <p style={{ fontSize: 14, fontWeight: 500, color: '#555' }}>Drop file or click to browse</p>
      <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Supports PDF, TXT, and MD files</p>
    </div>
  )
}
