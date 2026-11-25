import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const marker = randomUUID()
const title = `Bài E2E ${marker}`
const changedTitle = `Bài đã sửa E2E ${marker}`
const text = `bé ${marker}`
const changedText = `em ${marker}`
const code = `E2E_${marker.replaceAll('-', '').toUpperCase()}`
const settings = Object.fromEntries(
  readFileSync('../backend/config/local.properties', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [
      line.slice(0, line.indexOf('=')),
      line.slice(line.indexOf('=') + 1),
    ]),
)

test.afterAll(() => {
  if (!/^[a-f0-9-]{36}$/.test(marker))
    throw new Error('Invalid synthetic marker')
  const cleanup = spawnSync(
    process.env.MYSQL_CLI || 'mysql',
    [
      '--protocol=TCP',
      `--host=${settings['db.host'] || '127.0.0.1'}`,
      `--port=${settings['db.port'] || '3306'}`,
      `--user=${settings['db.username'] || 'root'}`,
      `--database=${settings['db.name'] || 'kids_handwriting'}`,
      '--default-character-set=utf8mb4',
      '--execute',
      `DELETE FROM writing_items WHERE text_value IN ('${text}','${changedText}'); DELETE FROM lessons WHERE title IN ('${title}','${changedTitle}'); DELETE FROM error_types WHERE code='${code}';`,
    ],
    {
      env: {
        ...process.env,
        MYSQL_PWD: process.env.DB_PASSWORD || settings['db.password'],
      },
      encoding: 'utf8',
    },
  )
  expect(
    cleanup.status,
    'Only synthetic content from this test run is removed',
  ).toBe(0)
})

