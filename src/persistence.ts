import type { createRuntime } from './runtime'

export function bindPersistence(runtime: ReturnType<typeof createRuntime>) {
  const save = () => {
    runtime.flush()
  }
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!runtime.flush()) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  const interval = window.setInterval(save, 1000)
  window.addEventListener('pagehide', save)
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('visibilitychange', save)
  return () => {
    clearInterval(interval)
    window.removeEventListener('pagehide', save)
    window.removeEventListener('beforeunload', beforeUnload)
    document.removeEventListener('visibilitychange', save)
  }
}
