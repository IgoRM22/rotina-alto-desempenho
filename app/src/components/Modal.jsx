import React, { useEffect } from 'react'
import { RiCloseLine } from '@remixicon/react'

let openModalCount = 0

export default function Modal({ title, onClose, onSave, children, wide, saveLabel = 'Salvar', saveVariant = 'primary', hideCancel, hideClose }) {
  // Sem travar o scroll do body, no celular o teclado ao focar um campo do
  // modal faz o navegador rolar a PÁGINA DE FUNDO pra "revelar" o input —
  // como o modal é position:fixed isso não move ele, mas o scroll do fundo
  // some visualmente e o modal parece "ter descido" (na real é a página
  // atrás que rolou pra outro lugar). Travando o body no scroll atual
  // enquanto o modal está aberto evita esse pulo.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    openModalCount += 1
    document.body.classList.add('has-modal-open')
    if (openModalCount === 1) {
      const scrollY = window.scrollY
      document.body.dataset.scrollLockY = String(scrollY)
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
    }

    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.classList.remove('has-modal-open')
        const scrollY = parseInt(document.body.dataset.scrollLockY || '0', 10)
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.width = ''
        delete document.body.dataset.scrollLockY
        window.scrollTo(0, scrollY)
      }
    }
  }, [])

  // Esc e clique fora fecham — mesmo gesto que qualquer pessoa já tenta
  // primeiro num popup, então vale funcionar em todo modal do app de uma vez.
  useEffect(() => {
    if (hideClose) return undefined
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, hideClose])

  return (
    <div className="modal-overlay" onClick={(e) => { if (!hideClose && e.target === e.currentTarget) onClose() }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {!hideClose && (
            <button className="modal-close btn-icon" onClick={onClose} aria-label="Fechar">
              <RiCloseLine size={18} />
            </button>
          )}
        </div>
        {children}
        <div className="modal-actions">
          {!hideCancel && <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>}
          <button className={`btn btn-${saveVariant}`} onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
