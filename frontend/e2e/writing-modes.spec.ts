import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const email = `e2e-${randomUUID()}@example.test`
const settings = Object.fromEntries(
  readFileSync('../backend/config/local.properties', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
test.afterAll(() => {
  if (!/^e2e-[a-f0-9-]+@example\.test$/.test(email))
    throw new Error('Unsafe test identity')
  const sub = `SELECT s.id FROM submissions s JOIN students st ON st.id=s.student_id JOIN users u ON u.id=st.parent_id WHERE u.email='${email}'`
  const children = `SELECT st.id FROM students st JOIN users u ON u.id=st.parent_id WHERE u.email='${email}'`
  const sql = `DELETE FROM submission_errors WHERE submission_id IN (${sub}); DELETE FROM student_progress WHERE student_id IN (${children}); DELETE FROM submissions WHERE student_id IN (${children}); DELETE FROM students WHERE parent_id IN (SELECT id FROM users WHERE email='${email}'); DELETE FROM users WHERE email='${email}' AND role='PARENT';`
  const r = spawnSync(
    process.env.MYSQL_CLI || 'mysql',
    [
      '--protocol=TCP',
      `--host=${settings['db.host']}`,
      `--port=${settings['db.port']}`,
      `--user=${settings['db.username']}`,
      `--database=${settings['db.name']}`,
      '--execute',
      sql,
    ],
    {
      env: {
        ...process.env,
        MYSQL_PWD: process.env.DB_PASSWORD || settings['db.password'],
      },
      encoding: 'utf8',
    },
  )
  expect(r.status).toBe(0)
})
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    await page.screenshot({
      path: 'test-results/writing-mode-failure.png',
      fullPage: true,
      animations: 'disabled',
    })
})

async function draw(page: Page, canvas: Locator, short = false) {
  await canvas.scrollIntoViewIfNeeded()
  const b = (await canvas.boundingBox())!
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(
    b.x + b.width * (0.35 + (short ? 0.007 : 0.2)),
    b.y + b.height * (0.4 + (short ? 0.007 : 0.3)),
    { steps: 12 },
  )
  await page.mouse.up()
}

