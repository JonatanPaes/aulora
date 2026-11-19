import type { Lesson } from '../../domain/course'

const children = (node: Element, name: string) =>
  Array.from(node.children).filter((child) => child.localName === name)

const titleOf = (node: Element) => children(node, 'title')[0]?.textContent?.trim()

export function parseManifest(xml: string, manifestPath: string, files: Set<string>) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const manifest = document.documentElement

  if (manifest.localName !== 'manifest' || document.querySelector('parsererror')) {
    throw new Error('O imsmanifest.xml é inválido.')
  }

  const metadata = children(manifest, 'metadata')[0]
  const schema = metadata && children(metadata, 'schemaversion')[0]?.textContent?.trim()
  const version = schema?.startsWith('1.2') ? '1.2' : schema ? '2004' : 'SCORM'
  const resources = children(manifest, 'resources')[0]
  const organizations = children(manifest, 'organizations')[0]
  const choices = organizations ? children(organizations, 'organization') : []
  const organization =
    choices.find(
      (item) => item.getAttribute('identifier') === organizations?.getAttribute('default'),
    ) ?? choices[0]
  const resourceList = resources ? children(resources, 'resource') : []
  const byId = new Map(
    resourceList.map((resource) => [resource.getAttribute('identifier'), resource]),
  )
  const lessons: Lesson[] = []
  const base = new URL(
    manifestPath.split('/').map(encodeURIComponent).join('/'),
    'https://package.invalid/',
  )

  function addLesson(resource: Element | undefined, id: string, title: string, parameters = '') {
    const href = resource?.getAttribute('href')
    if (!resource || !href) return

    let url = base
    for (const element of [manifest, resources, resource]) {
      const path = element?.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'base')
      if (path) url = new URL(path, url)
    }
    url = new URL(href, url)
    if (url.origin !== base.origin) return
    if (!files.has(decodeURIComponent(url.pathname.slice(1)))) return
    if (parameters.startsWith('?')) {
      for (const [key, value] of new URLSearchParams(parameters))
        url.searchParams.append(key, value)
    } else if (parameters.startsWith('#')) {
      url.hash = parameters
    }
    lessons.push({ id, title, path: url.href.slice(base.origin.length + 1) })
  }

  function visitItems(parent: Element) {
    for (const item of children(parent, 'item')) {
      const id = item.getAttribute('identifier') ?? String(lessons.length + 1)
      addLesson(
        byId.get(item.getAttribute('identifierref')),
        id,
        titleOf(item) || `Aula ${lessons.length + 1}`,
        item.getAttribute('parameters') ?? '',
      )
      visitItems(item)
    }
  }

  if (organization) visitItems(organization)
  if (!lessons.length) {
    for (const resource of resourceList) {
      const isSco = Array.from(resource.attributes).some(
        (attribute) =>
          attribute.localName.toLowerCase() === 'scormtype' &&
          attribute.value.toLowerCase() === 'sco',
      )
      if (isSco) addLesson(resource, String(lessons.length + 1), `Aula ${lessons.length + 1}`)
    }
  }

  if (!lessons.length)
    throw new Error('O manifesto não aponta para nenhuma aula disponível no ZIP.')
  return { title: organization && titleOf(organization), version, lessons }
}
