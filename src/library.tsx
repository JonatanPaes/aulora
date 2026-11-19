import { type DragEvent, useRef, useState } from 'react'

import { Icon } from './icon'
import { LocalDataBackup } from './local-data-backup'
import { type Course, importCourse, preparePlayer } from './packages'
import { Player } from './player'
import { isComplete, progressKey, readCatalog, recoverCatalog, writeCatalog } from './storage'
import { useTheme } from './use-theme'

export function Library() {
  const { theme, toggleTheme } = useTheme()
  const [initialCatalog] = useState(() => {
    try {
      return { courses: readCatalog(), error: '' }
    } catch (error) {
      return {
        courses: [],
        error: error instanceof Error ? error.message : 'Não foi possível ler os dados locais.',
      }
    }
  })
  const [catalogError, setCatalogError] = useState(initialCatalog.error)
  const canLeave = useRef<() => boolean>(() => true)
  const [courses, setCourses] = useState<Course[]>(initialCatalog.courses)
  const [active, setActive] = useState<Course>()
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState(initialCatalog.error)
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const importLock = useRef(false)
  const visibleCourses = courses.filter((course) =>
    course.title.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')),
  )
  const lessonCount = courses.reduce((total, course) => total + course.lessons.length, 0)

  async function upload(file?: File) {
    if (!file || importLock.current || catalogError) return
    importLock.current = true
    setBusy(true)
    setMessage('')
    try {
      await preparePlayer()
      const course = await importCourse(file)
      try {
        const next = [course, ...readCatalog()]
        writeCatalog(next)
        setCourses(next)
      } catch (error) {
        await caches.delete(`scorm-${course.id}`)
        throw error
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao importar o curso.')
    } finally {
      importLock.current = false
      setBusy(false)
    }
  }

  async function removeCourse(course: Course) {
    if (importLock.current || !window.confirm(`Remover “${course.title}” e seu progresso local?`))
      return
    importLock.current = true
    setBusy(true)
    setMessage('')
    try {
      const next = readCatalog().filter((item) => item.id !== course.id)
      writeCatalog(next)
      setCourses(next)
      for (const lesson of course.lessons) localStorage.removeItem(progressKey(course, lesson))
      await caches.delete(`scorm-${course.id}`)
    } catch {
      setMessage('Não foi possível concluir a remoção do curso.')
    } finally {
      importLock.current = false
      setBusy(false)
    }
  }

  function drop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    void upload(event.dataTransfer.files[0])
  }

  return (
    <>
      <header className="app-header">
        <div className="mx-auto flex h-[88px] max-w-[1360px] items-center justify-between gap-4 px-5 sm:px-9">
          <button
            type="button"
            className="brand"
            aria-label="Aulora, voltar à biblioteca"
            onClick={() => {
              if (canLeave.current()) setActive(undefined)
            }}
          >
            <img src={`${import.meta.env.BASE_URL}aulora-logo.png`} alt="" width="40" height="40" />
            <span>
              Aulora<span className="brand-description">Leitor SCORM</span>
            </span>
          </button>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden items-center gap-2 text-xs font-semibold text-muted sm:flex">
              <span className="h-2 w-2 rounded-full bg-[var(--progress)]" /> Armazenamento local
            </span>
            <button
              type="button"
              className="theme-toggle"
              aria-label="Tema escuro"
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              onClick={toggleTheme}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
              <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
            </button>
          </div>
        </div>
      </header>

      {active ? (
        <Player
          course={active}
          canLeave={canLeave}
          onClose={() => {
            if (canLeave.current()) setActive(undefined)
          }}
        />
      ) : (
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
                  <span>
                    {courses.length === 1 ? 'curso na biblioteca' : 'cursos na biblioteca'}
                  </span>
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
                  Arraste um arquivo ZIP ou selecione um pacote SCORM 1.2 ou 2004 de origem
                  confiável.
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
            <p
              role="alert"
              className="mt-3 rounded-xl bg-danger-surface px-4 py-3 text-sm text-danger"
            >
              {message}
              <LocalDataBackup />
              {catalogError && (
                <button
                  type="button"
                  className="text-button mt-3"
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Reiniciar o catálogo? Uma cópia dos dados originais será mantida. Os arquivos e o progresso dos cursos não serão apagados.',
                      )
                    )
                      return
                    try {
                      recoverCatalog()
                      setCourses([])
                      setCatalogError('')
                      setMessage(
                        'Catálogo reiniciado. A cópia original foi preservada no navegador. Você pode importar seus cursos novamente.',
                      )
                    } catch {
                      setMessage(
                        'Não foi possível criar a cópia de segurança. Os dados originais foram mantidos.',
                      )
                    }
                  }}
                >
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
            ) : visibleCourses.length === 0 ? (
              <div className="search-empty">
                <h3 className="display-title text-2xl">Nenhum curso encontrado</h3>
                <p className="mt-2 text-sm text-muted">Tente buscar por outro título.</p>
                <button type="button" className="text-button mt-4" onClick={() => setQuery('')}>
                  Limpar busca
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCourses.map((course) => {
                  const completed = course.lessons.filter((lesson) =>
                    isComplete(progressKey(course, lesson)),
                  ).length
                  return (
                    <article key={course.id} className="course-card">
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <span className="tag">{course.version}</span>
                        <button
                          type="button"
                          className="icon-button"
                          disabled={busy || Boolean(catalogError)}
                          aria-label={`Remover ${course.title}`}
                          onClick={() => void removeCourse(course)}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                      <div className="course-book">
                        <Icon name="book" size={28} />
                      </div>
                      <h3 className="display-title course-title">{course.title}</h3>
                      <div className="mt-auto pt-5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted">
                            {completed} de {course.lessons.length}{' '}
                            {course.lessons.length === 1 ? 'aula concluída' : 'aulas concluídas'}
                          </p>
                          <span className="text-xs font-semibold">
                            {Math.round((completed / Math.max(course.lessons.length, 1)) * 100)}%
                          </span>
                        </div>
                        <progress
                          className="mb-5 mt-3 w-full"
                          aria-label="Aulas concluídas"
                          value={completed}
                          max={course.lessons.length}
                        />
                        <button
                          type="button"
                          className="course-open"
                          onClick={() => setActive(course)}
                        >
                          Abrir curso <Icon name="arrow" size={18} />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
          <footer className="library-footer">
            <span>Aulora · Leitor SCORM</span>
            <LocalDataBackup />
            <span>Seus cursos e seu progresso ficam neste navegador.</span>
          </footer>
        </main>
      )}
    </>
  )
}
