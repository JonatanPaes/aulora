import JSZip from 'jszip'

import type { Course } from '../../domain/course'
import { courseUrl, deleteCourseCache, openCourseCache } from './course-assets'
import { parseManifest } from './manifest-parser'
import { extractBounded, importLimits, validateEntryPath } from './zip-limits'

const contentTypes: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  xhtml: 'application/xhtml+xml',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  txt: 'text/plain',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  vtt: 'text/vtt',
  pdf: 'application/pdf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  wasm: 'application/wasm',
}

export async function importCourse(file: File): Promise<Course> {
  if (!/\.zip$/i.test(file.name)) throw new Error('Selecione um pacote .zip.')
  if (file.size > importLimits.zipBytes) throw new Error('O ZIP excede o limite de 200 MiB.')
  const zip = await JSZip.loadAsync(await file.arrayBuffer()).catch(() => {
    throw new Error('Não foi possível abrir o ZIP. Verifique se o arquivo está íntegro.')
  })
  const allEntries = Object.values(zip.files)
  if (allEntries.length > importLimits.entries)
    throw new Error('O ZIP excede o limite de 10.000 entradas.')
  for (const entry of allEntries) {
    validateEntryPath(entry.unsafeOriginalName ?? entry.name)
    validateEntryPath(entry.name)
  }
  const entries = allEntries.filter((entry) => !entry.dir)
  const manifests = entries.filter((entry) => /(^|\/)imsmanifest\.xml$/i.test(entry.name))
  manifests.sort((a, b) => a.name.split('/').length - b.name.split('/').length)
  const manifest = manifests[0]
  if (!manifest) throw new Error('O ZIP precisa conter o arquivo imsmanifest.xml.')
  const parsed = parseManifest(
    await (await extractBounded(manifest, importLimits.manifestBytes)).text(),
    manifest.name,
    new Set(entries.map((entry) => entry.name)),
  )

  const id = crypto.randomUUID()
  const cache = await openCourseCache(id)

  try {
    let totalBytes = 0
    for (const entry of entries) {
      const blob = await extractBounded(
        entry,
        Math.min(importLimits.fileBytes, importLimits.totalBytes - totalBytes),
      )
      totalBytes += blob.size
      const extension = entry.name.split('.').pop()?.toLowerCase() ?? ''
      const path = entry.name.split('/').map(encodeURIComponent).join('/')
      await cache.put(
        courseUrl(id, path),
        new Response(blob, {
          headers: { 'Content-Type': contentTypes[extension] ?? 'application/octet-stream' },
        }),
      )
    }
  } catch (error) {
    await deleteCourseCache(id)
    if (error instanceof DOMException && error.name === 'QuotaExceededError')
      throw new Error('Não há espaço suficiente no navegador para importar este curso.')
    throw error
  }

  return {
    ...parsed,
    id,
    title: parsed.title || file.name.replace(/\.zip$/i, ''),
    filename: file.name,
    version: parsed.version === 'SCORM' ? 'SCORM' : `SCORM ${parsed.version}`,
  }
}
