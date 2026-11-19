import type { Course } from '../../domain/course'
import type { CourseProgress } from '../../domain/course-progress'
import { Icon } from '../../shared/ui/icon'
import { CourseResults } from '../progress/course-results'

export function CourseCard({
  course,
  progress,
  disabled,
  onOpen,
  onRemove,
}: {
  course: Course
  progress: CourseProgress
  disabled: boolean
  onOpen: () => void
  onRemove: () => void
}) {
  const completed = progress.completed
  return (
    <article className="course-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="tag">{course.version}</span>
        <button
          type="button"
          className="icon-button"
          disabled={disabled}
          aria-label={`Remover ${course.title}`}
          onClick={onRemove}
        >
          <Icon name="trash" size={17} />
        </button>
      </div>
      <div className="course-book">
        <Icon name="book" size={28} />
      </div>
      <h3 className="display-title course-title">{course.title}</h3>
      <div className="mt-auto pt-5">
        <div className="course-progress-heading">
          <strong>
            {progress.percent}
            <span>%</span>
          </strong>
          <span className="tag">
            {progress.finished ? 'Concluído' : progress.started ? 'Em andamento' : 'Não iniciado'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {completed} de {course.lessons.length}{' '}
            {course.lessons.length === 1 ? 'aula concluída' : 'aulas concluídas'}
          </p>
        </div>
        <progress
          className="mb-5 mt-3 w-full"
          aria-label="Aulas concluídas"
          value={completed}
          max={course.lessons.length}
        />
        <p className="course-resume-label">
          {progress.finished
            ? 'Última aula acessada'
            : progress.started
              ? 'Continue com'
              : 'Primeira aula'}
        </p>
        <p className="course-resume-title">{course.lessons[progress.nextIndex].title}</p>
        {progress.accessedAt && (
          <p className="text-xs text-muted mb-4">
            Último acesso em{' '}
            {new Date(progress.accessedAt).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        )}
        {progress.sessionError && (
          <p className="text-xs text-danger mb-3">Não foi possível ler a última aula acessada.</p>
        )}
        {progress.lessons.some((lesson) => lesson.invalid) && (
          <p className="text-xs text-danger mb-3">
            Há progresso inválido. Abra o curso para recuperar os dados.
          </p>
        )}
        {(progress.scored > 0 || progress.passed > 0 || progress.failed > 0) && (
          <p className="text-xs text-muted mb-4">
            {progress.scored} com nota · {progress.passed} aprovadas · {progress.failed} reprovadas
          </p>
        )}
        <button type="button" className="course-open" onClick={onOpen}>
          {progress.finished
            ? 'Revisar curso'
            : progress.started
              ? 'Continuar curso'
              : 'Começar curso'}{' '}
          <Icon name="arrow" size={18} />
        </button>
        <CourseResults title={course.title} progress={progress} />
      </div>
    </article>
  )
}
