import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'

const ACCENT_COLORS = [
  '#3b9b74', '#d97706', '#6366f1', '#dc2626',
  '#0891b2', '#7c3aed', '#059669', '#ea580c',
]

function parseBullets(summary) {
  if (!summary) return []
  let lines = summary.split('\n').map(l => l.trim()).filter(Boolean)
  let bullets = lines.filter(l => /^[•\-\*]/.test(l)).map(l => l.replace(/^[•\-\*]\s*/, ''))
  if (bullets.length >= 2) return bullets.slice(0, 5)
  const parts = summary.split(/\s*[•]\s*/).map(s => s.trim()).filter(s => s.length > 5)
  if (parts.length >= 2) return parts.slice(0, 5)
  return summary.split(/\.\s+/).filter(s => s.length > 10).slice(0, 4).map(s => s.replace(/\.$/, ''))
}

function formatText(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a1a;font-weight:700">$1</strong>')
}

function buildSpanningTree(nodes, links) {
  const degree = {}
  nodes.forEach(n => { degree[n.id] = 0 })
  links.forEach(l => {
    degree[l.source?.id ?? l.source] = (degree[l.source?.id ?? l.source] || 0) + 1
    degree[l.target?.id ?? l.target] = (degree[l.target?.id ?? l.target] || 0) + 1
  })
  const rootId = nodes.reduce((best, n) => degree[n.id] > degree[best.id] ? n : best, nodes[0]).id
  const adj = {}
  nodes.forEach(n => { adj[n.id] = [] })
  links.forEach(l => {
    const sid = l.source?.id ?? l.source
    const tid = l.target?.id ?? l.target
    adj[sid].push({ target: tid, link: l })
    adj[tid].push({ target: sid, link: l })
  })
  const visited = new Set([rootId])
  const queue = [rootId]
  const treeEdges = []
  const depth = { [rootId]: 0 }
  while (queue.length > 0) {
    const id = queue.shift()
    const neighbors = adj[id].sort((a, b) => (b.link.weight || 0) - (a.link.weight || 0))
    for (const n of neighbors) {
      if (!visited.has(n.target)) {
        visited.add(n.target)
        queue.push(n.target)
        treeEdges.push(n.link)
        depth[n.target] = depth[id] + 1
      }
    }
  }
  nodes.forEach(n => { if (depth[n.id] === undefined) depth[n.id] = 1 })
  return { treeEdges, depth, rootId }
}

function tint(hex, amount = 0.92) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`
}

function curvedPath(sx, sy, tx, ty) {
  const dx = tx - sx, dy = ty - sy
  const curve = Math.min(Math.abs(dy) * 0.3, 40)
  const cx = (sx + tx) / 2 + (dy > 0 ? curve : -curve)
  const cy = (sy + ty) / 2 - dx * 0.1
  return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`
}

