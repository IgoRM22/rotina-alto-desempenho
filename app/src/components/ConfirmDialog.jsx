import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import Modal from './Modal'

const ConfirmContext = createContext(null)

// Um confirm() só, no estilo visual do resto do app (mesmo Modal escuro
// usado em toda edição), no lugar dos vários window.confirm() espalhados —
// cada navegador desenha esse popup nativo do seu próprio jeito (title bar
// diferente, sem combinar com o tema escuro), então trocar todos por este
// deixa toda confirmação do app com a MESMA cara, sempre.
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const resolverRef = useRef(null)

  // options: { title, confirmLabel, danger } — danger (padrão true) usa o
  // botão vermelho, já que a esmagadora maioria dos usos aqui são exclusões.
  const confirm = useCallback((message, options = {}) => new Promise((resolve) => {
    resolverRef.current = resolve
    setRequest({
      message,
      title: options.title || 'Confirmar',
      confirmLabel: options.confirmLabel || 'Confirmar',
      danger: options.danger !== false,
    })
  }), [])

  const settle = (result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal
          title={request.title}
          onClose={() => settle(false)}
          onSave={() => settle(true)}
          saveLabel={request.confirmLabel}
          saveVariant={request.danger ? 'danger' : 'primary'}
        >
          <p className="confirm-dialog-message">{request.message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}

// const confirmado = await confirm('Excluir X?') — substitui window.confirm.
// Precisa estar dentro de <ConfirmProvider> (montado uma vez em main.jsx).
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>')
  return ctx
}
