import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const email = `e2e-${randomUUID()}@example.test`
const password = `Test-${randomUUID()}`

test.afterAll(() => {
  // Remove only the synthetic family created by this test run, never user data.
  if (!/^e2e-[a-f0-9-]+@example\.test$/.test(email))
    throw new Error('Unsafe test identity')
  const settings = Object.fromEntries(
    readFileSync('../backend/config/local.properties', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ]),
  )
  const result = spawnSync(
    process.env.MYSQL_CLI || 'mysql',
    [
      '--protocol=TCP',
      `--host=${settings['db.host'] || '127.0.0.1'}`,
      `--port=${settings['db.port'] || '3306'}`,
      `--user=${settings['db.username'] || 'root'}`,
      `--database=${settings['db.name'] || 'kids_handwriting'}`,
      '--execute',
      `DELETE FROM students WHERE parent_id IN (SELECT id FROM users WHERE email='${email}'); DELETE FROM users WHERE email='${email}' AND role='PARENT';`,
    ],
    {
      env: {
        ...process.env,
        MYSQL_PWD: process.env.DB_PASSWORD || settings['db.password'],
      },
      encoding: 'utf8',
    },
  )
  expect(result.status, 'Synthetic E2E family should be cleaned up').toBe(0)
})

test('mobile sign-in page fits at 375px and reports backend outage', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dang-nhap', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Ba mẹ quay lại rồi!' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({
    path: 'test-results/login-mobile.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
  await page.route('**/api/auth/login', (route) => route.abort())
  await page
    .getByLabel('Email', { exact: true })
    .fill('network-check@example.test')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-network-check')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Chưa kết nối được máy chủ',
  )
})

test('family registers, manages profiles, browses MySQL content and signs out', async ({
  page,
}) => {
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(error.message))
  await page.goto('/dang-ky', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Tên hiển thị của ba mẹ').fill('Ba mẹ kiểm thử')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Nhập lại mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Tạo tài khoản phụ huynh' }).click()
  await expect(
    page.getByRole('heading', { name: 'Chào mừng gia đình đến NétXinh!' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Hồ sơ các bé', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm hồ sơ bé', exact: true }).click()
  await page.getByLabel('Biệt danh của bé').fill('Bông kiểm thử')
  await page.getByLabel('Năm sinh', { exact: true }).fill('2021')
  await page.getByRole('button', { name: 'Lưu hồ sơ bé' }).click()
  await expect(
    page.getByRole('heading', { name: 'Bông kiểm thử', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Bông kiểm thử', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Vào góc học tập', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: /Chào Bông kiểm thử/ }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/dashboard-desktop.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
  await page.getByRole('link', { name: 'Bài học của bé', exact: true }).click()
  const token = await page.evaluate(() =>
    sessionStorage.getItem('netxinh.access-token.v2'),
  )
  const catalog = (await (
    await page.request.get('/api/lessons', {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()) as { title: string; gradeLevel: string; items: unknown[] }[]
  await expect(page.locator('.lesson-card')).toHaveCount(
    catalog.filter((lesson) => lesson.gradeLevel === 'MAU_GIAO').length,
  )
  await page.getByLabel('Lọc theo cấp học').selectOption('ALL')
  await expect(page.locator('.lesson-card')).toHaveCount(catalog.length)
  await page
    .locator('.lesson-card')
    .filter({
      has: page.getByRole('heading', { name: 'Bảng chữ cái tiếng Việt' }),
    })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Bảng chữ cái tiếng Việt', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.library-items button')).toHaveCount(
    catalog.find((lesson) => lesson.title === 'Bảng chữ cái tiếng Việt')!.items
      .length,
  )
  await page.getByRole('button', { name: 'ă Chưa học', exact: true }).click()
  await expect(page.locator('.preview-text')).toHaveText('ă')
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({
    path: 'test-results/lesson-mobile.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
  await page.getByRole('link', { name: 'Hồ sơ các bé', exact: true }).click()
  await page
    .getByRole('button', { name: 'Sửa hồ sơ Bông kiểm thử', exact: true })
    .click()
  await page.getByLabel('Biệt danh của bé').fill('Sóc kiểm thử')
  await page.getByLabel('Cấp học', { exact: true }).selectOption('LOP_1')
  await page.getByRole('button', { name: 'Lưu hồ sơ bé' }).click()
  await expect(
    page.getByRole('heading', { name: 'Sóc kiểm thử', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Thêm hồ sơ bé', exact: true }).click()
  await page.getByLabel('Biệt danh của bé').fill('Mít kiểm thử')
  await page.getByRole('button', { name: 'Lưu hồ sơ bé' }).click()
  await expect(page.locator('.student-card')).toHaveCount(2)
  await page
    .getByRole('combobox', { name: 'Chọn hồ sơ bé', exact: true })
    .selectOption({ label: 'Bé Mít kiểm thử' })
  await expect(page.locator('.student-card.selected-student h2')).toHaveText(
    'Mít kiểm thử',
  )
  await page
    .getByRole('button', { name: 'Xóa hồ sơ Mít kiểm thử', exact: true })
    .click()
  await page.getByRole('button', { name: 'Xóa hồ sơ', exact: true }).click()
  await expect(page.locator('.student-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
  await page
    .getByRole('link', { name: 'Hành trình của bé', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Trang đầu tiên đang chờ bé' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/dang-nhap/)
  await page.goto('/ho-so')
  await expect(page).toHaveURL(/\/dang-nhap/)
  expect(failures).toEqual([])
})
