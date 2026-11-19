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
  await page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }).click()
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
  await page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Segunda aula' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Primeira aula', exact: true }).click()
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
  await page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Segunda aula' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Primeira aula', exact: true }).click()
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
  await expect(
    page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }),
  ).toBeVisible()
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('aulora.catalog') || '{}')
    localStorage.setItem('aulora.catalog', JSON.stringify(saved.courses))
  })
  await page.reload()
  await expect(
    page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }),
  ).toBeVisible()
  await upload(page)
  await expect(
    page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }),
  ).toHaveCount(2)
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('aulora.catalog') || '{}').version),
  ).toBe(1)
})

test('progresso corrompido bloqueia a execução sem sobrescrever os dados', async ({ page }) => {
  await upload(page)
  await expect(
    page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }),
  ).toBeVisible()
  const key = await page.evaluate(() => {
    const course = JSON.parse(localStorage.getItem('aulora.catalog') || '{}').courses[0]
    const key = `aulora.progress.${course.id}.one`
    localStorage.setItem(key, '{"cmi.suspend_data":42}')
    return key
  })
  await page.getByRole('button', { name: /(?:Come.ar|Continuar|Revisar) curso/ }).click()
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
        const limitsUrl = '/src/infrastructure/scorm/zip-limits.ts'
        const packagesUrl = '/src/infrastructure/scorm/package-importer.ts'
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
    const runtimeUrl = '/src/domain/scorm/runtime.ts'
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

test('continua na última aula pendente e oferece revisão ao concluir todas', async ({ page }) => {
  await openCourse(page)
  await page.getByRole('button', { name: 'Segunda aula', exact: true }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Segunda aula' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('Em andamento')
  await expect(page.getByRole('article')).toContainText('Segunda aula')
  await page.reload()
  await page.getByRole('button', { name: 'Continuar curso' }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Segunda aula' }),
  ).toBeVisible()
  await page.frameLocator('iframe').getByRole('button', { name: 'Alterar progresso' }).click()
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(page.getByRole('article').getByRole('progressbar')).toHaveAttribute('value', '1')
  await page.getByRole('button', { name: 'Continuar curso' }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Primeira aula' }),
  ).toBeVisible()
  await page.frameLocator('iframe').getByRole('button', { name: 'Alterar progresso' }).click()
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('100%')
  await page.getByRole('button', { name: 'Revisar curso' }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Primeira aula' }),
  ).toBeVisible()
})

test('mostra nota zero e reprovação sem inventar resultados para outras aulas', async ({
  page,
}) => {
  await openCourse(page)
  await page.evaluate(() => {
    const api = (
      window as unknown as {
        API: {
          LMSSetValue: (key: string, value: string) => string
          LMSCommit: (arg: string) => string
        }
      }
    ).API
    api.LMSSetValue('cmi.core.score.raw', '0')
    api.LMSSetValue('cmi.core.score.min', '0')
    api.LMSSetValue('cmi.core.score.max', '100')
    api.LMSSetValue('cmi.core.lesson_status', 'failed')
    api.LMSCommit('')
  })
  await page.locator('.course-results > summary').click()
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Primeira aula' }) })
  await expect(row).toContainText('0 de 100')
  await expect(row).toContainText('Reprovada')
  const other = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Segunda aula' }) })
  await expect(other.getByRole('cell').nth(1)).toHaveText('Não informada')
  await expect(other.getByRole('cell').nth(2)).toHaveText('Não informada')
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('1 com nota · 0 aprovadas · 1 reprovadas')
})

test('SCORM 2004 distingue aprovação de conclusão e preserva escalas de notas', async ({
  page,
}) => {
  const results = await page.evaluate(async () => {
    const url = '/src/domain/course-progress.ts'
    const { lessonResult } = await import(url)
    return [
      lessonResult(
        {
          'cmi.success_status': 'passed',
          'cmi.completion_status': 'incomplete',
          'cmi.score.scaled': '0.85',
        },
        true,
      ),
      lessonResult(
        {
          'cmi.completion_status': 'completed',
          'cmi.score.raw': '0',
          'cmi.score.min': '-10',
          'cmi.score.max': '10',
        },
        true,
      ),
      lessonResult({ 'cmi.score.raw': 'NaN', 'cmi.score.scaled': '2' }, true),
    ]
  })
  expect(results[0]).toMatchObject({
    completed: false,
    success: 'Aprovada',
    score: '0,85 (escala de -1 a 1)',
  })
  expect(results[1]).toMatchObject({
    completed: true,
    success: 'Não informada',
    score: '0 (mín. -10; máx. 10)',
  })
  expect(results[2].score).toBe('Não informada')
})

test('diagnóstico registra chamadas e exporta relatório sem valores de suspend_data', async ({
  page,
}) => {
  await openCourse(page)
  await page.frameLocator('iframe').getByRole('button', { name: 'Alterar progresso' }).click()
  await page.locator('.scorm-diagnostics > summary').click()
  const panel = page.locator('.scorm-diagnostics')
  await expect(panel).toContainText('Inicializada')
  await expect(panel.getByRole('region', { name: 'Eventos SCORM' })).toContainText('LMSInitialize')
  await expect(panel.getByRole('region', { name: 'Eventos SCORM' })).toContainText(
    'cmi.suspend_data',
  )
  await expect(panel).not.toContainText('retomar-aqui')
  const downloadPromise = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Exportar diagnóstico' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('aulora-diagnostico-scorm.json')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const report = Buffer.concat(chunks).toString('utf8')
  expect(report).toContain('LMSSetValue')
  expect(report).not.toContain('retomar-aqui')
})

test('diagnóstico sinaliza conteúdo que não inicializa a API', async ({ page }) => {
  const zip = new JSZip()
    .file('imsmanifest.xml', manifest)
    .file('one.html', '<h1>Sem comunicação SCORM</h1>')
    .file('two.html', '<h1>Segunda</h1>')
  await upload(page, zip.generateAsync({ type: 'nodebuffer' }))
  await page.getByRole('button', { name: 'Começar curso' }).click()
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Sem comunicação SCORM' }),
  ).toBeVisible()
  await page.locator('.scorm-diagnostics > summary').click()
  await expect(page.locator('.scorm-diagnostics')).toContainText('ainda não chamou a inicialização')
})

