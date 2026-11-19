import { useEffect, useRef, useState } from 'react'

import { courseProgress } from '../../application/get-course-progress'
import { resetLessonProgress, startPlayerSession } from '../../application/player-session'
import type { Course } from '../../domain/course'
import type { RuntimeSnapshot } from '../../domain/scorm/runtime'

export function usePlayerSession(course: Course, canLeave: { current: () => boolean }) {
  const [selection, setSelection] = useState(() => ({ index: courseProgress(course).nextIndex }))
  const [message, setMessage] = useState('')
  const [invalidProgress, setInvalidProgress] = useState(false)
  const [diagnostics, setDiagnostics] = useState<RuntimeSnapshot | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [, setRevision] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const session = useRef<ReturnType<typeof startPlayerSession> | null>(null)
  const active = selection.index
  const lesson = course.lessons[active]

  useEffect(() => {
    const target = frame.current
    if (!target) return
    let live = true
    setLoaded(false)
    setDiagnostics(null)
    try {
      const current = startPlayerSession(course, course.lessons[selection.index], {
        onProgress: () => setRevision((value) => value + 1),
        onDiagnostics: setDiagnostics,
        onError: setMessage,
      })
      session.current = current
      canLeave.current = current.flush
      current.ready
        .then((url) => {
          if (live && url) target.src = url
        })
        .catch((error: unknown) => {
          if (live)
            setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a aula.')
        })
      return () => {
        live = false
        current.dispose()
        session.current = null
        canLeave.current = () => true
      }
    } catch (error) {
      setInvalidProgress(true)
      setMessage(error instanceof Error ? error.message : 'Não foi possível ler o progresso.')
    }
  }, [course, selection, canLeave])

  function selectLesson(index: number) {
    if (session.current?.flush() === false) return
    setInvalidProgress(false)
    setMessage('')
    setSelection({ index })
  }

  function recoverLesson() {
    if (
      !window.confirm(
        'Reiniciar o progresso desta aula? Uma cópia dos dados originais será mantida.',
      )
    )
      return
    try {
      resetLessonProgress(course, lesson)
      setInvalidProgress(false)
      setMessage('')
      setSelection((current) => ({ ...current }))
    } catch {
      setMessage('Não foi possível criar a cópia de segurança. Os dados originais foram mantidos.')
    }
  }

  function requestFullscreen() {
    frame.current
      ?.requestFullscreen()
      .catch(() => setMessage('O navegador não abriu a tela cheia.'))
  }

  function markLoaded() {
    if (frame.current?.getAttribute('src')) setLoaded(true)
  }

  return {
    active,
    lesson,
    frame,
    message,
    invalidProgress,
    diagnostics,
    loaded,
    progress: courseProgress(course),
    selectLesson,
    recoverLesson,
    requestFullscreen,
    markLoaded,
  }
}
