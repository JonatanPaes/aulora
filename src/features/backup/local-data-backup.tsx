import { useState } from 'react'

import { downloadLocalBackup } from '../../application/backup-service'

export function LocalDataBackup() {
  const [message, setMessage] = useState('')
  return (
    <span className="block">
      <button
        type="button"
        className="text-button mt-3"
        onClick={() => {
          try {
            downloadLocalBackup()
          } catch {
            setMessage('Não foi possível exportar os dados deste navegador.')
          }
        }}
      >
        Exportar catálogo e progresso
      </button>
      {message && <span role="alert">{message}</span>}
    </span>
  )
}
