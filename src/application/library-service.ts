import type { Course } from '../domain/course'
import { deleteCourseCache, preparePlayer } from '../infrastructure/scorm/course-assets'
import { importCourse } from '../infrastructure/scorm/package-importer'
import {
  clearCourseProgress,
  readCatalog,
  recoverCatalog,
  writeCatalog,
} from '../infrastructure/storage/course-repository'

export function loadLibrary() {
  try {
    return { courses: readCatalog(), error: '' }
  } catch (error) {
    return {
      courses: [] as Course[],
      error: error instanceof Error ? error.message : 'Não foi possível ler os dados locais.',
    }
  }
}

export async function importCourseToLibrary(file: File) {
  await preparePlayer()
  const course = await importCourse(file)
  try {
    const courses = [course, ...readCatalog()]
    writeCatalog(courses)
    return courses
  } catch (error) {
    await deleteCourseCache(course.id)
    throw error
  }
}

export async function removeCourseFromLibrary(course: Course) {
  const courses = readCatalog().filter((item) => item.id !== course.id)
  writeCatalog(courses)
  clearCourseProgress(course)
  await deleteCourseCache(course.id)
  return courses
}

export function resetLibrary() {
  recoverCatalog()
  return readCatalog()
}
