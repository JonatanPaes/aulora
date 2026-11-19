import { expect, test } from '@playwright/test'

import type { Course } from '../../src/domain/course'
import { lessonResult, summarizeCourse } from '../../src/domain/course-progress'
import { createRuntime } from '../../src/domain/scorm/runtime'
import { readCatalog, writeCatalog } from '../../src/infrastructure/storage/course-repository'

const course: Course = {
  id: '12345678-1234-1234-1234-123456789abc',
  title: 'Curso de exemplo',
  version: 'SCORM 2004',
  filename: 'example.zip',
  lessons: [
    { id: 'one', title: 'Primeira', path: 'one.html' },
    { id: 'two', title: 'Segunda', path: 'two.html' },
  ],
}

test('resumo de progresso funciona sem navegador e não modifica os dados recebidos', () => {
  const lessons = course.lessons.map((lesson) => ({
    ...lesson,
    ...lessonResult({}, true),
    invalid: false,
  }))
  const original = structuredClone(lessons)
  const summary = summarizeCourse(course, lessons, {
    version: 1,
    lessonId: 'two',
    accessedAt: '2026-11-18T12:00:00Z',
  })
  expect(summary.nextIndex).toBe(1)
  expect(summary.lessons[1].completion).toBe('Em andamento')
  expect(summary.percent).toBe(0)
  expect(lessons).toEqual(original)
})

test('runtime funciona sem DOM e mantém alterações pendentes para nova tentativa', () => {
  let fail = true
  let saved: Record<string, string> = {}
  const runtime = createRuntime(
    {},
    (data) => {
      if (fail) return false
      saved = data
      return true
    },
    true,
  )
  runtime.scorm2004.Initialize('')
  runtime.scorm2004.SetValue('cmi.suspend_data', 'bookmark')
  expect(runtime.flush()).toBe(false)
  expect(runtime.snapshot().dirty).toBe(true)
  fail = false
  expect(runtime.flush()).toBe(true)
  expect(saved['cmi.suspend_data']).toBe('bookmark')
})

test('repositório aceita armazenamento injetado e preserva catálogo inválido', () => {
  const values = new Map<string, string>()
  const store: Storage = {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
    key: (index) => [...values.keys()][index] ?? null,
  }
  writeCatalog([course], store)
  expect(readCatalog(store)).toEqual([course])
  store.setItem('aulora.catalog', '{}')
  expect(() => writeCatalog([], store)).toThrow()
  expect(store.getItem('aulora.catalog')).toBe('{}')
})
