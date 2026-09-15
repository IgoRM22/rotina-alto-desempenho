import React from 'react'
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react'

const ICONS = {
  success: RiCheckboxCircleFill,
  error: RiErrorWarningFill,
}

export default function Toast({ msg, type = 'success' }) {
  const Icon = ICONS[type] || ICONS.success
  return (
    <div className="toast-container">
      <div className={`toast ${type}`}>
        <Icon size={16} className="toast-icon" aria-hidden="true" />
        <span>{msg}</span>
      </div>
    </div>
  )
}
