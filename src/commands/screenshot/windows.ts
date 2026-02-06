/**
 * Window listing command - Lists all open windows
 *
 * Helper for aidex_screenshot mode="window" to find window titles.
 * No project index required - standalone utility.
 *
 * v1.9.0
 */

import type { WindowsParams, WindowsResult, PlatformScreenshot } from './types.js';
import { win32Platform } from './platform-win32.js';
import { darwinPlatform } from './platform-darwin.js';
import { linuxPlatform } from './platform-linux.js';

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
// Implementation
// ============================================================

export function listWindows(params: WindowsParams): WindowsResult {
    try {
        const impl = getPlatformImpl();
        let windows = impl.listWindows();

        // Apply optional filter
        if (params.filter) {
            const filterLower = params.filter.toLowerCase();
            windows = windows.filter(w =>
                w.title.toLowerCase().includes(filterLower)
            );
        }

        return {
            success: true,
            windows,
            platform: process.platform,
        };
    } catch (error) {
        return {
            success: false,
            windows: [],
            platform: process.platform,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
