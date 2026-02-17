/**
 * Screenshot command - Cross-platform screenshot capture
 *
 * Captures screenshots using native OS tools:
 * - Windows: PowerShell + System.Drawing + Win32 API
 * - macOS: screencapture + osascript
 * - Linux: maim/scrot + xdotool
 *
 * No project index required - standalone utility.
 *
 * v1.9.0 - Initial implementation
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { ScreenshotParams, ScreenshotResult, PlatformScreenshot } from './types.js';
import { win32Platform } from './platform-win32.js';
import { darwinPlatform } from './platform-darwin.js';
import { linuxPlatform } from './platform-linux.js';

// ============================================================
// Constants
// ============================================================

const DEFAULT_FILENAME = 'aidex-screenshot.png';

// ============================================================
// Platform Selection
// ============================================================

function getPlatformImpl(): PlatformScreenshot {
    switch (process.platform) {
        case 'win32':
            return win32Platform;
        case 'darwin':
            return darwinPlatform;
        case 'linux':
            return linuxPlatform;
        default:
            throw new Error(`Unsupported platform: ${process.platform}. Supported: Windows, macOS, Linux.`);
    }
}

// ============================================================
// Synchronous Delay
// ============================================================

function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ============================================================
// Implementation
// ============================================================

export function screenshot(params: ScreenshotParams): ScreenshotResult {
    const mode = params.mode ?? 'fullscreen';

    // Validate mode-specific requirements
    if (mode === 'window' && !params.window_title) {
        return {
            success: false,
            file_path: '',
            mode,
            error: 'window_title is required when mode is "window". Use aidex_windows to find window titles.',
        };
    }

    if (mode === 'rect') {
        if (params.x === undefined || params.y === undefined || params.width === undefined || params.height === undefined) {
            return {
                success: false,
                file_path: '',
                mode,
                error: 'x, y, width, and height are all required when mode is "rect".',
            };
        }
        if (params.width <= 0 || params.height <= 0) {
            return {
                success: false,
                file_path: '',
                mode,
                error: 'width and height must be positive.',
            };
        }
    }

    // Resolve file path
    const dir = params.save_path ?? tmpdir();
    const filename = params.filename ?? DEFAULT_FILENAME;
    const filePath = join(dir, filename);

    // Ensure target directory exists
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    // Apply delay
    if (params.delay && params.delay > 0) {
        sleepSync(Math.round(params.delay * 1000));
    }

    try {
        const impl = getPlatformImpl();

        switch (mode) {
            case 'fullscreen':
                impl.captureFullscreen(filePath, params.monitor);
                break;
            case 'active_window':
                impl.captureActiveWindow(filePath);
                break;
            case 'window':
                impl.captureWindow(filePath, params.window_title!);
                break;
            case 'region':
                impl.captureRegion(filePath);
                break;
            case 'rect':
                impl.captureRect(filePath, params.x!, params.y!, params.width!, params.height!);
                break;
        }

        // Verify file was created
        if (!existsSync(filePath)) {
            return {
                success: false,
                file_path: filePath,
                mode,
                error: 'Screenshot file was not created. The capture may have been cancelled or the tool failed silently.',
            };
        }

        return {
            success: true,
            file_path: filePath,
            mode,
            monitor: params.monitor,
        };
    } catch (error) {
        return {
            success: false,
            file_path: filePath,
            mode,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
