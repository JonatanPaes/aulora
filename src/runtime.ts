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
) {
  const data = new Map(Object.entries({ ...defaults, ...saved }))
  let state: 'new' | 'active' | 'ended' = 'new'
  let error = '0'
  let dirty = false

  function flush() {
    if (!dirty) return true
    try {
      if (!persist(Object.fromEntries(data))) return false
      dirty = false
      return true
    } catch {
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
    scorm12: {
      LMSInitialize: initialize,
      LMSFinish: finish,
      LMSGetValue: getValue,
      LMSSetValue: setValue,
      LMSCommit: commit,
      LMSGetLastError: diagnostics.getLastError,
      LMSGetErrorString: diagnostics.getErrorString,
      LMSGetDiagnostic: diagnostics.getDiagnostic,
    },
    scorm2004: {
      Initialize: initialize,
      Terminate: finish,
      GetValue: getValue,
      SetValue: setValue,
      Commit: commit,
      GetLastError: diagnostics.getLastError,
      GetErrorString: diagnostics.getErrorString,
      GetDiagnostic: diagnostics.getDiagnostic,
    },
  }
}
