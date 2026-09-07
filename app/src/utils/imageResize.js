// Redimensiona e comprime uma imagem no navegador antes de mandar pro
// assistente — uma foto de celular sem tratamento (4000px+, vários MB) custa
// mais tokens no Gemini e é mais lenta de enviar sem ganhar nada de precisão
// de leitura; 1280px já é nítido o suficiente pra OCR de um extrato.
const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.82

export const resizeImageFile = (file) => new Promise((resolve, reject) => {
  const img = new Image()
  const url = URL.createObjectURL(file)

  img.onload = () => {
    URL.revokeObjectURL(url)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const data = dataUrl.split(',')[1] || ''
    resolve({ data, mimeType: 'image/jpeg', previewUrl: dataUrl })
  }

  img.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('não foi possível ler a imagem'))
  }

  img.src = url
})
