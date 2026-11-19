import { expect, type Page, test } from '@playwright/test'
import JSZip from 'jszip'

const manifest = `<manifest identifier="course">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org"><organization identifier="org"><title>Curso de teste</title>
    <item identifier="one" identifierref="r1"><title>Primeira aula</title></item>
    <item identifier="two" identifierref="r2"><title>Segunda aula</title></item>
  </organization></organizations>
  <resources><resource identifier="r1" href="one.html"/><resource identifier="r2" href="two.html"/></resources>
</manifest>`

function lessonHtml(title: string) {
  return `<!doctype html><html lang="pt-BR"><title>${title}</title><body>
    <h1>${title}</h1><button id="change">Alterar progresso</button><output id="saved"></output>
    <script>
      const api = parent.API;
      api.LMSInitialize('');
      document.querySelector('#saved').textContent = api.LMSGetValue('cmi.suspend_data');
      document.querySelector('#change').onclick = () => {
        api.LMSSetValue('cmi.suspend_data', 'retomar-aqui');
        api.LMSSetValue('cmi.core.exit', 'suspend');
        api.LMSSetValue('cmi.core.lesson_status', 'completed');
      };
    </script></body></html>`
}

async function courseZip() {
  return new JSZip()
    .file('imsmanifest.xml', manifest)
    .file('one.html', lessonHtml('Primeira aula'))
    .file('two.html', lessonHtml('Segunda aula'))
    .generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

async function upload(page: Page, buffer = courseZip()) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'curso.zip',
    mimeType: 'application/zip',
    buffer: await buffer,
  })
}

async function openCourse(page: Page) {
  await upload(page)
  await page.getByRole('button', { name: 'Abrir curso' }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Primeira aula' }),
  ).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('importa, troca de aula sem Commit, retoma e remove o curso', async ({ page }) => {
  await openCourse(page)
  await page.frameLocator('iframe').getByRole('button', { name: 'Alterar progresso' }).click()
  await page.getByRole('button', { name: 'Segunda aula' }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Segunda aula' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Primeira aula' }).click()
  await expect(page.frameLocator('iframe').locator('#saved')).toHaveText('retomar-aqui')
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(page.getByText('1 de 2 aulas concluídas')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir curso' }).click()
  await expect(page.frameLocator('iframe').locator('#saved')).toHaveText('retomar-aqui')
  await page.getByRole('button', { name: 'Aulora, voltar à biblioteca' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remover Curso de teste' }).click()
  await expect(page.getByText('Sua biblioteca começa aqui.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([])
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('aulora.progress.')),
    ),
  ).toEqual([])
})

test('salva alterações pendentes ao recarregar a página', async ({ page }) => {
  await openCourse(page)
  await page.frameLocator('iframe').getByRole('button', { name: 'Alterar progresso' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir curso' }).click()
  await expect(page.frameLocator('iframe').locator('#saved')).toHaveText('retomar-aqui')
})

test('salvamento periódico persiste progresso sem sair da aula', async ({ page }) => {
  await openCourse(page)
  await page.frameLocator('iframe').getByRole('button', { name: 'Alterar progresso' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((key) => key.startsWith('aulora.progress.'))
        return key ? JSON.parse(localStorage.getItem(key) || '{}')['cmi.suspend_data'] : null
      }),
    )
    .toBe('retomar-aqui')
})

test('falha de gravação mantém a aula aberta e permite tentar novamente', async ({ page }) => {
  await openCourse(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('aulora.progress.'))
        throw new DOMException('Sem espaço', 'QuotaExceededError')
      original.call(this, key, value)
    }
    Object.assign(window, {
      restoreStorage: () => {
        Storage.prototype.setItem = original
      },
    })
  })
  await page.frameLocator('iframe').getByRole('button', { name: 'Alterar progresso' }).click()
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText('Não foi possível salvar')
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Primeira aula' }),
  ).toBeVisible()
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(page.getByText('1 de 2 aulas concluídas')).toBeVisible()
})

for (const raw of ['{', '{}', '{"version":99,"courses":[]}', '[{"id":"invalid"}]']) {
  test(`catálogo inválido preservado: ${raw}`, async ({ page }) => {
    await page.evaluate((value) => localStorage.setItem('aulora.catalog', value), raw)
    await page.reload()
    await expect(page.getByRole('alert')).toContainText(/inválid|incompatível/)
    await expect(page.getByRole('button', { name: 'Selecionar ZIP' })).toBeDisabled()
    expect(await page.evaluate(() => localStorage.getItem('aulora.catalog'))).toBe(raw)
    const downloadPromise = page.waitForEvent('download')
    await page
      .getByRole('alert')
      .getByRole('button', { name: 'Exportar catálogo e progresso' })
      .click()
    expect((await downloadPromise).suggestedFilename()).toBe('aulora-dados-locais.json')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Reiniciar catálogo com cópia de segurança' }).click()
    await expect(page.getByRole('button', { name: 'Selecionar ZIP' })).toBeEnabled()
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('aulora.backup.catalog.'))
          .map((key) => localStorage.getItem(key)),
      ),
    ).toEqual([raw])
  })
}

test('catálogo legado permanece legível e migra na próxima gravação', async ({ page }) => {
  await upload(page)
  await expect(page.getByRole('button', { name: 'Abrir curso' })).toBeVisible()
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('aulora.catalog') || '{}')
    localStorage.setItem('aulora.catalog', JSON.stringify(saved.courses))
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Abrir curso' })).toBeVisible()
  await upload(page)
  await expect(page.getByRole('button', { name: 'Abrir curso' })).toHaveCount(2)
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('aulora.catalog') || '{}').version),
  ).toBe(1)
})

