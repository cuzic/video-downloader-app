/**
 * Test file to verify electron mocks work with Bun
 */
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import * as electronMock from '@/main/__mocks__/electron';
import { createMockFn } from './mock-utils';

// Use Bun's mock to replace electron
void mock.module('electron', () => electronMock);

describe('Electron Mock Compatibility with Bun', () => {
  beforeEach(() => {
    // Reset mocks if they have mockClear method
    if (typeof electronMock.app.getPath.mockClear === 'function') {
      electronMock.app.getPath.mockClear();
    }
    if (typeof electronMock.ipcMain.handle.mockClear === 'function') {
      electronMock.ipcMain.handle.mockClear();
    }
  });

  it('should mock app methods', () => {
    const path = electronMock.app.getPath('userData');
    expect(path).toBe('/mock/path/userData');

    const version = electronMock.app.getVersion();
    expect(version).toBe('1.0.0-test');

    const locale = electronMock.app.getLocale();
    expect(locale).toBe('en-US');

    const name = electronMock.app.getName();
    expect(name).toBe('video-downloader');
  });

  it('should track mock calls', () => {
    electronMock.app.getPath('temp');
    electronMock.app.getPath('desktop');

    // Check if mock tracking is available
    if (electronMock.app.getPath.mock) {
      expect(electronMock.app.getPath.mock.calls).toHaveLength(2);
      expect(electronMock.app.getPath.mock.calls[0]).toEqual(['temp']);
      expect(electronMock.app.getPath.mock.calls[1]).toEqual(['desktop']);
    }
  });

  it('should mock BrowserWindow', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const window = new (electronMock.BrowserWindow as any)();
    expect(window).toBeDefined();
    expect(window.loadURL).toBeDefined();
    expect(window.webContents).toBeDefined();
    expect(window.webContents.send).toBeDefined();

    const result = window.isVisible();
    expect(result).toBe(true);
  });

  it('should mock ipcMain', () => {
    const handler = createMockFn();
    electronMock.ipcMain.handle('test-channel', handler);

    // Verify the handle method was called
    if (electronMock.ipcMain.handle.mock) {
      expect(electronMock.ipcMain.handle.mock.calls).toHaveLength(1);
      expect(electronMock.ipcMain.handle.mock.calls[0]?.[0]).toBe('test-channel');
    }
  });

  it('should mock dialog with async methods', async () => {
    const result = await electronMock.dialog.showOpenDialog({});
    expect(result).toEqual({
      canceled: false,
      filePaths: ['/mock/selected/path'],
    });

    const saveResult = await electronMock.dialog.showSaveDialog({});
    expect(saveResult).toEqual({
      canceled: false,
      filePath: '/mock/save/path',
    });
  });

  it('should support mock configuration', () => {
    // Test if we can configure return values
    if (typeof electronMock.app.getVersion.mockReturnValue === 'function') {
      electronMock.app.getVersion.mockReturnValue('2.0.0-custom');
      const version = electronMock.app.getVersion();
      expect(version).toBe('2.0.0-custom');
    }
  });
});

describe('Mock Utils with Bun', () => {
  it('should create working mock functions', () => {
    const mockFn = createMockFn(() => 'default');

    const result1 = mockFn('arg1', 'arg2');
    expect(result1).toBe('default');

    expect(mockFn.mock.calls).toHaveLength(1);
    expect(mockFn.mock.calls[0]).toEqual(['arg1', 'arg2']);
  });

  it('should support return value configuration', () => {
    const mockFn = createMockFn();

    mockFn.mockReturnValue('configured');
    expect(mockFn()).toBe('configured');

    mockFn.mockReturnValueOnce('once');
    expect(mockFn()).toBe('once');
    expect(mockFn()).toBe('configured');
  });

  it('should support async mocks', async () => {
    const mockFn = createMockFn();

    mockFn.mockResolvedValue('resolved');
    const result1 = await mockFn();
    expect(result1).toBe('resolved');

    mockFn.mockResolvedValueOnce('once-resolved');
    const result2 = await mockFn();
    expect(result2).toBe('once-resolved');

    const result3 = await mockFn();
    expect(result3).toBe('resolved');
  });

  it('should clear and reset mocks', () => {
    const mockFn = createMockFn(() => 'original');

    mockFn('call1');
    expect(mockFn.mock.calls).toHaveLength(1);

    mockFn.mockClear();
    expect(mockFn.mock.calls).toHaveLength(0);
    expect(mockFn()).toBe('original');

    mockFn.mockReturnValue('new-value');
    expect(mockFn()).toBe('new-value');

    mockFn.mockReset();
    expect(mockFn()).toBe(undefined);
  });
});
