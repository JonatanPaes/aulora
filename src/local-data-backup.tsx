import { useState } from 'react'

import { exportLocalData } from './storage'

export function LocalDataBackup() {
  const [message, setMessage] = useState('')
  return (
    <span className="block">
      <button
        type="button"
        className="text-button mt-3"
        onClick={() => {
          try {
            const url = URL.createObjectURL(
              new Blob([exportLocalData()], { type: 'application/json' }),
            )
            const link = document.createElement('a')
            link.href = url
            link.download = 'aulora-dados-locais.json'
            link.click()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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
