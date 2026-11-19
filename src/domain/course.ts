export interface Lesson {
  id: string
  title: string
  path: string
}

export interface Course {
  id: string
  title: string
  version: string
  filename: string
  lessons: Lesson[]
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
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

export function isCourse(value: unknown): value is Course {
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
