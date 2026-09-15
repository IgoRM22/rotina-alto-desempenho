import React, { useEffect, useRef } from 'react'
import { RiCloseLine } from '@remixicon/react'

let openModalCount = 0

export default function Modal({ title, onClose, onSave, children, wide, saveLabel = 'Salvar', saveVariant = 'primary', hideCancel, hideClose }) {
  // No celular, o toque que ABRE o modal (num botão de editar, por exemplo)
  // pode terminar de "disparar" só depois que o overlay já está montado
  // naquela mesma posição na tela — o clique sintético acaba caindo no
  // overlay em vez do botão original, e o "fechar ao clicar fora" fecha o
  // modal na mesma hora que ele abriu (parece que nunca abriu, só escureceu
  // a tela). Ignorar esse fechamento até o modal ficar montado por um
  // instante evita esse toque fantasma.
  const readyRef = useRef(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => { readyRef.current = true })
    return () => cancelAnimationFrame(id)
  }, [])

  // Sem travar o scroll de fundo, no celular focar um campo do modal faz o
  // navegador tentar rolar a PÁGINA DE FUNDO pra "revelar" o input — como o
  // modal é position:fixed isso não move ele, mas some com a referência
  // visual de onde a página estava, dando a impressão de que o modal
  // "desceu". Só bloquear overflow (sem reposicionar o body) evita esse
  // scroll indevido sem o risco de saltos que a técnica de position:fixed
  // + top negativo causa em alguns navegadores mobile.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    openModalCount += 1
    document.body.classList.add('has-modal-open')
    if (openModalCount === 1) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    }

    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.classList.remove('has-modal-open')
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
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
    <div className="modal-overlay" onClick={(e) => { if (readyRef.current && !hideClose && e.target === e.currentTarget) onClose() }}>
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
