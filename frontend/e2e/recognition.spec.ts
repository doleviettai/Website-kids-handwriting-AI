import { expect, test } from '@playwright/test'
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
    throw new Error('Unsafe synthetic identity')
  const sub = `SELECT s.id FROM submissions s JOIN students st ON st.id=s.student_id JOIN users u ON u.id=st.parent_id WHERE u.email='${email}'`
  const children = `SELECT st.id FROM students st JOIN users u ON u.id=st.parent_id WHERE u.email='${email}'`
  const sql = `DELETE FROM submission_errors WHERE submission_id IN (${sub}); DELETE FROM student_progress WHERE student_id IN (${children}); DELETE FROM submissions WHERE student_id IN (${children}); DELETE FROM students WHERE parent_id IN (SELECT id FROM users WHERE email='${email}'); DELETE FROM users WHERE email='${email}' AND role='PARENT';`
  const result = spawnSync(
    process.env.MYSQL_CLI || 'mysql',
    [
      '--protocol=TCP',
      `--host=${settings['db.host'] || '127.0.0.1'}`,
      `--port=${settings['db.port'] || 3306}`,
      `--user=${settings['db.username'] || 'root'}`,
      `--database=${settings['db.name'] || 'kids_handwriting'}`,
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
  expect(result.status).toBe(0)
})

test('real FastAPI models feed saved results and parent/admin review screens', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)
  const account = await request.post('/api/auth/register', {
    data: {
      email,
      password: `Test-${randomUUID()}`,
      fullName: 'Gia đình thử AI',
    },
  })
  expect(account.status()).toBe(201)
  const { accessToken } = await account.json()
  const headers = { Authorization: `Bearer ${accessToken}` }
  const childResponse = await request.post('/api/students', {
    headers,
    data: { nickname: 'Bé thử AI', birthYear: 2021, gradeLevel: 'LOP_1' },
  })
  const child = await childResponse.json()
  const lessons = (await (
    await request.get('/api/lessons', { headers })
  ).json()) as {
    id: number
    items: { id: number; itemType: string; textValue: string }[]
  }[]
  const letter = lessons
    .flatMap((l) => l.items.map((i) => ({ ...i, lesson: l.id })))
    .find((i) => i.itemType === 'LETTER' && i.textValue === 'a')!
  await page.addInitScript(
    (token) => sessionStorage.setItem('netxinh.access-token.v2', token),
    accessToken,
  )
  await page.goto(`/luyen-viet/${letter.lesson}?item=${letter.id}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(
    page.getByRole('button', { name: 'Gửi bài để nhận xét', exact: true }),
  ).toBeDisabled()
  const canvas = page.locator('.practice-workspace canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  for (let i = 0; i <= 25; i++) {
    const t = (i / 25) * Math.PI * 2
    await page.mouse.move(
      box.x + box.width * (0.5 + 0.12 * Math.cos(t)),
      box.y + box.height * (0.5 + 0.25 * Math.sin(t)),
    )
    if (i === 0) await page.mouse.down()
  }
  await page.mouse.up()
  await expect(
    page.getByRole('button', { name: 'Gửi bài để nhận xét', exact: true }),
  ).toBeEnabled({ timeout: 15000 })
  const savedPromise = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/submissions') && r.request().method() === 'POST',
    { timeout: 100000 },
  )
  await page
    .getByRole('button', { name: 'Gửi bài để nhận xét', exact: true })
    .click()
  const saved = await savedPromise
  expect(saved.status()).toBe(201)
  const result = await saved.json()
  expect(result.id).toBeGreaterThan(0)
  expect(result.modelVersion).toBe('v1')
  await expect(page.locator('.submission-result')).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({
    path: 'test-results/recognition-result-mobile.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
  await page.goto(`/bai-viet/${result.id}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.recognized-text strong')).toHaveText(
    result.predictedText || '(chưa đọc rõ)',
  )
  const circle = (offset: number) =>
    Array.from({ length: 25 }, (_, i) => ({
      x: 450 + 90 * Math.cos((i / 24) * Math.PI * 2),
      y: 210 + 100 * Math.sin((i / 24) * Math.PI * 2),
      t: 200000 + offset + i,
    }))
  for (const type of ['DIGRAPH', 'SENTENCE']) {
    const item = lessons
      .flatMap((l) => l.items)
      .find((i) => i.itemType === type)!
    const strokes =
      type === 'SENTENCE' ? [circle(0), circle(100), circle(200)] : [circle(0)]
    const response = await request.post('/api/submissions', {
      headers,
      timeout: 100000,
      data: {
        studentId: child.id,
        itemId: item.id,
        width: 900,
        height: 420,
        strokes,
        wordEnds: type === 'SENTENCE' ? [1, 2, 3] : [],
      },
    })
    expect(response.status(), await response.text()).toBe(201)
  }
  const overview = await (
    await request.get(`/api/students/${child.id}/overview`, { headers })
  ).json()
  expect(overview.submissions).toBe(3)
  await page.goto('/phu-huynh', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Ba mẹ cùng bé xem lại' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Xem bài viết', exact: true }),
  ).toHaveCount(3)
  const parentNotices = await (
    await request.get(`/api/students/${child.id}/attention`, { headers })
  ).json()
  expect(parentNotices.length).toBeGreaterThan(0)
  const adminResponse = await request.post('/api/auth/login', {
    data: {
      email: settings['app.bootstrap.admin.email'],
      password: settings['app.bootstrap.admin.password'],
    },
  })
  const admin = await adminResponse.json()
  const adminHeaders = { Authorization: `Bearer ${admin.accessToken}` }
  const review = await (
    await request.get('/api/admin/reviews?onlyErrors=false', {
      headers: adminHeaders,
    })
  ).json()
  expect(
    review.content.some((r: { id: number }) => r.id === result.id),
  ).toBeTruthy()
  await page.evaluate(
    (token) => sessionStorage.setItem('netxinh.access-token.v2', token),
    admin.accessToken,
  )
  // The init script above is only for this test page; rebind its token on next document.
  await page.addInitScript(
    (token) => sessionStorage.setItem('netxinh.access-token.v2', token),
    admin.accessToken,
  )
  await page.setViewportSize({ width: 1365, height: 920 })
  await page.goto('/quan-tri/bai-viet', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Bài viết cần xem lại', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Ba model đang sẵn sàng')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Xem bài', exact: true }).first(),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/admin-reviews-desktop.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
})