test('diagnóstico informa arquivo da aula ausente', async ({ page }) => {
  await upload(page)
  await expect(page.getByRole('button', { name: 'Começar curso' })).toBeVisible()
  await page.evaluate(async () => {
    for (const key of await caches.keys()) await caches.delete(key)
  })
  await page.getByRole('button', { name: 'Começar curso' }).click()
  await expect(page.getByRole('alert')).toContainText('HTTP 404')
  await page.locator('.scorm-diagnostics > summary').click()
  await expect(page.locator('.scorm-diagnostics')).toContainText('HTTP 404')
})

test('registro do runtime mantém apenas 200 eventos e preserva códigos de erro', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const url = '/src/domain/scorm/runtime.ts'
    const { createRuntime } = await import(url)
    const runtime = createRuntime({}, () => false, false)
    const api = runtime.scorm12
    api.LMSSetValue('cmi.suspend_data', 'segredo')
    const early = runtime.snapshot().events[0]
    api.LMSInitialize('')
    for (let i = 0; i < 250; i++) api.LMSSetValue('cmi.suspend_data', 'segredo')
    api.LMSCommit('')
    return { early, snapshot: runtime.snapshot() }
  })
  expect(result.early.error).toBe('301')
  expect(result.snapshot.events).toHaveLength(200)
  expect(result.snapshot.error).toBe('101')
  expect(result.snapshot.dirty).toBe(true)
  expect(JSON.stringify(result)).not.toContain('segredo')
})

test('remoção parcial mantém a interface alinhada ao catálogo salvo', async ({ page }) => {
  await upload(page)
  await expect(page.getByRole('button', { name: 'Começar curso' })).toBeVisible()
  await page.evaluate(() => {
    CacheStorage.prototype.delete = async () => {
      throw new Error('Cache indisponível')
    }
  })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remover Curso de teste' }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível concluir a remoção')
  await expect(page.getByText('Sua biblioteca começa aqui.')).toBeVisible()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('aulora.catalog') || '{}').courses),
  ).toEqual([])
})
