import React, { useEffect } from 'react'
import { RiCloseLine } from '@remixicon/react'

let openModalCount = 0

export default function Modal({ title, onClose, onSave, children, wide, saveLabel = 'Salvar', hideCancel }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    openModalCount += 1
    document.body.classList.add('has-modal-open')

    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.classList.remove('has-modal-open')
      }
    }
  }, [])

  return (
    <div className="modal-overlay">
      <div className={`modal${wide ? ' modal-wide' : ''}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close btn-icon" onClick={onClose} aria-label="Fechar">
            <RiCloseLine size={18} />
          </button>
        </div>
        {children}
        <div className="modal-actions">
          {!hideCancel && <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>}
          <button className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
