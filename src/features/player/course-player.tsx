import type { Course } from '../../domain/course'
import { Icon } from '../../shared/ui/icon'
import { LocalDataBackup } from '../backup/local-data-backup'
import { ScormDiagnostics } from '../diagnostics/scorm-diagnostics'
import { CourseResults } from '../progress/course-results'
import { usePlayerSession } from './use-player-session'

export function Player({
  course,
  onClose,
  canLeave,
}: {
  course: Course
  onClose: () => void
  canLeave: { current: () => boolean }
}) {
  const {
    active,
    lesson,
    frame,
    message,
    invalidProgress,
    diagnostics,
    loaded,
    progress,
    selectLesson,
    recoverLesson,
    requestFullscreen,
    markLoaded,
  } = usePlayerSession(course, canLeave)
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
                onClick={() => selectLesson(index)}
              >
                <Icon name={progress.lessons[index].completed ? 'check' : 'play'} size={16} />
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
              onClick={requestFullscreen}
            >
              <Icon name="expand" />
            </button>
          </div>
          {message && (
            <p role="alert" className="px-4 py-3 text-sm text-danger">
              {message}
              <LocalDataBackup />
              {invalidProgress && (
                <button type="button" className="text-button mt-3" onClick={recoverLesson}>
                  Reiniciar progresso com cópia de segurança
                </button>
              )}
            </p>
          )}
          <iframe
            key={lesson.id}
            ref={frame}
            title={lesson.title}
            onLoad={markLoaded}
            allowFullScreen
            className="block h-[70vh] min-h-[400px] w-full bg-white"
          />
        </section>
      </div>
      <CourseResults title={course.title} progress={progress} />
      <ScormDiagnostics
        course={course}
        lessonTitle={lesson.title}
        snapshot={diagnostics}
        loaded={loaded}
        message={message}
      />
    </main>
  )
}
