// Document text extraction utilities for browser

function readAsText(file: File, encoding = 'UTF-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsText(file, encoding)
  })
}

async function extractPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href

  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) pages.push(`[페이지 ${i}]\n${text}`)
  }

  if (pages.length === 0) throw new Error('PDF에서 텍스트를 추출할 수 없습니다.')
  return pages.join('\n\n')
}

async function extractExcel(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)

  return wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
    return `[시트: ${name}]\n${csv}`
  }).join('\n\n')
}

async function extractHwpx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(file)
  const texts: string[] = []

  // HWPX: text lives in Contents/section*.xml inside <hp:t> tags
  const entries = Object.entries(zip.files).sort(([a], [b]) => a.localeCompare(b))
  for (const [name, entry] of entries) {
    if (!name.startsWith('Contents/section') || !name.endsWith('.xml')) continue
    const xml = await entry.async('text')

    // Extract text from <hp:t> tags (preferred — preserves actual content)
    const hpMatches = [...xml.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g)]
    if (hpMatches.length > 0) {
      const text = hpMatches
        .map((m) => m[1])
        .join('')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
      if (text) texts.push(text)
    } else {
      // Fallback: strip all tags
      const text = xml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text.length > 10) texts.push(text)
    }
  }

  if (texts.length === 0) throw new Error('HWPX 문서에서 텍스트를 추출할 수 없습니다.')
  return texts.join('\n')
}

async function extractDocx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(file)

  const docXml = await zip.file('word/document.xml')?.async('text')
  if (!docXml) throw new Error('word/document.xml을 찾을 수 없습니다.')

  // Extract text from <w:t> tags (Word's text run elements)
  const matches = [...docXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
  const text = matches
    .map((m) => m[1])
    .join('')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) throw new Error('DOCX에서 텍스트를 추출할 수 없습니다.')
  return text
}

async function extractDoc(file: File): Promise<string> {
  // .doc is OLE CFB binary — use the same CFB parser as HWP
  return extractHwp(file)
}

async function extractHwp(file: File): Promise<string> {
  const [cfbMod, pakoMod] = await Promise.all([import('cfb'), import('pako')])
  // Handle both ESM default and CJS module shapes
  const cfb = ((cfbMod as unknown as { default: unknown }).default ?? cfbMod) as typeof cfbMod
  const pako = ((pakoMod as unknown as { default: unknown }).default ?? pakoMod) as typeof pakoMod

  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)

  // Verify CFB magic: D0 CF 11 E0 A1 B1 1A E1
  const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
  if (!magic.every((b, i) => bytes[i] === b)) {
    throw new Error('올바른 HWP 파일이 아닙니다.')
  }

  const wb = cfb.read(bytes, { type: 'array' })

  // Read HWP FileHeader to check compression flag (bit 0 of DWORD at offset 0x24)
  let compressed = true
  const headerEntry = wb.FileIndex.find((_: unknown, i: number) =>
    (wb.FullPaths[i] as string)?.endsWith('FileHeader')
  ) as { content?: Uint8Array } | undefined
  if (headerEntry?.content && headerEntry.content.length >= 0x28) {
    const flags =
      headerEntry.content[0x24] |
      (headerEntry.content[0x25] << 8) |
      (headerEntry.content[0x26] << 16) |
      (headerEntry.content[0x27] << 24)
    compressed = (flags & 0x1) !== 0
  }

  // Collect BodyText/SectionN streams sorted numerically
  const sections: Array<{ n: number; content: Uint8Array }> = []
  for (let i = 0; i < wb.FileIndex.length; i++) {
    const path = wb.FullPaths[i] as string
    const entry = wb.FileIndex[i] as { content?: Uint8Array }
    const m = path?.match(/BodyText[\\/]Section(\d+)$/)
    if (m && entry?.content?.length) {
      sections.push({ n: parseInt(m[1], 10), content: entry.content })
    }
  }
  sections.sort((a, b) => a.n - b.n)

  const texts: string[] = []
  for (const { content } of sections) {
    let data: Uint8Array | undefined
    if (compressed) {
      try { data = pako.inflate(content) } catch { /* try raw */ }
      if (!data) {
        try { data = pako.inflateRaw(content) } catch { continue }
      }
    } else {
      data = content
    }
    if (!data) continue
    const text = parseHwpRecords(data)
    if (text) texts.push(text)
  }

  if (texts.length === 0) {
    throw new Error('HWP 파일 텍스트 추출에 실패했습니다. HWPX 또는 PDF로 변환 후 업로드해주세요.')
  }
  return texts.join('\n')
}

/** Parse HWP binary records; tag 67 (HWPTAG_PARA_TEXT) holds UTF-16LE paragraph text */
function parseHwpRecords(data: Uint8Array): string {
  const HWPTAG_PARA_TEXT = 67
  const chars: string[] = []
  let i = 0

  while (i + 4 <= data.length) {
    const header = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)
    const tagId = header & 0x3ff
    let size = (header >>> 20) & 0xfff
    i += 4

    if (size === 0xfff) {
      if (i + 4 > data.length) break
      size = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)
      i += 4
    }

    if (i + size > data.length) break

    if (tagId === HWPTAG_PARA_TEXT && size >= 2) {
      for (let j = 0; j + 1 < size; j += 2) {
        const cp = data[i + j] | (data[i + j + 1] << 8)
        if (cp === 0x0d) { chars.push('\n'); continue }
        if (cp < 0x20) continue  // skip control/inline-object codes
        chars.push(String.fromCharCode(cp))
      }
    }

    i += size
  }

  return chars.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// ── Public API ──────────────────────────────────────────────────────────────

export const DOC_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv', 'txt', 'hwp', 'hwpx', 'doc', 'docx']
export const DOC_ACCEPT = '.pdf,.xlsx,.xls,.csv,.txt,.hwp,.hwpx,.doc,.docx'
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

export function getFileKind(file: File): 'image' | 'document' | 'unsupported' {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith('image/')) return 'image'
  if (DOC_EXTENSIONS.includes(ext)) return 'document'
  return 'unsupported'
}

export async function extractDocumentText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  switch (ext) {
    case 'txt':
      return readAsText(file)
    case 'csv': {
      const text = await readAsText(file)
      return `[CSV: ${file.name}]\n${text}`
    }
    case 'pdf':
      return extractPdf(file)
    case 'xlsx':
    case 'xls':
      return extractExcel(file)
    case 'hwpx':
      return extractHwpx(file)
    case 'hwp':
      return extractHwp(file)
    case 'docx':
      return extractDocx(file)
    case 'doc':
      return extractDoc(file)
    default:
      throw new Error(`지원하지 않는 파일 형식: .${ext}`)
  }
}
