import type { Course } from '../domain/course'
import { type CourseSession, lessonResult, summarizeCourse } from '../domain/course-progress'
import { progressKey, readProgress, readSession } from '../infrastructure/storage/course-repository'

export function courseProgress(course: Course, store?: Storage) {
  const lessons = course.lessons.map((lesson) => {
    try {
      return {
        ...lesson,
        ...lessonResult(
          readProgress(progressKey(course, lesson), store),
          course.version === 'SCORM 2004',
        ),
        invalid: false,
      }
    } catch {
      return { ...lesson, ...lessonResult({}, course.version === 'SCORM 2004'), invalid: true }
    }
  })
  let session: CourseSession | undefined
  let sessionError = false
  try {
    session = readSession(course, store)
  } catch {
    sessionError = true
  }
  return summarizeCourse(course, lessons, session, sessionError)
}