test('admin authors lessons, draws persistent templates, manages feedback and deletes unused content', async ({
  page,
}) => {
  test.setTimeout(120000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/dang-nhap', { waitUntil: 'domcontentloaded' })
  await page
    .getByLabel('Email', { exact: true })
    .fill(settings['app.bootstrap.admin.email'])
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill(settings['app.bootstrap.admin.password'])
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Tổng quan NétXinh' }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Quản lý bài học', exact: true })
    .click()
  await page.getByRole('button', { name: 'Thêm bài học', exact: true }).click()
  await page.getByLabel('Tên bài học', { exact: true }).fill(title)
  await page.getByLabel('Cấp học', { exact: true }).selectOption('LOP_1')
  await page.getByLabel('Thứ tự hiển thị').fill('88')
  await page.getByRole('button', { name: 'Lưu bài học', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Tìm bài học quản trị').fill(marker)
  await expect(
    page.getByRole('heading', { name: title, exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: `Sửa bài học ${title}`, exact: true })
    .click()
  await page.getByLabel('Tên bài học', { exact: true }).fill(changedTitle)
  await page.getByRole('button', { name: 'Lưu bài học', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: changedTitle, exact: true }),
  ).toBeVisible()
  await page
    .locator('.admin-lesson-card')
    .filter({
      has: page.getByRole('heading', { name: changedTitle, exact: true }),
    })
    .getByRole('link', { name: 'Quản lý nội dung', exact: true })
    .click()
  await page.getByRole('button', { name: 'Thêm nội dung', exact: true }).click()
  await page.getByLabel('Loại nội dung', { exact: true }).selectOption('WORD')
  await page.getByLabel('Chữ / số / từ / câu', { exact: true }).fill(text)
  const canvas = page.getByRole('dialog').locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) throw new Error('No drawing surface')
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(
      box.x + box.width * (0.2 + i * 0.3),
      box.y + box.height * 0.25,
    )
    await page.mouse.down()
    await page.mouse.move(
      box.x + box.width * (0.3 + i * 0.3),
      box.y + box.height * 0.7,
      { steps: 8 },
    )
    await page.mouse.up()
  }
  await expect(page.locator('.drawing-toolbar')).toContainText('2 nét')
  await page.getByRole('button', { name: 'Hoàn tác nét', exact: true }).click()
  await expect(page.locator('.drawing-toolbar')).toContainText('1 nét')
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/admin/items') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Lưu nội dung', exact: true }).click()
  const response = await responsePromise
  expect(response.status()).toBe(201)
  const saved = await response.json()
  expect(saved.template.width).toBe(900)
  expect(saved.template.strokes).toHaveLength(1)
  expect(saved.template.strokes[0].length).toBeGreaterThan(2)
  await page.getByLabel('Tìm nội dung', { exact: true }).fill(marker)
  await expect(page.getByRole('row').filter({ hasText: text })).toContainText(
    '1 nét',
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page
    .getByRole('button', { name: `Sửa nội dung ${text}`, exact: true })
    .click()
  await expect(page.locator('.drawing-toolbar')).toContainText('1 nét')
  await page
    .getByRole('button', { name: 'Xem thứ tự nét', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Xem thứ tự nét', exact: true }),
  ).toBeVisible({ timeout: 5000 })
  await page
    .getByLabel('Chữ / số / từ / câu', { exact: true })
    .fill(changedText)
  await page.getByLabel('Độ khó', { exact: true }).selectOption('3')
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page
      .getByRole('dialog')
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
  ).toBeTruthy()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({
    path: 'test-results/admin-canvas-mobile.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
  await page.getByRole('button', { name: 'Lưu nội dung', exact: true }).click()
  await expect(
    page.getByRole('row').filter({ hasText: changedText }),
  ).toContainText('3/3')
  await page.setViewportSize({ width: 1365, height: 920 })
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Quản lý bài học', exact: true })
    .click()
  await page.getByLabel('Tìm bài học quản trị').fill(marker)
  await page
    .getByRole('button', { name: `Xóa bài học ${changedTitle}`, exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Tất cả bài viết, kết quả nhận dạng, lỗi và tiến độ',
  )
  await page.getByRole('button', { name: 'Giữ lại', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: changedTitle, exact: true }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Loại lỗi & phản hồi', exact: true })
    .click()
  await page.getByRole('button', { name: 'Thêm loại lỗi', exact: true }).click()
  await page.getByLabel('Mã lỗi', { exact: true }).fill(code)
  await page
    .getByLabel('Tên lỗi tiếng Việt', { exact: true })
    .fill('Lỗi kiểm thử thân thiện')
  await page
    .getByLabel('Mẫu phản hồi tiếng Việt', { exact: true })
    .fill('Bé thử viết đều hơn nhé!')
  await page.getByRole('button', { name: 'Lưu loại lỗi', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Tìm loại lỗi', { exact: true }).fill(code)
  await expect(page.getByLabel('Tìm loại lỗi', { exact: true })).toHaveValue(
    code,
  )
  await page
    .getByRole('button', { name: `Sửa loại lỗi ${code}`, exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Chỉnh sửa loại lỗi', exact: true }),
  ).toBeVisible()
  await page
    .getByLabel('Mẫu phản hồi tiếng Việt', { exact: true })
    .fill('Bé đã cố gắng rồi, mình thử thêm lần nữa nhé!')
  await page.getByRole('button', { name: 'Lưu loại lỗi', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('Tìm loại lỗi', { exact: true })).toHaveValue(
    code,
  )
  await expect(
    page.locator('.error-type-card').filter({ hasText: code }),
  ).toContainText('mình thử thêm lần nữa')
  await page.screenshot({
    path: 'test-results/admin-feedback-desktop.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
  await page
    .getByRole('button', { name: `Xóa loại lỗi ${code}`, exact: true })
    .click()
  await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click()
  await expect(page.locator('.error-type-card')).toHaveCount(0)
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Nội dung & mẫu nét', exact: true })
    .click()
  await page.getByLabel('Tìm nội dung', { exact: true }).fill(marker)
  await page
    .getByRole('button', { name: `Xóa nội dung ${changedText}`, exact: true })
    .click()
  await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Chưa có nội dung phù hợp' }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Quản lý bài học', exact: true })
    .click()
  await page.getByLabel('Tìm bài học quản trị').fill(marker)
  await page
    .getByRole('button', { name: `Xóa bài học ${changedTitle}`, exact: true })
    .click()
  await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click()
  await expect(page.locator('.admin-lesson-card')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
