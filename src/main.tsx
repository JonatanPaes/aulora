import { createRoot } from 'react-dom/client'

import { Library } from './library'
import './styles.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<Library />)
