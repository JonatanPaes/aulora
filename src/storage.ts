import type { Lesson } from './manifest'
import type { Course } from './packages'

export const catalogKey = 'aulora.catalog'
export const progressKey = (course: Course, lesson: Lesson) =>
  `aulora.progress.${course.id}.${lesson.id}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function isLesson(value: unknown): value is Lesson {
  if (!isRecord(value)) return false
  if (![value.id, value.title, value.path].every((item) => typeof item === 'string' && item))
    return false
  const path = value.path as string
  try {
    const decoded = decodeURIComponent(path.split(/[?#]/)[0])
    return (
      !decoded.startsWith('/') &&
      !decoded.includes('\\') &&
      !decoded.split('/').some((part) => part === '..' || part === '.') &&
      !/^[a-z][a-z0-9+.-]*:/i.test(decoded)
    )
  } catch {
    return false
  }
}

function isCourse(value: unknown): value is Course {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.id) &&
    [value.title, value.filename].every((item) => typeof item === 'string' && item) &&
    ['SCORM', 'SCORM 1.2', 'SCORM 2004'].includes(String(value.version)) &&
    Array.isArray(value.lessons) &&
    value.lessons.length > 0 &&
    value.lessons.every(isLesson) &&
    new Set(value.lessons.map((lesson) => lesson.id)).size === value.lessons.length
  )
}

function read(key: string, fallback: unknown, store: Storage): unknown {
  const raw = store.getItem(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Dados locais inválidos (${key}). Exporte uma cópia antes de recuperar.`)
  }
}

export function readCatalog(store: Storage = localStorage): Course[] {
  const saved = read(catalogKey, [], store)
  // Existing installations stored an unversioned array. Keep that format readable.
  const courses = Array.isArray(saved)
    ? saved
    : isRecord(saved) && saved.version === 1
      ? saved.courses
      : undefined
  if (
    !Array.isArray(courses) ||
    !courses.every(isCourse) ||
    new Set(courses.map((course) => course.id)).size !== courses.length
  )
    throw new Error(
      'Catálogo local inválido ou incompatível. Exporte uma cópia antes de recuperar.',
    )
  return courses
}

export function writeCatalog(courses: Course[], store: Storage = localStorage) {
  readCatalog(store)
  if (
    !courses.every(isCourse) ||
    new Set(courses.map((course) => course.id)).size !== courses.length
  )
    throw new Error('Não foi possível validar o catálogo.')
  store.setItem(catalogKey, JSON.stringify({ version: 1, courses }))
}

export function readProgress(key: string, store: Storage = localStorage): Record<string, string> {
  const value = read(key, {}, store)
  if (!isRecord(value) || !Object.values(value).every((item) => typeof item === 'string'))
    throw new Error('Progresso local inválido. Os dados originais foram preservados.')
  return value as Record<string, string>
}

export function writeProgress(
  key: string,
  value: Record<string, string>,
  store: Storage = localStorage,
) {
  readProgress(key, store)
  store.setItem(key, JSON.stringify(value))
}

export function isComplete(key: string) {
  try {
    const data = readProgress(key)
    return (
      ['completed', 'passed', 'failed'].includes(data['cmi.core.lesson_status']) ||
      data['cmi.completion_status'] === 'completed'
    )
  } catch {
    return false
  }
}

export function exportLocalData(store: Storage = localStorage) {
  const data: Record<string, string | null> = {}
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key?.startsWith('aulora.')) data[key] = store.getItem(key)
  }
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
}

export function recoverCatalog(store: Storage = localStorage) {
  const raw = store.getItem(catalogKey)
  if (raw !== null) store.setItem(`aulora.backup.catalog.${crypto.randomUUID()}`, raw)
  store.setItem(catalogKey, JSON.stringify({ version: 1, courses: [] }))
}

export function recoverProgress(key: string, store: Storage = localStorage) {
  const raw = store.getItem(key)
  if (raw !== null) store.setItem(`aulora.backup.progress.${crypto.randomUUID()}`, raw)
  store.setItem(key, '{}')
}
