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
