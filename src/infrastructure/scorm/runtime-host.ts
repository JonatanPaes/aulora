import type { createRuntime } from '../../domain/scorm/runtime'

type RuntimeWindow = Window & {
  API?: ReturnType<typeof createRuntime>['scorm12']
  API_1484_11?: ReturnType<typeof createRuntime>['scorm2004']
}

export function exposeRuntime(runtime: ReturnType<typeof createRuntime>) {
  const host = window as RuntimeWindow
  host.API = runtime.scorm12
  host.API_1484_11 = runtime.scorm2004
  return () => {
    if (host.API === runtime.scorm12) {
      delete host.API
      delete host.API_1484_11
    }
  }
}
