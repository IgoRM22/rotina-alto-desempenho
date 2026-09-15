import React, { useEffect, useRef } from 'react'
import { FRAME_SIZE, FRAME_COLS, FRAME_ROW, FACE_CROP, BODY_CROP, LEG_TINT_Y, buildLayers } from '../utils/character'

const ROWS_PER_SHEET = 4

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

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16))
}

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}

const hslToRgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

// Substitui matiz+saturação preservando a LUMINOSIDADE original de cada
// pixel — é o que faz um recolorir de verdade pra qualquer cor (multiply só
// escurece, não vira azul/verde/rosa a partir de um sprite ruivo). Cada
// pixel vira "a cor alvo, mas com a mesma luz e sombra que o desenho já
// tinha" — é a técnica de troca de paleta usada de verdade em pixel art.
const colorizeCache = new Map()
const getColorized = (img, hex) => {
  const key = `${img.src}|colorize|${hex}`
  if (colorizeCache.has(key)) return colorizeCache.get(key)

  const [tr, tg, tb] = hexToRgb(hex)
  const [targetH, targetS] = rgbToHsl(tr, tg, tb)

  const off = document.createElement('canvas')
  off.width = img.width
  off.height = img.height
  const octx = off.getContext('2d')
  octx.drawImage(img, 0, 0)
  const imageData = octx.getImageData(0, 0, off.width, off.height)
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const [, , l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
    const [r, g, b] = hslToRgb(targetH, targetS, l)
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
  octx.putImageData(imageData, 0, 0)

  colorizeCache.set(key, off)
  return off
}

// Recolore só as COLUNAS de x onde a calça (o "molde") tem pixel em algum
// ponto do quadro — isso naturalmente exclui o braço (a calça nunca tem
// pixel lá), então esticar essas colunas até o fim do quadro cobre a perna
// de verdade sem pintar a mão/braço junto.
// underlyingImg é o que aparece fora da perna (já pode vir com a cor de pele
// escolhida aplicada); tintSourceImg é sempre a imagem ORIGINAL, usada só
// pra calcular a cor da perna — evita multiplicar a mesma imagem duas vezes
// (pele + calça) e a perna sair escura demais.
const legTintCache = new Map()
// underlyingImg normalmente é um <canvas> (resultado de getTinted com a cor
// de pele) — canvas não tem `.src`, então a chave caía sempre em "canvas"
// pra QUALQUER tom de pele, e o cache devolvia pra sempre o resultado da
// primeira cor escolhida na sessão, ignorando as trocas seguintes. underlyingKey
// carrega o valor que realmente diferencia esse canvas (o tom de pele usado
// pra gerá-lo) pra entrar na chave do cache.
const getLegTinted = (underlyingImg, tintSourceImg, maskImg, tint, yStart, underlyingKey = 'canvas') => {
  const key = `${underlyingImg.src || underlyingKey}|${tintSourceImg.src}|leg|${maskImg.src}|${tint}|${yStart}`
  if (legTintCache.has(key)) return legTintCache.get(key)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = maskImg.width
  maskCanvas.height = maskImg.height
  const mctx = maskCanvas.getContext('2d')
  mctx.drawImage(maskImg, 0, 0)
  const maskData = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data

  const rows = Math.round(tintSourceImg.height / FRAME_SIZE)
  const legColumnsByRow = []
  for (let r = 0; r < rows; r++) {
    const cols = new Array(tintSourceImg.width).fill(false)
    for (let y = r * FRAME_SIZE; y < (r + 1) * FRAME_SIZE; y++) {
      for (let x = 0; x < tintSourceImg.width; x++) {
        if (maskData[(y * maskCanvas.width + x) * 4 + 3] > 40) cols[x] = true
      }
    }
    legColumnsByRow.push(cols)
  }

  const tinted = getTinted(tintSourceImg, tint)

  const off = document.createElement('canvas')
  off.width = tintSourceImg.width
  off.height = tintSourceImg.height
  const octx = off.getContext('2d')
  octx.drawImage(underlyingImg, 0, 0)
  const legH = FRAME_SIZE - yStart
  legColumnsByRow.forEach((cols, r) => {
    const y = r * FRAME_SIZE + yStart
    let runStart = -1
    for (let x = 0; x <= tintSourceImg.width; x++) {
      const isLeg = x < tintSourceImg.width && cols[x]
      if (isLeg && runStart === -1) runStart = x
      if (!isLeg && runStart !== -1) {
        const w = x - runStart
        octx.drawImage(tinted, runStart, y, w, legH, runStart, y, w, legH)
        runStart = -1
      }
    }
  })

  legTintCache.set(key, off)
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

// A folha "walk" já baixada tem 9 quadros de passada por linha (FRAME_COLS)
// — até agora só o quadro 0 (parado) era usado, com um bob de respiração por
// cima. "walk" percorre os 9 quadros de verdade, andando no lugar — pensado
// pro companheiro do Foco (personagem "trabalhando" enquanto o cronômetro
// roda), sem precisar baixar nenhum asset novo pra isso.
const WALK_FRAME_MS = 110

export default function PixelCharacter({ character, level = 1, size = 40, animated = true, motion = 'breathe', variant, className = '' }) {
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const breathingRef = useRef(false)
  const walkFrameRef = useRef(0)

  const resolvedVariant = variant || (size <= FACE_VARIANT_MAX_SIZE ? 'face' : 'full')
  const crop = resolvedVariant === 'face' ? FACE_CROP : BODY_CROP
  const shouldAnimate = animated && size >= MIN_SIZE_TO_ANIMATE
  const isWalking = shouldAnimate && motion === 'walk'

  useEffect(() => {
    let cancelled = false
    const layers = buildLayers(character, level)

    Promise.all(layers.map((l) => Promise.all([
      loadImage(l.src),
      l.legMaskSrc ? loadImage(l.legMaskSrc) : Promise.resolve(null),
    ]).then(([img, maskImg]) => ({ img, maskImg, ...l }))))
      .then((loaded) => {
        if (cancelled) return
        imagesRef.current = loaded.map(({ img, maskImg, tint, colorize, widen, skinTint, legTint }) => {
          let out = img
          if (widen) out = getWidened(out, widen)
          if (skinTint) out = getTinted(out, skinTint)
          if (legTint && maskImg) out = getLegTinted(out, img, maskImg, legTint, LEG_TINT_Y, skinTint || 'none')
          else if (colorize) out = getColorized(out, colorize)
          else if (tint) out = getTinted(out, tint)
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
    const breathPx = (!isWalking && breathingRef.current) ? BREATH_OFFSET_PX * scaleY : 0
    const frameX = isWalking ? walkFrameRef.current * FRAME_SIZE + crop.x : crop.x
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    imagesRef.current.forEach((img) => {
      ctx.drawImage(
        img,
        frameX, FRAME_ROW * FRAME_SIZE + crop.y, crop.w, crop.h,
        0, breathPx, canvas.width, canvas.height,
      )
    })
  }

  useEffect(() => {
    walkFrameRef.current = 0
    draw()
    if (!shouldAnimate) { breathingRef.current = false; return undefined }
    if (isWalking) {
      const id = setInterval(() => {
        walkFrameRef.current = (walkFrameRef.current + 1) % FRAME_COLS
        draw()
      }, WALK_FRAME_MS)
      return () => clearInterval(id)
    }
    const id = setInterval(() => {
      breathingRef.current = !breathingRef.current
      draw()
    }, BREATH_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate, isWalking, resolvedVariant, character, level])

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