test('progresso corrompido bloqueia a execução sem sobrescrever os dados', async ({ page }) => {
  await upload(page)
  await expect(page.getByRole('button', { name: 'Abrir curso' })).toBeVisible()
  const key = await page.evaluate(() => {
    const course = JSON.parse(localStorage.getItem('aulora.catalog') || '{}').courses[0]
    const key = `aulora.progress.${course.id}.one`
    localStorage.setItem(key, '{"cmi.suspend_data":42}')
    return key
  })
  await page.getByRole('button', { name: 'Abrir curso' }).click()
  await expect(page.getByRole('alert')).toContainText('Progresso local inválido')
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    '{"cmi.suspend_data":42}',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reiniciar progresso com cópia de segurança' }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Primeira aula' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith('aulora.backup.progress.'))
        .map((key) => localStorage.getItem(key)),
    ),
  ).toEqual(['{"cmi.suspend_data":42}'])
})

test('rejeita ZIP inválido e manifesto ausente ou malformado sem resíduos', async ({ page }) => {
  for (const zip of [
    Buffer.from('invalid'),
    await new JSZip().file('file.txt', 'text').generateAsync({ type: 'nodebuffer' }),
    await new JSZip().file('imsmanifest.xml', '<manifest>').generateAsync({ type: 'nodebuffer' }),
  ]) {
    await upload(page, Promise.resolve(zip))
    await expect(page.getByRole('alert')).toBeVisible()
    expect(await page.evaluate(() => caches.keys())).toEqual([])
    expect(await page.evaluate(() => localStorage.getItem('aulora.catalog'))).toBeNull()
  }
})

test('rejeita caminhos de traversal mesmo depois da normalização do JSZip', async ({ page }) => {
  const zip = new JSZip().file('imsmanifest.xml', manifest).file('../one.html', 'bad')
  await upload(page, zip.generateAsync({ type: 'nodebuffer' }))
  await expect(page.getByRole('alert')).toContainText('caminho de arquivo inválido')
  expect(await page.evaluate(() => caches.keys())).toEqual([])
})

test('limites de tamanho comprimido, entradas, manifesto, arquivo e total', async ({ page }) => {
  const zip = await courseZip()
  // Lower the production limits to exercise each real extraction path with small fixtures.
  for (const limit of ['zipBytes', 'entries', 'manifestBytes', 'fileBytes', 'totalBytes']) {
    const error = await page.evaluate(
      async ({ bytes, limit }) => {
        const limitsUrl = '/src/zip-limits.ts'
        const packagesUrl = '/src/packages.ts'
        const { importLimits } = await import(limitsUrl)
        const { importCourse } = await import(packagesUrl)
        const previous = importLimits[limit]
        importLimits[limit] = limit === 'totalBytes' ? 950 : 1
        try {
          await importCourse(new File([new Uint8Array(bytes)], 'curso.zip'))
          return 'unexpected success'
        } catch (error) {
          return String(error)
        } finally {
          importLimits[limit] = previous
        }
      },
      { bytes: [...zip], limit },
    )
    expect(error).toMatch(/limite|excede/)
    expect(await page.evaluate(() => caches.keys())).toEqual([])
  }
})

test('falha de cache durante importação remove todos os arquivos parciais', async ({ page }) => {
  await page.evaluate(() => {
    const put = Cache.prototype.put
    let count = 0
    Cache.prototype.put = function (request, response) {
      if (++count === 2) return Promise.reject(new DOMException('Sem espaço', 'QuotaExceededError'))
      return put.call(this, request, response)
    }
  })
  await upload(page)
  await expect(page.getByRole('alert')).toContainText('Não há espaço suficiente')
  expect(await page.evaluate(() => caches.keys())).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('aulora.catalog'))).toBeNull()
})

test('falha ao gravar catálogo desfaz a importação', async ({ page }) => {
  await page.evaluate(() => {
    const put = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'aulora.catalog') throw new DOMException('Sem espaço', 'QuotaExceededError')
      return put.call(this, key, value)
    }
  })
  await upload(page)
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(() => caches.keys())).toEqual([])
})

test('runtime 2004 informa falha, permite nova tentativa e retoma suspend_data', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtimeUrl = '/src/runtime.ts'
    const { createRuntime } = await import(runtimeUrl)
    let fail = true
    let saved: Record<string, string> = {}
    const runtime = createRuntime(
      {},
      (data: Record<string, string>) => {
        if (fail) return false
        saved = data
        return true
      },
      true,
    )
    const api = runtime.scorm2004
    const beforeInit = api.SetValue('cmi.suspend_data', 'invalid')
    api.Initialize('')
    api.SetValue('cmi.suspend_data', 'bookmark')
    api.SetValue('cmi.exit', 'suspend')
    const failed = api.Commit('')
    const error = api.GetLastError()
    fail = false
    const retry = runtime.flush()
    const resumed = createRuntime(saved, () => true, true).scorm2004
    resumed.Initialize('')
    return {
      beforeInit,
      failed,
      error,
      retry,
      entry: resumed.GetValue('cmi.entry'),
      data: resumed.GetValue('cmi.suspend_data'),
    }
  })
  expect(result).toEqual({
    beforeInit: 'false',
    failed: 'false',
    error: '391',
    retry: true,
    entry: 'resume',
    data: 'bookmark',
  })
})
