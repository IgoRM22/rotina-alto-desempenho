import React from 'react'
import { IMPORTANT_TYPES } from '../utils/importantDates'

export default function CommitmentList({ items }) {
  return (
    <div className="commitment-list">
      {items.map((item, i) => (
        <div key={`${item.id}-${i}`} className="commitment-row">
          <span className={`commitment-badge imp-${item.type || 'importante'}`}>
            {IMPORTANT_TYPES.find(t => t.value === item.type)?.label || 'Data importante'}
          </span>
          <div className="commitment-body">
            <div className="commitment-title">
              {item.title}
              {item.tag && <span className="commitment-tag"> · {item.tag}</span>}
            </div>
            {item.description && <div className="commitment-desc">{item.description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
