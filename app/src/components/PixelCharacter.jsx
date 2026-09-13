import React, { useEffect, useRef } from 'react'
import { FRAME_SIZE, FRAME_ROW, FACE_CROP, BODY_CROP, buildLayers } from '../utils/character'

const imageCache = new Map()

const loadImage = (src) => {
  if (imageCache.has(src)) return imageCache.get(src)
  const promise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
  imageCache.set(src, promise)
  return promise
}

// Recolorir um sprite (multiply) sem mexer no arquivo original — usado pra
// calça/bota do LPC, que vêm num bege perto demais do tom de pele pra ler
// como "roupa" em tamanho pequeno. Feito uma vez por combinação img+cor e
// guardado em cache — não é refeito a cada frame de animação.
const tintCache = new Map()
const getTinted = (img, tint) => {
  const key = `${img.src}|${tint}`
  if (tintCache.has(key)) return tintCache.get(key)
  const off = document.createElement('canvas')
  off.width = img.width
  off.height = img.height
  const octx = off.getContext('2d')
  octx.drawImage(img, 0, 0)
  octx.globalCompositeOperation = 'multiply'
  octx.fillStyle = tint
  octx.fillRect(0, 0, off.width, off.height)
  octx.globalCompositeOperation = 'destination-in'
  octx.drawImage(img, 0, 0)
  tintCache.set(key, off)
  return off
}

// Alarga cada quadro (em torno do próprio centro) por um fator — usado pra
// calça/bota do LPC, que são mais estreitas que a perna do corpo e sobrava
// pele visível nas laterais.
const widenCache = new Map()
const getWidened = (img, factor) => {
  const key = `${img.src}|widen|${factor}`
  if (widenCache.has(key)) return widenCache.get(key)
  const off = document.createElement('canvas')
  off.width = img.width
  off.height = img.height
  const octx = off.getContext('2d')
  octx.imageSmoothingEnabled = false
  const rows = Math.round(img.height / FRAME_SIZE)
  const cols = Math.round(img.width / FRAME_SIZE)
  const newW = FRAME_SIZE * factor
  const dx0 = (FRAME_SIZE - newW) / 2
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = c * FRAME_SIZE
      const sy = r * FRAME_SIZE
      octx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE, sx + dx0, sy, newW, FRAME_SIZE)
    }
  }
  widenCache.set(key, off)
  return off
}

// "Respirar" de verdade em pixel art é sutil: o corpo inteiro desce 1px na
// fonte e volta, num ciclo lento — não trocar de pose de passada (isso lê
// como andar/mancar, não como estar parado e vivo).
const BREATH_INTERVAL_MS = 650
const BREATH_OFFSET_PX = 1
// Sprite pequeno demais pra um deslocamento de 1px (na fonte de 64px) ser
// perceptível só pisca — melhor ficar parado do que tremer sem sentido.
const MIN_SIZE_TO_ANIMATE = 40
// Abaixo desse tamanho é só uma bolinha — mostrar o corpo inteiro minúsculo
// vira ruído; melhor um "retrato" com zoom no rosto, que se reconhece de longe.
const FACE_VARIANT_MAX_SIZE = 44

export default function PixelCharacter({ character, level = 1, size = 40, animated = true, variant, className = '' }) {
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const breathingRef = useRef(false)

  const resolvedVariant = variant || (size <= FACE_VARIANT_MAX_SIZE ? 'face' : 'full')
  const crop = resolvedVariant === 'face' ? FACE_CROP : BODY_CROP
  const shouldAnimate = animated && size >= MIN_SIZE_TO_ANIMATE

  useEffect(() => {
    let cancelled = false
    const layers = buildLayers(character, level)

    Promise.all(layers.map((l) => loadImage(l.src).then((img) => ({ img, tint: l.tint, widen: l.widen }))))
      .then((loaded) => {
        if (cancelled) return
        imagesRef.current = loaded.map(({ img, tint, widen }) => {
          let out = img
          if (widen) out = getWidened(out, widen)
          if (tint) out = getTinted(out, tint)
          return out
        })
        draw()
      }).catch(() => {})

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, level])

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas || !imagesRef.current.length) return
    const scaleY = canvas.height / crop.h
    const breathPx = breathingRef.current ? BREATH_OFFSET_PX * scaleY : 0
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    imagesRef.current.forEach((img) => {
      ctx.drawImage(
        img,
        crop.x, FRAME_ROW * FRAME_SIZE + crop.y, crop.w, crop.h,
        0, breathPx, canvas.width, canvas.height,
      )
    })
  }

  useEffect(() => {
    draw()
    if (!shouldAnimate) { breathingRef.current = false; return undefined }
    const id = setInterval(() => {
      breathingRef.current = !breathingRef.current
      draw()
    }, BREATH_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate, resolvedVariant, character, level])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`pixel-character ${className}`}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}
