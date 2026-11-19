import { useEffect, useRef, useState } from 'react'

import { Icon } from './icon'
import { LocalDataBackup } from './local-data-backup'
import { type Course, courseUrl, preparePlayer } from './packages'
import { bindPersistence } from './persistence'
import { createRuntime } from './runtime'
import { isComplete, progressKey, readProgress, recoverProgress, writeProgress } from './storage'

type RuntimeWindow = Window & {
  API?: ReturnType<typeof createRuntime>['scorm12']
  API_1484_11?: ReturnType<typeof createRuntime>['scorm2004']
}

export function Player({
  course,
  onClose,
  canLeave,
}: {
  course: Course
  onClose: () => void
  canLeave: { current: () => boolean }
}) {
  const [selection, setSelection] = useState({ index: 0 })
  const active = selection.index
  const [message, setMessage] = useState('')
  const [invalidProgress, setInvalidProgress] = useState('')
  const [, setProgressRevision] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const runtimeRef = useRef<ReturnType<typeof createRuntime> | null>(null)
  const lesson = course.lessons[active]

  useEffect(() => {
    const lesson = course.lessons[selection.index]
    const target = frame.current
    if (!target) return
    let live = true
    const host = window as RuntimeWindow
    const key = progressKey(course, lesson)
    let saved: Record<string, string>
    try {
      saved = readProgress(key)
    } catch (error) {
      setInvalidProgress(key)
      setMessage(error instanceof Error ? error.message : 'Não foi possível ler o progresso.')
      return
    }
    const runtime = createRuntime(
      saved,
      (data) => {
        try {
          writeProgress(key, data)
          if (live) setProgressRevision((revision) => revision + 1)
          return true
        } catch {
          if (live) setMessage('Não foi possível salvar o progresso neste navegador.')
          return false
        }
      },
      course.version === 'SCORM 2004',
    )

    runtimeRef.current = runtime
    canLeave.current = runtime.flush
    const stopPersistence = bindPersistence(runtime)

    preparePlayer()
      .then(() => {
        if (!live) return
        host.API = runtime.scorm12
        host.API_1484_11 = runtime.scorm2004
        target.src = courseUrl(course.id, lesson.path)
      })
      .catch((error: Error) => {
        if (live) setMessage(error.message)
      })

    return () => {
      stopPersistence()
      runtime.flush()
      runtimeRef.current = null
      canLeave.current = () => true
      live = false
      if (host.API === runtime.scorm12) {
        delete host.API
        delete host.API_1484_11
      }
    }
  }, [course, selection, canLeave])

  return (
    <main className="mx-auto max-w-[1480px] px-5 py-7 sm:px-9">
      <button type="button" className="text-button mb-5" onClick={onClose}>
        <Icon name="back" /> Biblioteca
      </button>
      <div className="mb-6">
        <span className="tag">{course.version}</span>
        <h1 className="display-title mt-3 text-3xl sm:text-4xl">{course.title}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-[275px_minmax(0,1fr)]">
        <aside className="lesson-sidebar rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 px-2 text-sm font-bold">Aulas do curso</h2>
          <nav aria-label="Aulas do curso" className="grid gap-1">
            {course.lessons.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="lesson"
                aria-current={active === index ? 'step' : undefined}
                onClick={() => {
                  if (runtimeRef.current?.flush() === false) return
                  setInvalidProgress('')
                  setMessage('')
                  setSelection({ index })
                }}
              >
                <Icon name={isComplete(progressKey(course, item)) ? 'check' : 'play'} size={16} />
                <span>{item.title}</span>
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-line px-4">
            <h2 className="font-semibold">{lesson.title}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Tela cheia"
              title="Tela cheia"
              onClick={() => {
                frame.current
                  ?.requestFullscreen()
                  .catch(() => setMessage('O navegador não abriu a tela cheia.'))
              }}
            >
              <Icon name="expand" />
            </button>
          </div>
          {message && (
            <p role="alert" className="px-4 py-3 text-sm text-danger">
              {message}
              <LocalDataBackup />
              {invalidProgress && (
                <button
                  type="button"
                  className="text-button mt-3"
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Reiniciar o progresso desta aula? Uma cópia dos dados originais será mantida.',
                      )
                    )
                      return
                    try {
                      recoverProgress(invalidProgress)
                      setInvalidProgress('')
                      setMessage('')
                      setSelection((current) => ({ ...current }))
                    } catch {
                      setMessage(
                        'Não foi possível criar a cópia de segurança. Os dados originais foram mantidos.',
                      )
                    }
                  }}
                >
                  Reiniciar progresso com cópia de segurança
                </button>
              )}
            </p>
          )}
          <iframe
            key={lesson.id}
            ref={frame}
            title={lesson.title}
            allowFullScreen
            className="block h-[70vh] min-h-[400px] w-full bg-white"
          />
        </section>
      </div>
    </main>
  )
}
