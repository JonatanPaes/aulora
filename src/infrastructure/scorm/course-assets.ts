import type { Course, Lesson } from '../../domain/course'

const baseUrl = new URL(import.meta.env.BASE_URL, location.href)
export const courseUrl = (id: string, path: string) =>
  new URL(`__scorm/${id}/${path}`, baseUrl).href

export async function preparePlayer() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    throw new Error('Abra o leitor em localhost ou HTTPS para reproduzir cursos.')
  }
  await navigator.serviceWorker.register(new URL('scorm-worker.js', baseUrl))
  await navigator.serviceWorker.ready
  if (navigator.serviceWorker.controller) return

  await new Promise<void>((resolve, reject) => {
    const ready = () => {
      if (!navigator.serviceWorker.controller) return
      clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener('controllerchange', ready)
      resolve()
    }
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', ready)
      reject(new Error('Atualize a página para ativar o leitor SCORM.'))
    }, 7000)
    navigator.serviceWorker.addEventListener('controllerchange', ready)
    ready()
  })
}

export const openCourseCache = (id: string) => caches.open(`scorm-${id}`)
export const deleteCourseCache = (id: string) => caches.delete(`scorm-${id}`)

export async function prepareLessonUrl(course: Course, lesson: Lesson) {
  await preparePlayer()
  const url = courseUrl(course.id, lesson.path)
  const response = await fetch(url, { method: 'HEAD' })
  if (!response.ok)
    throw new Error(
      `Não foi possível abrir o arquivo da aula (HTTP ${response.status}). Importe o pacote novamente.`,
    )
  return url
}
