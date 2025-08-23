import { test, expect, Page, ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'node:path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
  });
  
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Video Downloader App', () => {
  test('should display the main window', async () => {
    const title = await page.title();
    expect(title).toBe('Video Downloader');
  });

  test('should have URL input field', async () => {
    const urlInput = await page.locator('input[placeholder*="URL"]');
    await expect(urlInput).toBeVisible();
  });

  test('should have download button', async () => {
    const downloadButton = await page.locator('button:has-text("Download")');
    await expect(downloadButton).toBeVisible();
  });

  test('should show error for invalid URL', async () => {
    const urlInput = await page.locator('input[placeholder*="URL"]');
    const downloadButton = await page.locator('button:has-text("Download")');
    
    await urlInput.fill('invalid-url');
    await downloadButton.click();
    
    const error = await page.locator('.error-message');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Invalid URL');
  });
});