/**
 * Test file to verify electron mocks work with Vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron with our universal mocks
vi.mock('electron', async () => {
  const electronMock = await import('@/main/__mocks__/electron');
  return electronMock;
});

// Now import electron after mocking
import { app, BrowserWindow, ipcMain, dialog } from 'electron';

/* eslint-disable @typescript-eslint/unbound-method */
describe('Electron Mock Compatibility with Vitest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mock app methods', () => {
    const path = app.getPath('userData');
    expect(path).toBe('/mock/path/userData');

    const version = app.getVersion();
    expect(version).toBe('1.0.0-test');

    const locale = app.getLocale();
    expect(locale).toBe('en-US');

    const name = app.getName();
    expect(name).toBe('video-downloader');
  });

  it('should track mock calls', () => {
    app.getPath('temp');
    app.getPath('desktop');

    expect(app.getPath).toHaveBeenCalledTimes(2);
    expect(app.getPath).toHaveBeenCalledWith('temp');
    expect(app.getPath).toHaveBeenCalledWith('desktop');
  });

  it('should mock BrowserWindow', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const window = new (BrowserWindow as any)();
    expect(window).toBeDefined();
    expect(window.loadURL).toBeDefined();
    expect(window.webContents).toBeDefined();
    expect(window.webContents.send).toBeDefined();

    const result = window.isVisible();
    expect(result).toBe(true);
  });

  it('should mock ipcMain', () => {
    const handler = vi.fn();
    ipcMain.handle('test-channel', handler);

    expect(ipcMain.handle).toHaveBeenCalledTimes(1);
    expect(ipcMain.handle).toHaveBeenCalledWith('test-channel', handler);
  });

  it('should mock dialog with async methods', async () => {
    const result = await dialog.showOpenDialog({});
    expect(result).toEqual({
      canceled: false,
      filePaths: ['/mock/selected/path'],
    });

    const saveResult = await dialog.showSaveDialog({});
    expect(saveResult).toEqual({
      canceled: false,
      filePath: '/mock/save/path',
    });
  });

  it('should support mock configuration', () => {
    // Type assertion for mock function
    (app.getVersion as any).mockReturnValue('2.0.0-custom');
    const version = app.getVersion();
    expect(version).toBe('2.0.0-custom');
  });

  it('should work with vi.fn utilities', () => {
    const mockFn = vi.fn(() => 'test');

    // @ts-expect-error - vi.fn types are not fully compatible
    mockFn('arg1', 'arg2');
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(mockFn).toHaveReturnedWith('test');

    mockFn.mockReturnValueOnce('once');
    expect(mockFn()).toBe('once');
    expect(mockFn()).toBe('test');
  });
});
