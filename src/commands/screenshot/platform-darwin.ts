/**
 * macOS platform screenshot implementation
 *
 * Uses native `screencapture` and `osascript` commands.
 * macOS has excellent built-in support for all capture modes.
 *
 * v1.9.0
 */

import { execSync } from 'child_process';
import type { PlatformScreenshot, WindowInfo } from './types.js';

// ============================================================
// Platform Implementation
// ============================================================

export const darwinPlatform: PlatformScreenshot = {
    captureFullscreen(filePath: string, monitor?: number): void {
        if (monitor !== undefined) {
            // -D<display> selects monitor (1-based in screencapture)
            execSync(`screencapture -x -D${monitor + 1} "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } else {
            execSync(`screencapture -x "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
    },

    captureActiveWindow(filePath: string): void {
        // Get the window ID of the frontmost window via osascript
        const script = `
tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set frontWin to front window of frontApp
    return id of frontWin
end tell`;
        try {
            const windowId = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
                encoding: 'utf8',
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
            execSync(`screencapture -x -l${windowId} "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } catch {
            // Fallback: use interactive window capture (space selects window)
            // -w captures window under cursor, -o excludes shadow
            execSync(`screencapture -x -o -w "${filePath}"`, {
                timeout: 30000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
    },

    captureWindow(filePath: string, windowTitle: string): void {
        const escapedTitle = windowTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const script = `
tell application "System Events"
    set matchedId to 0
    repeat with proc in (every application process whose visible is true)
        repeat with w in (every window of proc)
            if name of w contains "${escapedTitle}" then
                set matchedId to id of w
                exit repeat
            end if
        end repeat
        if matchedId > 0 then exit repeat
    end repeat
    return matchedId
end tell`;

        const windowId = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
            encoding: 'utf8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        if (windowId === '0' || !windowId) {
            throw new Error(`Window not found: "${windowTitle}". Use aidex_windows to list available windows.`);
        }

        execSync(`screencapture -x -l${windowId} "${filePath}"`, {
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    },

    captureRegion(filePath: string): void {
        // -i enables interactive selection (crosshair cursor)
        // User can press Space to toggle window/selection mode, Escape to cancel
        execSync(`screencapture -i "${filePath}"`, {
            timeout: 120000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    },

    listWindows(): WindowInfo[] {
        const script = `
tell application "System Events"
    set output to ""
    repeat with proc in (every application process whose visible is true)
        set pid to unix id of proc
        set pname to name of proc
        try
            repeat with w in (every window of proc)
                set wname to name of w
                set output to output & pid & "|" & pname & "|" & wname & linefeed
            end repeat
        end try
    end repeat
    return output
end tell`;

        const output = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
            encoding: 'utf8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        if (!output) return [];

        return output.split('\n').filter(Boolean).map(line => {
            const [pidStr, processName, ...titleParts] = line.split('|');
            return {
                pid: parseInt(pidStr, 10),
                process_name: processName || '',
                title: titleParts.join('|'),
            };
        });
    },
};
