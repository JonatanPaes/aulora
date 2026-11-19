import { type Course, isCourse, isRecord, type Lesson } from '../../domain/course'

export const catalogKey = 'aulora.catalog'
export const progressKey = (course: Course, lesson: Lesson) =>
  `aulora.progress.${course.id}.${lesson.id}`

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

export const sessionKey = (course: Course) => `aulora.session.${course.id}`

export function readSession(course: Course, store: Storage = localStorage) {
  const raw = store.getItem(sessionKey(course))
  if (!raw) return undefined
  const value = JSON.parse(raw)
  if (
    value?.version !== 1 ||
    typeof value.lessonId !== 'string' ||
    !course.lessons.some((lesson) => lesson.id === value.lessonId) ||
    typeof value.accessedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.accessedAt))
  )
    throw new Error('Não foi possível ler a última aula acessada. Os dados foram preservados.')
  return value as { version: 1; lessonId: string; accessedAt: string }
}

export function rememberLesson(course: Course, lessonId: string, store: Storage = localStorage) {
  readSession(course, store)
  store.setItem(
    sessionKey(course),
    JSON.stringify({ version: 1, lessonId, accessedAt: new Date().toISOString() }),
  )
}

export function clearCourseProgress(course: Course, store: Storage = localStorage) {
  for (const lesson of course.lessons) store.removeItem(progressKey(course, lesson))
  store.removeItem(sessionKey(course))
}
