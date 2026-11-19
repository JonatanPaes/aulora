import { useState } from 'react'

import type { Course } from '../../domain/course'
import type { RuntimeSnapshot } from '../../domain/scorm/runtime'
import { downloadJson } from '../../shared/lib/download-json'

export function ScormDiagnostics({
  course,
  lessonTitle,
  snapshot,
  loaded,
  message,
}: {
  course: Course
  lessonTitle: string
  snapshot: RuntimeSnapshot | null
  loaded: boolean
  message: string
}) {
  const [exportError, setExportError] = useState('')
  const state =
    snapshot?.state === 'active'
      ? 'Inicializada'
      : snapshot?.state === 'ended'
        ? 'Encerrada'
        : 'Aguardando inicialização'
  const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR')
  return (
    <details className="scorm-diagnostics">
      <summary>Diagnóstico SCORM</summary>
      <dl className="diagnostic-status">
        <div>
          <dt>Conteúdo</dt>
          <dd>{loaded ? 'Carregado' : 'Aguardando carregamento'}</dd>
        </div>
        <div>
          <dt>API do curso</dt>
          <dd>{state}</dd>
        </div>
        <div>
          <dt>Último código SCORM</dt>
          <dd>{snapshot?.error ?? '0'}</dd>
        </div>
        <div>
          <dt>Gravação</dt>
          <dd>
            {snapshot?.dirty
              ? 'Alterações pendentes'
              : snapshot?.lastSavedAt
                ? `Salvo às ${time(snapshot.lastSavedAt)}`
                : 'Nenhuma gravação nesta sessão'}
          </dd>
        </div>
      </dl>
      {message && <p className="text-sm text-danger">{message}</p>}
      {loaded && snapshot?.state === 'new' && (
        <p className="text-sm text-muted">
          A aula abriu, mas ainda não chamou a inicialização da API SCORM.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 my-4">
        <p className="text-xs text-muted">
          Últimos 200 eventos desta aula. Respostas e dados pessoais não são incluídos no registro.
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            try {
              const report = {
                version: 1,
                generatedAt: new Date().toISOString(),
                course: course.title,
                scorm: course.version,
                lesson: lessonTitle,
                loaded,
                message,
                runtime: snapshot,
              }
              downloadJson('aulora-diagnostico-scorm.json', JSON.stringify(report, null, 2))
            } catch {
              setExportError('Não foi possível exportar o diagnóstico.')
            }
          }}
        >
          Exportar diagnóstico
        </button>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Focus enables keyboard scrolling through the event history. */}
      <section className="diagnostic-events" aria-label="Eventos SCORM" tabIndex={0}>
        {!snapshot?.events.length ? (
          <p className="text-sm text-muted">Nenhuma chamada registrada nesta aula.</p>
        ) : (
          <ol>
            {snapshot.events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.time}>{time(event.time)}</time>
                <code>
                  {event.method}
                  {event.field ? ` · ${event.field}` : ''}
                </code>
                <span>
                  {event.result}
                  {event.error !== '0' ? ` · erro ${event.error}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </details>
  )
}
