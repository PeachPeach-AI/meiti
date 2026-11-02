export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

export function roundToMultiple(val: number, multiple: number): number {
  return Math.round(val / multiple) * multiple
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function parseXlsxFile(file: File): Promise<string[]> {
  const XLSX = await import('xlsx')
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  return rows.flat().filter((r) => typeof r === 'string' && r.trim().length > 0) as string[]
}

/** 参考图压缩：限制最长边并转 JPEG，避免把十几 MB 的原图塞进生图请求。 */
export function downscaleDataUrl(dataUrl: string, maxSide = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      if (scale === 1 && dataUrl.length < 1_500_000) {
        resolve(dataUrl)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
