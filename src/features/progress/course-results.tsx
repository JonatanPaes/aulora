import type { CourseProgress } from '../../domain/course-progress'

export function CourseResults({ title, progress }: { title: string; progress: CourseProgress }) {
  return (
    <details className="course-results">
      <summary>Resultados por aula</summary>
      <p className="text-xs text-muted mt-3">
        Notas e aprovação são informadas pelo curso. O percentual considera as aulas concluídas.
      </p>
      <div className="results-scroll">
        <table>
          <caption className="sr-only">Resultados de {title}</caption>
          <thead>
            <tr>
              <th scope="col">Aula</th>
              <th scope="col">Conclusão</th>
              <th scope="col">Nota</th>
              <th scope="col">Aprovação</th>
            </tr>
          </thead>
          <tbody>
            {progress.lessons.map((lesson) => (
              <tr key={lesson.id}>
                <th scope="row">{lesson.title}</th>
                <td>{lesson.invalid ? 'Dados inválidos' : lesson.completion}</td>
                <td>{lesson.score}</td>
                <td>{lesson.success}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
