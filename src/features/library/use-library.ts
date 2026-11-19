import { useRef, useState } from 'react'

import { courseProgress } from '../../application/get-course-progress'
import {
  importCourseToLibrary,
  loadLibrary,
  removeCourseFromLibrary,
  resetLibrary,
} from '../../application/library-service'
import type { Course } from '../../domain/course'

export function useLibrary() {
  const [initial] = useState(loadLibrary)
  const [courses, setCourses] = useState(initial.courses)
  const [catalogError, setCatalogError] = useState(initial.error)
  const [message, setMessage] = useState(initial.error)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const lock = useRef(false)

  async function upload(file?: File) {
    if (!file || lock.current || catalogError) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      setCourses(await importCourseToLibrary(file))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao importar o curso.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function removeCourse(course: Course) {
    if (lock.current || !window.confirm(`Remover “${course.title}” e seu progresso local?`)) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      setCourses(await removeCourseFromLibrary(course))
    } catch {
      const current = loadLibrary()
      if (!current.error) setCourses(current.courses)
      setMessage('Não foi possível concluir a remoção do curso.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function recover() {
    if (
      !window.confirm(
        'Reiniciar o catálogo? Uma cópia dos dados originais será mantida. Os arquivos e o progresso dos cursos não serão apagados.',
      )
    )
      return
    try {
      setCourses(resetLibrary())
      setCatalogError('')
      setMessage(
        'Catálogo reiniciado. A cópia original foi preservada no navegador. Você pode importar seus cursos novamente.',
      )
    } catch {
      setMessage('Não foi possível criar a cópia de segurança. Os dados originais foram mantidos.')
    }
  }

  const visibleCourses = courses.filter((course) =>
    course.title.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')),
  )
  return {
    courses,
    busy,
    catalogError,
    message,
    query,
    setQuery,
    upload,
    removeCourse,
    recover,
    lessonCount: courses.reduce((total, course) => total + course.lessons.length, 0),
    summaries: visibleCourses.map((course) => ({ course, progress: courseProgress(course) })),
  }
}

export type LibraryModel = ReturnType<typeof useLibrary>
