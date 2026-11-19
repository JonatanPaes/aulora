import { useRef, useState } from 'react'

import type { Course } from '../domain/course'
import { CourseLibrary } from '../features/library/course-library'
import { useLibrary } from '../features/library/use-library'
import { Player } from '../features/player/course-player'
import { useTheme } from '../features/theme/use-theme'
import { AppHeader } from './app-header'

export function App() {
  const { theme, toggleTheme } = useTheme()
  const library = useLibrary()
  const [active, setActive] = useState<Course>()
  const canLeave = useRef<() => boolean>(() => true)
  const onHome = () => {
    if (canLeave.current()) setActive(undefined)
  }
  return (
    <>
      <AppHeader theme={theme} toggleTheme={toggleTheme} onHome={onHome} />
      {active ? (
        <Player key={active.id} course={active} canLeave={canLeave} onClose={onHome} />
      ) : (
        <CourseLibrary model={library} onOpen={setActive} />
      )}
    </>
  )
}
