import { type DragEvent, useRef, useState } from 'react'

import type { Course } from '../../domain/course'
import { Icon } from '../../shared/ui/icon'
import { LocalDataBackup } from '../backup/local-data-backup'
import { CourseCard } from './course-card'
import type { LibraryModel } from './use-library'

export function CourseLibrary({
  model,
  onOpen,
}: {
  model: LibraryModel
  onOpen: (course: Course) => void
}) {
  const {
    courses,
    busy,
    catalogError,
    message,
    query,
    setQuery,
    upload,
    removeCourse,
    recover,
    lessonCount,
    summaries,
  } = model
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  function drop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    void upload(event.dataTransfer.files[0])
  }
  return (
    <main className="library mx-auto max-w-[1360px] px-5 pb-12 pt-7 sm:px-9 sm:pt-10">
      <div className="library-intro">
        <section className="hero">
          <div>
            <p className="hero-eyebrow">
              <span /> Sua biblioteca pessoal
            </p>
            <h1 className="display-title hero-title">
              Um espaço para
              <br />
              <em>aprender.</em>
            </h1>
            <p className="hero-description">
              Importe um pacote SCORM para abrir as aulas e acompanhar seu progresso neste
              navegador.
            </p>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{String(courses.length).padStart(2, '0')}</strong>
              <span>{courses.length === 1 ? 'curso na biblioteca' : 'cursos na biblioteca'}</span>
            </div>
            <div>
              <strong>{String(lessonCount).padStart(2, '0')}</strong>
              <span>{lessonCount === 1 ? 'aula disponível' : 'aulas disponíveis'}</span>
            </div>
          </div>
        </section>

        <section
          aria-label="Importar pacote SCORM"
          className="dropzone"
          aria-busy={busy}
          data-dragging={dragging}
          onDragOver={(event) => {
            event.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false)
          }}
          onDrop={drop}
        >
          <span className="upload-icon">
            <Icon name="upload" size={23} />
          </span>
          <div className="min-w-0">
            <h2 className="display-title text-3xl">Seu próximo curso</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Arraste um arquivo ZIP ou selecione um pacote SCORM 1.2 ou 2004 de origem confiável.
            </p>
          </div>
          <input
            ref={input}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            aria-label="Arquivo ZIP do curso"
            onChange={(event) => {
              void upload(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <button
            type="button"
            className="primary-button"
            disabled={busy || Boolean(catalogError)}
            onClick={() => input.current?.click()}
          >
            <Icon name="upload" size={17} /> {busy ? 'Processando…' : 'Selecionar ZIP'}
          </button>
          <span className="import-formats">
            SCORM 1.2 <span aria-hidden="true">/</span> SCORM 2004
          </span>
        </section>
      </div>
      {message && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-surface px-4 py-3 text-sm text-danger">
          {message}
          <LocalDataBackup />
          {catalogError && (
            <button type="button" className="text-button mt-3" onClick={recover}>
              Reiniciar catálogo com cópia de segurança
            </button>
          )}
        </p>
      )}

      <section className="course-section" aria-labelledby="courses-title">
        <div className="course-toolbar">
          <div className="flex items-center gap-3">
            <h2 id="courses-title" className="display-title text-3xl">
              Meus cursos
            </h2>
            <span className="course-count">{courses.length}</span>
          </div>
          {courses.length > 0 && (
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                type="search"
                placeholder="Buscar curso"
                aria-label="Buscar curso"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
        </div>
        {courses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration" aria-hidden="true">
              <Icon name="book" size={56} />
            </div>
            <div className="empty-copy">
              <h3 className="display-title text-3xl">Sua biblioteca começa aqui.</h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                Adicione seu primeiro curso e encontre todas as suas aulas neste espaço.
              </p>
              <button
                type="button"
                className="text-button mt-5"
                disabled={busy || Boolean(catalogError)}
                onClick={() => input.current?.click()}
              >
                Importar primeiro curso <Icon name="arrow" size={18} />
              </button>
            </div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="search-empty">
            <h3 className="display-title text-2xl">Nenhum curso encontrado</h3>
            <p className="mt-2 text-sm text-muted">Tente buscar por outro título.</p>
            <button type="button" className="text-button mt-4" onClick={() => setQuery('')}>
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summaries.map(({ course, progress }) => (
              <CourseCard
                key={course.id}
                course={course}
                progress={progress}
                disabled={busy || Boolean(catalogError)}
                onOpen={() => onOpen(course)}
                onRemove={() => void removeCourse(course)}
              />
            ))}
          </div>
        )}
      </section>
      <footer className="library-footer">
        <span>Aulora · Leitor SCORM</span>
        <LocalDataBackup />
        <span>Seus cursos e seu progresso ficam neste navegador.</span>
      </footer>
    </main>
  )
}
