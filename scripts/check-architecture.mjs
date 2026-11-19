import fs from 'node:fs'
import path from 'node:path'

import { parse } from '@babel/parser'

const root = path.resolve('src')
const allowed = {
  domain: ['domain'],
  infrastructure: ['domain', 'infrastructure'],
  application: ['domain', 'infrastructure', 'application', 'shared'],
  features: ['domain', 'application', 'features', 'shared'],
  shared: ['shared'],
  app: ['app', 'features', 'domain', 'shared'],
  entry: ['app'],
}
const browserGlobals = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'caches',
  'location',
])
const errors = []
const graph = new Map()
const relative = (file) => path.relative(root, file).replaceAll('\\', '/')
const layer = (file) => (relative(file).includes('/') ? relative(file).split('/')[0] : 'entry')

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(entry.name) ? [file] : []
  })
}

for (const file of files(root)) {
  const source = parse(fs.readFileSync(file, 'utf8'), {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    createImportExpressions: true,
    attachComment: false,
  })
  const from = layer(file)
  if (!allowed[from]) errors.push(`${relative(file)}: unknown architecture layer`)
  const dependencies = []
  function visit(node) {
    if (from === 'domain' && node.type === 'Identifier' && browserGlobals.has(node.name))
      errors.push(`${relative(file)}: domain cannot access browser global ${node.name}`)
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(node.type) &&
      node.source?.type === 'StringLiteral'
    ) {
      const specifier = node.source.value
      if (!specifier.startsWith('.')) {
        if (from === 'domain')
          errors.push(`${relative(file)}: domain cannot depend on package ${specifier}`)
      } else if (!specifier.endsWith('.css')) {
        const candidate = path.resolve(path.dirname(file), specifier)
        const target = [candidate, `${candidate}.ts`, `${candidate}.tsx`].find(
          (value) => fs.existsSync(value) && fs.statSync(value).isFile(),
        )
        if (!target) errors.push(`${relative(file)}: unresolved import ${specifier}`)
        else {
          dependencies.push(target)
          if (!allowed[from]?.includes(layer(target)))
            errors.push(
              `${relative(file)}: ${from} cannot depend on ${layer(target)} (${specifier})`,
            )
        }
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) visit(child)
      } else if (value?.type) visit(value)
    }
  }
  visit(source)
  graph.set(file, dependencies)
}

const visited = new Set()
const visiting = new Set()
function checkCycles(file, trail = []) {
  if (visiting.has(file)) {
    errors.push(`Dependency cycle: ${[...trail, file].map(relative).join(' -> ')}`)
    return
  }
  if (visited.has(file)) return
  visiting.add(file)
  for (const dependency of graph.get(file) ?? []) checkCycles(dependency, [...trail, file])
  visiting.delete(file)
  visited.add(file)
}
for (const file of graph.keys()) checkCycles(file)

if (errors.length) {
  for (const error of errors) process.stderr.write(`${error}\n`)
  process.exitCode = 1
} else
  process.stdout.write(
    `Architecture checked: ${graph.size} source files, no boundary violations or dependency cycles.\n`,
  )
