import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Tabs({ items, active, onChange, variant = 'underline', scroll = false, as }) {
  const wrapClass = variant === 'segmented' ? 'view-toggle' : (scroll ? 'tabs-scroll' : 'tabs')
  const itemClass = variant === 'segmented' ? 'view-btn' : 'tab-btn'

  return (
    <div className={wrapClass}>
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
}
