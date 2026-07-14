import React, { useEffect, useRef, useState } from 'react'

const PIXELS_PER_SECOND = 40

export default function MarqueeText({ text, className = '' }) {
  const trackRef = useRef(null)
  const [overflowing, setOverflowing] = useState(false)
  const [duration, setDuration] = useState(8)

  useEffect(() => {
    const el = trackRef.current
    if (!el || !el.parentElement) return undefined

    const check = () => {
      const isOverflowing = el.scrollWidth > el.parentElement.clientWidth + 1
      setOverflowing(isOverflowing)
      if (isOverflowing) setDuration(Math.max(4, el.scrollWidth / PIXELS_PER_SECOND))
    }
    check()

    const ro = new ResizeObserver(check)
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [text])

  return (
    <span className={`marquee-text ${overflowing ? 'is-overflowing' : ''} ${className}`}>
      <span className="marquee-text-track" ref={trackRef} style={{ '--marquee-duration': `${duration}s` }}>
        <span className="marquee-text-item">{text}</span>
        {overflowing && <span className="marquee-text-item" aria-hidden="true">{text}</span>}
      </span>
    </span>
  )
}