export default function GraphCanvas({ data, onNodeClick, highlightIds = [] }) {
  const svgRef = useRef(null)
  const highlightRef = useRef(highlightIds)
  highlightRef.current = highlightIds

  // Separate effect for highlights only — no graph rebuild
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('rect.card-bg').each(function () {
      const rect = d3.select(this)
      const d = rect.datum()
      if (!d) return
      const accent = ACCENT_COLORS[parseInt(d.cluster || '0') % ACCENT_COLORS.length]
      const isHighlighted = highlightIds.includes(d.id)
      rect
        .attr('stroke', isHighlighted ? accent : '#e8e8e8')
        .attr('stroke-width', isHighlighted ? 2.5 : 1)
    })
  }, [highlightIds])

  // Main graph build — only when data changes
  useEffect(() => {
    if (!data || !data.nodes.length) return
    const el = svgRef.current
    const { width, height } = el.getBoundingClientRect()

    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('viewBox', `0 0 ${width} ${height}`)
    const defs = svg.append('defs')

    // Dot grid
    const dot = defs.append('pattern')
      .attr('id', 'dotgrid').attr('width', 20).attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse')
    dot.append('circle').attr('cx', 10).attr('cy', 10).attr('r', 0.7).attr('fill', '#d0d0d0')

    svg.append('rect').attr('width', width).attr('height', height).attr('fill', '#f7f7f5')
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#dotgrid)')

    // Shadow filters
    const shadow = defs.append('filter').attr('id', 'card-shadow')
      .attr('x', '-8%').attr('y', '-6%').attr('width', '116%').attr('height', '120%')
    shadow.append('feDropShadow')
      .attr('dx', 0).attr('dy', 1).attr('stdDeviation', 4)
      .attr('flood-color', '#000').attr('flood-opacity', 0.06)

    const hoverShadow = defs.append('filter').attr('id', 'card-hover')
      .attr('x', '-10%').attr('y', '-8%').attr('width', '120%').attr('height', '126%')
    hoverShadow.append('feDropShadow')
      .attr('dx', 0).attr('dy', 3).attr('stdDeviation', 8)
      .attr('flood-color', '#000').attr('flood-opacity', 0.1)

    // Arrow marker
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -4 8 8').attr('refX', 8).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-3L8,0L0,3').attr('fill', '#bbb')

    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.15, 3]).on('zoom', (e) => g.attr('transform', e.transform)))

    const { treeEdges, depth, rootId } = buildSpanningTree(data.nodes, data.links)

    // Degree for importance
    const degree = {}
    data.nodes.forEach(n => { degree[n.id] = 0 })
    treeEdges.forEach(l => {
      degree[l.source?.id ?? l.source]++
      degree[l.target?.id ?? l.target]++
    })
    const maxDeg = Math.max(1, ...Object.values(degree))
    const accentOf = (d) => ACCENT_COLORS[parseInt(d.cluster || '0') % ACCENT_COLORS.length]

    // Classify and size nodes
    data.nodes.forEach(d => {
      const deg = degree[d.id] || 0
      const ratio = deg / maxDeg
      d._role = (d.id === rootId || ratio > 0.5) ? 'hub' : (ratio > 0.2 || deg >= 2) ? 'medium' : 'leaf'
      d._bullets = parseBullets(d.summary || d.excerpts?.[0] || '')
      d._depth = depth[d.id] || 0

      // Variable sizes
      if (d._role === 'hub') {
        d._cardW = 300; d._displayBullets = d._bullets.slice(0, 5)
      } else if (d._role === 'medium') {
        d._cardW = 260; d._displayBullets = d._bullets.slice(0, 3)
      } else {
        d._cardW = 220; d._displayBullets = d._bullets.slice(0, 2)
      }

      // Estimate height
      const titleH = d._role === 'hub' ? 28 : 22
      const padY = d._role === 'hub' ? 20 : 14
      let contentH = 0
      if (d._role === 'hub' && d._displayBullets.length > 0) {
        const text = d._displayBullets.join('. ')
        const charsPerLine = Math.floor((d._cardW - 32) / 6.5)
        contentH = Math.ceil(text.length / charsPerLine) * 18 + 8
      } else if (d._displayBullets.length > 0) {
        for (const b of d._displayBullets) {
          const charsPerLine = Math.floor((d._cardW - 44) / 6.2)
          contentH += Math.max(1, Math.ceil(b.replace(/\*\*/g, '').length / charsPerLine)) * 17 + 5
        }
      }
      d._cardH = Math.max(padY + titleH + 4 + contentH + padY, d._role === 'hub' ? 100 : 60)
    })

    // Left-to-right tree layout
    const maxDepth = Math.max(...Object.values(depth))
    const colWidth = Math.max(320, width / (maxDepth + 2))

    const sim = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(treeEdges).id(d => d.id).distance(200).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('x', d3.forceX(d => 150 + d._depth * colWidth).strength(0.4))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .force('collision', d3.forceCollide().radius(d => Math.max(d._cardW, d._cardH) / 2 + 25))
      .stop()

    for (let i = 0; i < 500; i++) sim.tick()

    // ── Links ──
    const linkGroup = g.append('g')
    linkGroup.selectAll('path')
      .data(treeEdges)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#c0c0c0')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrowhead)')
      .attr('d', d => curvedPath(d.source.x, d.source.y, d.target.x, d.target.y))

    // ── Cards ──
    const node = g.append('g').selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('cursor', 'pointer')
      .on('click', (_, d) => onNodeClick(d))
      .on('mouseenter', function () {
        d3.select(this).select('rect.card-bg').attr('filter', 'url(#card-hover)')
      })
      .on('mouseleave', function () {
        d3.select(this).select('rect.card-bg').attr('filter', 'url(#card-shadow)')
      })
      .call(
        d3.drag()
          .on('start', function (e, d) {
            // Pin card in place
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', function (e, d) {
            // Update position — card stays where you put it
            d.x = d.fx = e.x
            d.y = d.fy = e.y
            d3.select(this).attr('transform', `translate(${e.x},${e.y})`)
            // Update connected links only
            linkGroup.selectAll('path').attr('d', l =>
              curvedPath(l.source.x, l.source.y, l.target.x, l.target.y)
            )
          })
          .on('end', function (e, d) {
            // KEEP the position — don't reset fx/fy
            // Card stays exactly where user dropped it
            d.x = e.x
            d.y = e.y
            d.fx = e.x
            d.fy = e.y
          })
      )

    // Card background
    node.append('rect')
      .attr('class', 'card-bg')
      .attr('x', d => -d._cardW / 2).attr('y', d => -d._cardH / 2)
      .attr('width', d => d._cardW).attr('height', d => d._cardH)
      .attr('rx', 8)
      .attr('fill', '#fff')
      .attr('stroke', '#e8e8e8')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#card-shadow)')

    // Hub accent top bar
    node.filter(d => d._role === 'hub').append('rect')
      .attr('x', d => -d._cardW / 2).attr('y', d => -d._cardH / 2)
      .attr('width', d => d._cardW).attr('height', 4)
      .attr('rx', 2)
      .attr('fill', accentOf)
      .attr('opacity', 0.8)

    // HTML content
    node.append('foreignObject')
      .attr('x', d => -d._cardW / 2).attr('y', d => -d._cardH / 2)
      .attr('width', d => d._cardW).attr('height', d => d._cardH)
      .style('pointer-events', 'none')
      .append('xhtml:div')
      .style('padding', d => d._role === 'hub' ? '20px 16px 16px' : '14px 14px 12px')
      .style('font-family', "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif")
      .style('overflow', 'hidden')
      .style('height', '100%')
      .html(d => {
        const accent = accentOf(d)
        let html = ''

        const titleSize = d._role === 'hub' ? '15px' : d._role === 'medium' ? '13.5px' : '12.5px'
        const titleWeight = d._role === 'hub' ? '700' : '600'
        const titleColor = d._role === 'hub' ? '#111' : '#333'
        const mb = d._role === 'hub' ? '10px' : '6px'

        html += `<div style="font-size:${titleSize};font-weight:${titleWeight};color:${titleColor};margin-bottom:${mb};line-height:1.35">${
          d.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        }</div>`

        if (d._role === 'hub' && d._displayBullets.length > 0) {
          // Paragraph with bold keywords
          const para = d._displayBullets.join('. ').replace(/\.\./g, '.')
          html += `<div style="font-size:12px;color:#555;line-height:1.65">${formatText(para)}</div>`
        } else if (d._displayBullets.length > 0) {
          // Compact bullets
          const lis = d._displayBullets.map(b =>
            `<li style="font-size:11.5px;color:#666;line-height:1.5;margin-bottom:3px">${formatText(b)}</li>`
          ).join('')
          html += `<ul style="list-style:none;padding:0;margin:0">${lis}</ul>`
        }

        return html
      })

  }, [data]) // <-- Only rebuild on data change, NOT highlightIds

  return <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
}
