import { Icon } from '../shared/ui/icon'

export function AppHeader({
  theme,
  toggleTheme,
  onHome,
}: {
  theme: string
  toggleTheme: () => void
  onHome: () => void
}) {
  return (
    <header className="app-header">
      <div className="mx-auto flex h-[88px] max-w-[1360px] items-center justify-between gap-4 px-5 sm:px-9">
        <button
          type="button"
          className="brand"
          aria-label="Aulora, voltar à biblioteca"
          onClick={onHome}
        >
          <img src={`${import.meta.env.BASE_URL}aulora-logo.png`} alt="" width="40" height="40" />
          <span>
            Aulora<span className="brand-description">Leitor SCORM</span>
          </span>
        </button>
        <div className="flex items-center gap-3 sm:gap-5">
          <span className="hidden items-center gap-2 text-xs font-semibold text-muted sm:flex">
            <span className="h-2 w-2 rounded-full bg-[var(--progress)]" /> Armazenamento local
          </span>
          <button
            type="button"
            className="theme-toggle"
            aria-label="Tema escuro"
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            onClick={toggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
