import type { Course, Lesson } from './course'

export interface CourseSession {
  version: 1
  lessonId: string
  accessedAt: string
}
export type LessonProgress = Lesson & ReturnType<typeof lessonResult> & { invalid: boolean }
export type CourseProgress = ReturnType<typeof summarizeCourse>

function number(value: string | undefined) {
  if (!value?.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const formatNumber = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })

export function lessonResult(data: Record<string, string>, is2004: boolean) {
  const status = data[is2004 ? 'cmi.completion_status' : 'cmi.core.lesson_status']
  const success = data[is2004 ? 'cmi.success_status' : 'cmi.core.lesson_status']
  const completed = is2004
    ? status === 'completed'
    : ['completed', 'passed', 'failed'].includes(status)
  const started = Object.keys(data).length > 0 && status !== 'not attempted'
  const prefix = is2004 ? 'cmi.score' : 'cmi.core.score'
  const raw = number(data[`${prefix}.raw`])
  const min = number(data[`${prefix}.min`])
  const max = number(data[`${prefix}.max`])
  const scaled = number(data['cmi.score.scaled'])
  let score = 'Não informada'
  if (raw !== undefined) {
    score = formatNumber(raw)
    if (max !== undefined && (min === undefined || min === 0)) score += ` de ${formatNumber(max)}`
    else if (min !== undefined || max !== undefined)
      score += ` (mín. ${min === undefined ? 'não informado' : formatNumber(min)}; máx. ${max === undefined ? 'não informado' : formatNumber(max)})`
  } else if (is2004 && scaled !== undefined && scaled >= -1 && scaled <= 1)
    score = `${formatNumber(scaled)} (escala de -1 a 1)`
  return {
    completed,
    started,
    completion: completed ? 'Concluída' : started ? 'Em andamento' : 'Não iniciada',
    success:
      success === 'passed' ? 'Aprovada' : success === 'failed' ? 'Reprovada' : 'Não informada',
    score,
  }
}

export function summarizeCourse(
  course: Course,
  lessonProgress: LessonProgress[],
  session?: CourseSession,
  sessionError = false,
) {
  const lessons = lessonProgress.map((lesson) => ({ ...lesson }))
  const completed = lessons.filter((lesson) => lesson.completed).length
  const lastIndex = lessons.findIndex((lesson) => lesson.id === session?.lessonId)
  if (lastIndex >= 0 && !lessons[lastIndex].invalid && !lessons[lastIndex].started) {
    lessons[lastIndex].started = true
    if (!lessons[lastIndex].completed) lessons[lastIndex].completion = 'Em andamento'
  }
  let nextIndex = Math.max(lastIndex, 0)
  if (lastIndex < 0 || lessons[nextIndex].completed) {
    const pending = lessons.findIndex((lesson) => !lesson.completed)
    if (pending >= 0) nextIndex = pending
  }
  return {
    lessons,
    completed,
    nextIndex,
    sessionError,
    percent: Math.round((completed / course.lessons.length) * 100),
    started: Boolean(session) || lessons.some((lesson) => lesson.started),
    finished: completed === course.lessons.length,
    lastLesson: lastIndex >= 0 ? lessons[lastIndex] : undefined,
    accessedAt: session?.accessedAt,
    scored: lessons.filter((lesson) => lesson.score !== 'N\u00e3o informada').length,
    passed: lessons.filter((lesson) => lesson.success === 'Aprovada').length,
    failed: lessons.filter((lesson) => lesson.success === 'Reprovada').length,
  }
}
