export interface RuntimeEvent {
  id: number
  time: string
  method: string
  field?: string
  result: string
  error: string
}

export interface RuntimeSnapshot {
  state: 'new' | 'active' | 'ended'
  error: string
  dirty: boolean
  lastSavedAt?: string
  events: RuntimeEvent[]
}

const defaults = {
  'cmi.core.student_id': 'local',
  'cmi.core.student_name': 'Aluno local',
  'cmi.core.lesson_status': 'not attempted',
  'cmi.core.entry': 'ab-initio',
  'cmi.core.credit': 'credit',
  'cmi.core.lesson_mode': 'normal',
  'cmi.learner_id': 'local',
  'cmi.learner_name': 'Aluno local',
  'cmi.completion_status': 'unknown',
  'cmi.success_status': 'unknown',
  'cmi.entry': 'ab-initio',
  'cmi.credit': 'credit',
  'cmi.mode': 'normal',
}

export function createRuntime(
  saved: Record<string, string>,
  persist: (data: Record<string, string>) => boolean,
  is2004: boolean,
  onChange?: (snapshot: RuntimeSnapshot) => void,
) {
  const data = new Map(Object.entries({ ...defaults, ...saved }))
  let state: 'new' | 'active' | 'ended' = 'new'
  let error = '0'
  let dirty = false
  let lastSavedAt: string | undefined
  let sequence = 0
  const events: RuntimeEvent[] = []

  function snapshot(): RuntimeSnapshot {
    return { state, error, dirty, lastSavedAt, events: [...events] }
  }

  function record(method: string, response: string, field?: string) {
    events.push({
      id: ++sequence,
      time: new Date().toISOString(),
      method,
      field: field?.slice(0, 160),
      result: response,
      error,
    })
    if (events.length > 200) events.shift()
    onChange?.(snapshot())
  }

  function trace<T extends (...args: string[]) => string>(name: string, action: T): T {
    return ((...args: string[]) => {
      const response = action(...args)
      record(
        name,
        name.includes('GetValue') ? 'Valor consultado' : response,
        name.includes('Value') ? args[0] : undefined,
      )
      return response
    }) as T
  }

  function flush() {
    if (!dirty) return true
    try {
      if (!persist(Object.fromEntries(data))) {
        record('Salvar progresso', 'Falha')
        return false
      }
      dirty = false
      lastSavedAt = new Date().toISOString()
      record('Salvar progresso', 'Salvo')
      return true
    } catch {
      record('Salvar progresso', 'Falha')
      return false
    }
  }

  if (saved['cmi.core.exit'] === 'suspend') data.set('cmi.core.entry', 'resume')
  if (saved['cmi.exit'] === 'suspend') data.set('cmi.entry', 'resume')

  function result(code = '0') {
    error = code
    return code === '0' ? 'true' : 'false'
  }

  function initialize(argument: string) {
    if (argument !== '') return result('201')
    if (state !== 'new') return result(is2004 ? (state === 'active' ? '103' : '104') : '101')
    state = 'active'
    return result()
  }

  function commit(argument: string) {
    if (argument !== '') return result('201')
    if (state !== 'active') return result(is2004 ? (state === 'ended' ? '143' : '142') : '301')
    dirty = true
    return result(flush() ? '0' : is2004 ? '391' : '101')
  }

  function finish(argument: string) {
    const response = commit(argument)
    if (response === 'true') state = 'ended'
    return response
  }

  function getValue(key: string) {
    if (state !== 'active') {
      result(is2004 ? (state === 'ended' ? '123' : '122') : '301')
      return ''
    }
    result()
    if (key.endsWith('._count')) {
      const prefix = key.slice(0, -6)
      const indexes = [...data.keys()]
        .filter((item) => item.startsWith(prefix))
        .map((item) => item.slice(prefix.length).split('.')[0])
        .filter((item) => /^\d+$/.test(item))
      return String(new Set(indexes).size)
    }
    return data.get(key) ?? ''
  }

  function setValue(key: string, value: string) {
    if (state !== 'active') return result(is2004 ? (state === 'ended' ? '133' : '132') : '301')
    data.set(key, String(value))
    dirty = true
    return result()
  }

  const diagnostics = {
    getLastError: () => error,
    getErrorString: (code: string) => (code === '0' ? 'No error' : `SCORM error ${code}`),
    getDiagnostic: (code: string) => code || error,
  }

  return {
    flush,
    snapshot,
    scorm12: {
      LMSInitialize: trace('LMSInitialize', initialize),
      LMSFinish: trace('LMSFinish', finish),
      LMSGetValue: trace('LMSGetValue', getValue),
      LMSSetValue: trace('LMSSetValue', setValue),
      LMSCommit: trace('LMSCommit', commit),
      LMSGetLastError: diagnostics.getLastError,
      LMSGetErrorString: diagnostics.getErrorString,
      LMSGetDiagnostic: diagnostics.getDiagnostic,
    },
    scorm2004: {
      Initialize: trace('Initialize', initialize),
      Terminate: trace('Terminate', finish),
      GetValue: trace('GetValue', getValue),
      SetValue: trace('SetValue', setValue),
      Commit: trace('Commit', commit),
      GetLastError: diagnostics.getLastError,
      GetErrorString: diagnostics.getErrorString,
      GetDiagnostic: diagnostics.getDiagnostic,
    },
  }
}
