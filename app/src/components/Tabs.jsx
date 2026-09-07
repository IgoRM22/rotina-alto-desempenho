import React, { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

export default function Tabs({ items, active, onChange, variant = 'underline', scroll = false, as }) {
  const wrapClass = variant === 'segmented' ? 'view-toggle' : (scroll ? 'tabs-scroll' : 'tabs')
  const itemClass = variant === 'segmented' ? 'view-btn' : 'tab-btn'
  const scrollRef = useRef(null)
  const [fade, setFade] = useState({ left: false, right: false })

  // Sem isso, abas que não cabem na tela (ex: Planejar no mobile) somem sem
  // nenhuma pista de que dá pra arrastar pra ver mais — some acaba nunca
  // descobrindo que Hábitos/Foco/Alimentação existem.
  useEffect(() => {
    if (!scroll) return undefined
    const el = scrollRef.current
    if (!el) return undefined

    const update = () => {
      setFade({
        left: el.scrollLeft > 4,
        right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
      })
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [scroll, items])

  // Sem isso, chegar direto numa aba fora da área visível (ex: abrir Foco
  // pelo link do assistente) deixava a tira de abas parecendo que nenhuma
  // estava selecionada — a ativa ficava escondida fora da tela.
  useEffect(() => {
    if (!scroll) return
    const el = scrollRef.current
    if (!el) return
    const activeBtn = el.querySelector('.active')
    if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroll])

  const list = (
    <div className={wrapClass} ref={scroll ? scrollRef : undefined}>
      {items.map((item) => {
        if (as === 'link') {
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${itemClass} ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          )
        }

        return (
          <button
            key={item.key}
            type="button"
            className={`${itemClass} ${active === item.key ? 'active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )

  if (!scroll) return list

  return (
    <div className="tabs-scroll-wrap">
      {list}
      {fade.left && <div className="tabs-scroll-fade tabs-scroll-fade--left" aria-hidden="true" />}
      {fade.right && <div className="tabs-scroll-fade tabs-scroll-fade--right" aria-hidden="true" />}
    </div>
  )
}
