import React, { useRef, useState } from 'react'

const WIDTH = 640
const HEIGHT = 200
const PAD_LEFT = 22
const PAD_RIGHT = 12
const PAD_TOP = 12
const PAD_BOTTOM = 26
const MIN_V = 1
const MAX_V = 5

const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT

function xForIndex(i, n) {
  return PAD_LEFT + (innerWidth * i) / (n - 1)
}

function yForValue(v) {
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  return PAD_TOP + innerHeight * (1 - (v - MIN_V) / (MAX_V - MIN_V))
}

function toSegments(values, n) {
  const points = values.map((v, i) => (v == null ? null : { x: xForIndex(i, n), y: yForValue(v) }))
  const segments = []
  let current = []
  for (const p of points) {
    if (p) current.push(p)
    else if (current.length) { segments.push(current); current = [] }
  }
  if (current.length) segments.push(current)
  return { points, segments }
}

export default function WeekLineChart({ series, xLabels, todayIndex }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const svgRef = useRef(null)
  const n = xLabels.length

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const ratio = ((e.clientX - rect.left) / rect.width) * WIDTH - PAD_LEFT
    const idx = Math.round((ratio / innerWidth) * (n - 1))
    setHoverIndex(Math.min(n - 1, Math.max(0, idx)))
  }

  return (
    <div className="week-chart">
      <div className="week-chart-legend">
        {series.map(s => (
          <span key={s.key} className="week-chart-legend-item">
            <span className="week-chart-legend-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="week-chart-svg"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Sono e energia ao longo da semana"
      >
        {todayIndex >= 0 && (
          <rect
            className="week-chart-today-band"
            x={xForIndex(todayIndex, n) - innerWidth / (n - 1) / 2}
            y={PAD_TOP}
            width={innerWidth / (n - 1)}
            height={HEIGHT - PAD_TOP - PAD_BOTTOM}
          />
        )}

        {[1, 2, 3, 4, 5].map(v => (
          <line key={v} className="week-chart-grid" x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yForValue(v)} y2={yForValue(v)} />
        ))}
        {[1, 3, 5].map(v => (
          <text key={v} className="week-chart-axis-label" x={PAD_LEFT - 6} y={yForValue(v) + 3} textAnchor="end">{v}</text>
        ))}
        {xLabels.map((label, i) => (
          <text key={i} className="week-chart-axis-label" x={xForIndex(i, n)} y={HEIGHT - 8} textAnchor="middle">{label}</text>
        ))}

        {hoverIndex !== null && (
          <line className="week-chart-crosshair" x1={xForIndex(hoverIndex, n)} x2={xForIndex(hoverIndex, n)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} />
        )}

        {series.map(s => {
          const { points, segments } = toSegments(s.values, n)
          return (
            <g key={s.key}>
              {segments.map((seg, si) => (
                <polyline
                  key={si}
                  points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {points.map((p, i) => p && (
                <circle key={i} className="week-chart-dot" cx={p.x} cy={p.y} r={4} style={{ fill: s.color }} />
              ))}
            </g>
          )
        })}
      </svg>

      {hoverIndex !== null && (
        <div className="week-chart-tooltip-row">
          <span className="week-chart-tooltip-day">{xLabels[hoverIndex]}</span>
          {series.map(s => (
            <span key={s.key} className="week-chart-tooltip-item">
              <span className="week-chart-legend-swatch" style={{ background: s.color }} />
              {s.label} <strong>{s.values[hoverIndex] ?? '–'}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
