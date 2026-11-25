import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const marker = randomUUID()
const email = `e2e-${marker}@example.test`
const title = `Bài thử xóa ${marker}`
const settings = Object.fromEntries(
  readFileSync('../backend/config/local.properties', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
let lessonId: number | null = null

function sql(query: string) {
  const result = spawnSync(
    process.env.MYSQL_CLI || 'mysql',
    [
      '--protocol=TCP',
      `--host=${settings['db.host']}`,
      `--port=${settings['db.port']}`,
      `--user=${settings['db.username']}`,
      `--database=${settings['db.name']}`,
      '--batch',
      '--skip-column-names',
      '--execute',
      query,
    ],
    {
      env: {
        ...process.env,
        MYSQL_PWD: process.env.DB_PASSWORD || settings['db.password'],
      },
      encoding: 'utf8',
    },
  )
  expect(result.status, 'Synthetic lesson fixture database operation').toBe(0)
  return result.stdout.trim()
}

test.afterAll(async ({ request }) => {
  if (!/^[a-f0-9-]{36}$/.test(marker)) throw new Error('Unsafe test marker')
  // Only remove the synthetic records from this run; never target existing lessons.
  if (lessonId !== null) {
    const login = await request.post('/api/auth/login', {
      data: {
        email: settings['app.bootstrap.admin.email'],
        password: settings['app.bootstrap.admin.password'],
      },
    })
    if (login.ok()) {
      const { accessToken } = await login.json()
      const response = await request.delete(`/api/admin/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      expect([204, 404]).toContain(response.status())
    }
  }
  sql(
    `DELETE FROM students WHERE parent_id IN (SELECT id FROM users WHERE email='${email}'); DELETE FROM users WHERE email='${email}' AND role='PARENT';`,
  )
})

test('admin confirms permanent deletion of a populated lesson and its child history', async ({
  page,
  request,
}) => {
  const login = await request.post('/api/auth/login', {
    data: {
      email: settings['app.bootstrap.admin.email'],
      password: settings['app.bootstrap.admin.password'],
    },
  })
  expect(login.status()).toBe(200)
  const { accessToken } = await login.json(),
    headers = { Authorization: `Bearer ${accessToken}` }
  const lesson = await request.post('/api/admin/lessons', {
    headers,
    data: { title, gradeLevel: 'MAU_GIAO', sortOrder: 90 },
  })
  expect(lesson.status()).toBe(201)
  lessonId = (await lesson.json()).id
  const item = await request.post('/api/admin/items', {
    headers,
    data: {
      lessonId,
      itemType: 'WORD',
      textValue: `cascade-${marker}`,
      difficulty: 1,
      sortOrder: 0,
      template: null,
    },
  })
  expect(item.status()).toBe(201)
  const itemId = (await item.json()).id
  const parent = await request.post('/api/auth/register', {
    data: {
      email,
      password: `Test-${randomUUID()}`,
      fullName: 'Ba mẹ thử xóa bài',
    },
  })
  const parentToken = (await parent.json()).accessToken,
    parentHeaders = { Authorization: `Bearer ${parentToken}` }
  const child = await request.post('/api/students', {
    headers: parentHeaders,
    data: {
      nickname: 'Bé thử xóa bài',
      birthYear: 2021,
      gradeLevel: 'MAU_GIAO',
    },
  })
  const childId = (await child.json()).id
  const submissionId = Number(
    sql(
      `INSERT INTO submissions(student_id,item_id,source,total_score) VALUES (${childId},${itemId},'TOUCH',60); SELECT LAST_INSERT_ID();`,
    ),
  )
  sql(
    `INSERT INTO student_progress(student_id,item_id,attempts,last_score,best_score) VALUES (${childId},${itemId},1,60,60); INSERT INTO submission_errors(submission_id,error_type_id) SELECT ${submissionId},id FROM error_types WHERE code='TOO_SMALL';`,
  )
  expect(
    (
      await request.get(`/api/submissions/${submissionId}`, {
        headers: parentHeaders,
      })
    ).status(),
  ).toBe(200)
  const unauthorized = await request.delete(`/api/admin/lessons/${lessonId}`, {
    headers: parentHeaders,
  })
  expect(unauthorized.status()).toBe(403)
  await page.addInitScript(
    (token) => sessionStorage.setItem('netxinh.access-token.v2', token),
    accessToken,
  )
  await page.goto(`/quan-tri/bai-hoc?q=${marker}`, {
    waitUntil: 'domcontentloaded',
  })
  await page
    .getByRole('button', { name: `Xóa bài học ${title}`, exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Xóa vĩnh viễn bài học này cùng 1 nội dung',
  )
  await expect(page.getByRole('dialog')).toContainText('Không thể hoàn tác')
  await page.screenshot({
    path: 'test-results/delete-lesson-confirmation.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.admin-lesson-card')).toHaveCount(0)
  expect(
    (await request.get(`/api/lessons/${lessonId}`, { headers })).status(),
  ).toBe(404)
  expect(
    (
      await request.get(`/api/submissions/${submissionId}`, {
        headers: parentHeaders,
      })
    ).status(),
  ).toBe(404)
  const overview = await (
    await request.get(`/api/students/${childId}/overview`, {
      headers: parentHeaders,
    })
  ).json()
  expect(overview.submissions).toBe(0)
  expect(overview.progress).toEqual([])
  expect(
    sql(
      `SELECT COUNT(*) FROM submission_errors WHERE submission_id=${submissionId};`,
    ),
  ).toBe('0')
  expect(sql(`SELECT COUNT(*) FROM writing_items WHERE id=${itemId};`)).toBe(
    '0',
  )
})
