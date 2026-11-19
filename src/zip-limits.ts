import type JSZip from 'jszip'

const MiB = 1024 * 1024
export const importLimits = {
  zipBytes: 200 * MiB,
  entries: 10000,
  fileBytes: 128 * MiB,
  totalBytes: 500 * MiB,
  manifestBytes: 2 * MiB,
}

export function validateEntryPath(path: string) {
  if (
    !path ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    path.split('/').some((part) => part === '..' || part === '.')
  )
    throw new Error('O ZIP contém um caminho de arquivo inválido.')
}

// JSZip exposes this documented API, but omits it from JSZipObject's bundled types.
type StreamingEntry = JSZip.JSZipObject & {
  internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array<ArrayBuffer>>
}

export function extractBounded(entry: JSZip.JSZipObject, maxBytes: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = []
    let bytes = 0
    let failed = false
    const stream = (entry as StreamingEntry).internalStream('uint8array')
    stream
      .on('data', (chunk) => {
        if (failed) return
        bytes += chunk.byteLength
        if (bytes > maxBytes) {
          failed = true
          stream.pause()
          chunks.length = 0
          reject(new Error('O conteúdo descompactado excede os limites de importação.'))
          return
        }
        chunks.push(chunk)
      })
      .on('error', (error) => {
        failed = true
        chunks.length = 0
        reject(error)
      })
      .on('end', () => {
        if (!failed) resolve(new Blob(chunks))
      })
      .resume()
  })
}
