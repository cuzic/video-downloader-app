/**
 * Example E2E test file for Electron app
 * Uses Playwright for testing
 * Run with: bun run test:e2e or mise run test:e2e
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_IS_DEV: '0',
    },
  });

  // Get the first window that the app opens
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  // Close the app
  await electronApp.close();
});

test.describe('Application Launch', () => {
  test('should display the main window', async () => {
    // Check window title
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should have correct window dimensions', async () => {
    const windowState = await electronApp.evaluate(async ({ BrowserWindow }: any) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const bounds = mainWindow.getBounds();
      return {
        width: bounds.width,
        height: bounds.height,
        isVisible: mainWindow.isVisible(),
        isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
      };
    });

    expect(windowState.width).toBeGreaterThanOrEqual(800);
    expect(windowState.height).toBeGreaterThanOrEqual(600);
    expect(windowState.isVisible).toBe(true);
    expect(windowState.isDevToolsOpened).toBe(false);
  });
});

test.describe('IPC Communication', () => {
  test('should handle IPC messages', async () => {
    // Example: Test IPC communication
    const result = await electronApp.evaluate(async ({ ipcMain }: any) => {
      return new Promise((resolve) => {
        ipcMain.once('test-message', (_event: any, arg: any) => {
          resolve(arg);
        });
        
        // Trigger a test message from renderer
        const window = require('electron').BrowserWindow.getAllWindows()[0];
        window.webContents.send('trigger-test');
      });
    });

    // Adjust expectation based on your IPC implementation
    expect(result).toBeDefined();
  });
});

test.describe('Menu Actions', () => {
  test('should have application menu', async () => {
    const menuTemplate = await electronApp.evaluate(async ({ Menu }: any) => {
      const menu = Menu.getApplicationMenu();
      return menu ? true : false;
    });

    expect(menuTemplate).toBe(true);
  });
});

// Add more E2E tests as needed for your specific features