test('separate writing modes preserve geometry and short strokes; previews never save attempts', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)
  const registration = await request.post('/api/auth/register', {
    data: {
      email,
      password: `Test-${randomUUID()}`,
      fullName: 'Ba mẹ thử ba chế độ',
    },
  })
  expect(registration.status()).toBe(201)
  const { accessToken } = await registration.json(),
    headers = { Authorization: `Bearer ${accessToken}` }
  const child = await (
    await request.post('/api/students', {
      headers,
      data: { nickname: 'Bé thử chế độ', birthYear: 2020, gradeLevel: 'LOP_1' },
    })
  ).json()
  await page.addInitScript(
    (token) => sessionStorage.setItem('netxinh.access-token.v2', token),
    accessToken,
  )
  await page.goto('/luyen-tap/chu-don', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Viết một chữ hoặc số' }),
  ).toBeVisible()
  const canvas = page.locator('.practice-workspace canvas')
  let bounds = (await canvas.boundingBox())!
  expect(Math.abs(bounds.width / bounds.height - 1)).toBeLessThan(0.02)
  await draw(page, canvas, true)
  const captured = page.waitForRequest((r) =>
    r.url().endsWith('/api/recognition/preview'),
  )
  await page.getByRole('button', { name: 'Nhận dạng thử', exact: true }).click()
  const outgoing = (await captured).postDataJSON()
  expect(outgoing.width).toBe(420)
  expect(outgoing.height).toBe(420)
  expect(outgoing.strokes[0].length).toBeGreaterThan(8)
  await expect(page.locator('.preview-prediction')).toBeVisible({
    timeout: 20000,
  })
  await page.screenshot({
    path: 'test-results/single-mode-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await draw(page, canvas)
  await expect(page.locator('.preview-prediction')).toHaveCount(0)
  // Delay an actual model response, then change the drawing. A late result
  // must never reappear as the result for the newer ink.
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/recognition/preview', async (route) => {
    try {
      const response = await route.fetch()
      await gate
      await route.fulfill({ response })
    } catch {
      /* request cancelled when the ink changed */
    }
  })
  const pending = page.waitForRequest((r) =>
    r.url().endsWith('/api/recognition/preview'),
  )
  await page.getByRole('button', { name: 'Nhận dạng thử', exact: true }).click()
  await pending
  await draw(page, canvas)
  release()
  await expect(page.locator('.preview-prediction')).toHaveCount(0)
  await page.unroute('**/api/recognition/preview')
  expect(
    (
      await (
        await request.get(`/api/students/${child.id}/overview`, { headers })
      ).json()
    ).submissions,
  ).toBe(0)
  await page
    .getByRole('navigation', { name: 'Chế độ luyện viết' })
    .getByRole('link', { name: 'Chữ ghép', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Viết một chữ ghép' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  bounds = (await canvas.boundingBox())!
  expect(Math.abs(bounds.width / bounds.height - 2.5)).toBeLessThan(0.04)
  await page.screenshot({
    path: 'test-results/compound-before-drawing.png',
    fullPage: true,
    animations: 'disabled',
  })
  await draw(page, canvas)
  await expect(page.locator('.drawing-toolbar')).toContainText('1 nét')
  await page.getByRole('button', { name: 'Nhận dạng thử', exact: true }).click()
  await expect(page.locator('.preview-prediction')).toBeVisible({
    timeout: 20000,
  })
  await page.getByText('Ảnh thực tế model nhìn thấy', { exact: true }).click()
  await expect(
    page.getByAltText('Ảnh nét viết sau tiền xử lý của model chữ ghép'),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({
    path: 'test-results/compound-mode-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page
    .getByRole('navigation', { name: 'Chế độ luyện viết' })
    .getByRole('link', { name: 'Từ, câu & đoạn', exact: true })
    .click()
  const catalog = await (await request.get('/api/lessons', { headers })).json()
  const sentence = catalog
    .flatMap((l: { items: { id: number; itemType: string }[] }) => l.items)
    .find((i: { itemType: string }) => i.itemType === 'SENTENCE')
  await page
    .getByLabel('Chọn nội dung luyện', { exact: true })
    .selectOption(String(sentence.id))
  await expect(page.locator('.passage-reference > p')).toHaveText(sentence.textValue)
  await expect(
    page.getByRole('heading', { name: 'Viết từ, câu & đoạn văn' }),
  ).toBeVisible()
  await draw(page, canvas)
  await page.keyboard.press('Space')
  await expect(page.locator('.written-word-list article')).toHaveCount(1, {
    timeout: 20000,
  })
  await expect(page.locator('.written-word-list strong')).not.toBeEmpty()
  await expect(page.locator('.preview-prediction')).toHaveCount(0)
  await page.getByRole('button', { name: 'Sửa từ cuối', exact: true }).click()
  await expect(page.locator('.written-word-list article')).toHaveCount(0)
  await expect(page.locator('.drawing-toolbar')).toContainText('1 nét')
  await page.getByRole('button', { name: 'Xong từ này', exact: true }).click()
  await expect(page.locator('.written-word-list article')).toHaveCount(1, {
    timeout: 20000,
  })
  await page.setViewportSize({ width: 1365, height: 920 })
  await page.screenshot({
    path: 'test-results/passage-mode-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/submissions') && r.request().method() === 'POST',
    { timeout: 100000 },
  )
  await page
    .getByRole('button', { name: 'Gửi cả bài để nhận xét', exact: true })
    .click()
  expect((await saved).status()).toBe(201)
  await expect(page.locator('.submission-result')).toBeVisible()
  expect(
    (
      await (
        await request.get(`/api/students/${child.id}/overview`, { headers })
      ).json()
    ).submissions,
  ).toBe(1)
})
