import { exportLocalData } from '../infrastructure/storage/course-repository'
import { downloadJson } from '../shared/lib/download-json'

export function downloadLocalBackup() {
  downloadJson('aulora-dados-locais.json', exportLocalData())
}
