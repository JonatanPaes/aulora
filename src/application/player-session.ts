import type { Course, Lesson } from '../domain/course'
import { createRuntime, type RuntimeSnapshot } from '../domain/scorm/runtime'
import { prepareLessonUrl } from '../infrastructure/scorm/course-assets'
import { bindPersistence } from '../infrastructure/scorm/page-persistence'
import { exposeRuntime } from '../infrastructure/scorm/runtime-host'
import {
  progressKey,
  readProgress,
  recoverProgress,
  rememberLesson,
  writeProgress,
} from '../infrastructure/storage/course-repository'

export function startPlayerSession(
  course: Course,
  lesson: Lesson,
  callbacks: {
    onProgress: () => void
    onDiagnostics: (snapshot: RuntimeSnapshot) => void
    onError: (message: string) => void
  },
) {
  const key = progressKey(course, lesson)
  const saved = readProgress(key)
  let live = true
  let removeRuntime: (() => void) | undefined
  const runtime = createRuntime(
    saved,
    (data) => {
      try {
        writeProgress(key, data)
        if (live) callbacks.onProgress()
        return true
      } catch {
        if (live) callbacks.onError('Não foi possível salvar o progresso neste navegador.')
        return false
      }
    },
    course.version === 'SCORM 2004',
    (snapshot) => {
      if (live) callbacks.onDiagnostics(snapshot)
    },
  )
  callbacks.onDiagnostics(runtime.snapshot())
  const stopPersistence = bindPersistence(runtime)

  const ready = prepareLessonUrl(course, lesson).then((url) => {
    if (!live) return undefined
    removeRuntime = exposeRuntime(runtime)
    try {
      rememberLesson(course, lesson.id)
    } catch {
      callbacks.onError(
        'A aula abriu, mas não foi possível registrar a última aula acessada. Seus dados anteriores foram preservados.',
      )
    }
    return url
  })

  return {
    ready,
    flush: runtime.flush,
    dispose() {
      live = false
      stopPersistence()
      runtime.flush()
      removeRuntime?.()
    },
  }
}

export function resetLessonProgress(course: Course, lesson: Lesson) {
  recoverProgress(progressKey(course, lesson))
}
