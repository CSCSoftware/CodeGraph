/**
 * Linux platform screenshot implementation
 *
 * Uses maim (preferred) or scrot (fallback) for capture,
 * xdotool for window identification, wmctrl for window listing.
 *
 * v1.9.0
 */

import { execSync } from 'child_process';
import type { PlatformScreenshot, WindowInfo } from './types.js';

// ============================================================
// Tool Detection
// ============================================================

function hasTool(name: string): boolean {
    try {
        execSync(`command -v ${name}`, {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
    } catch {
        return false;
    }
}

function requireTool(primary: string, fallback?: string): string {
    if (hasTool(primary)) return primary;
    if (fallback && hasTool(fallback)) return fallback;
    const installHint = fallback
        ? `Neither "${primary}" nor "${fallback}" found. Install one: sudo apt install ${primary}`
        : `"${primary}" not found. Install it: sudo apt install ${primary}`;
    throw new Error(installHint);
}

// ============================================================
// Platform Implementation
// ============================================================

export const linuxPlatform: PlatformScreenshot = {
    captureFullscreen(filePath: string, monitor?: number): void {
        const tool = requireTool('maim', 'scrot');
        if (tool === 'maim') {
            if (monitor !== undefined) {
                // Get monitor geometry via xrandr
                try {
                    const xrandrOutput = execSync('xrandr --query', {
                        encoding: 'utf8',
                        timeout: 5000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    const monitors = xrandrOutput
                        .split('\n')
                        .filter(line => line.includes(' connected'))
                        .map(line => {
                            const match = line.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
                            return match ? { w: match[1], h: match[2], x: match[3], y: match[4] } : null;
                        })
                        .filter(Boolean);

                    if (monitor < monitors.length && monitors[monitor]) {
                        const m = monitors[monitor]!;
                        execSync(`maim -g ${m.w}x${m.h}+${m.x}+${m.y} "${filePath}"`, {
                            timeout: 10000,
                            stdio: ['pipe', 'pipe', 'pipe'],
                        });
                        return;
                    }
                } catch { /* fall through to default capture */ }
            }
            execSync(`maim "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } else {
            execSync(`scrot "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
    },

    captureActiveWindow(filePath: string): void {
        const tool = requireTool('maim', 'scrot');
        if (tool === 'maim') {
            requireTool('xdotool');
            const windowId = execSync('xdotool getactivewindow', {
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
            execSync(`maim -i ${windowId} "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } else {
            execSync(`scrot -u "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
    },

    captureWindow(filePath: string, windowTitle: string): void {
        requireTool('xdotool');
        const tool = requireTool('maim', 'scrot');

        const escapedTitle = windowTitle.replace(/"/g, '\\"');
        let windowId: string;
        try {
            windowId = execSync(`xdotool search --name "${escapedTitle}" | head -1`, {
                encoding: 'utf8',
                timeout: 5000,
                shell: '/bin/bash',
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
        } catch {
            throw new Error(`Window not found: "${windowTitle}". Use aidex_windows to list available windows.`);
        }

        if (!windowId) {
            throw new Error(`Window not found: "${windowTitle}". Use aidex_windows to list available windows.`);
        }

        if (tool === 'maim') {
            execSync(`maim -i ${windowId} "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } else {
            // scrot can capture specific window via xdotool focus + scrot -u
            execSync(`xdotool windowfocus ${windowId} && sleep 0.2 && scrot -u "${filePath}"`, {
                timeout: 10000,
                shell: '/bin/bash',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
    },

    captureRect(filePath: string, x: number, y: number, width: number, height: number): void {
        const tool = requireTool('maim', 'scrot');
        if (tool === 'maim') {
            // maim -g WxH+X+Y captures a specific geometry
            execSync(`maim -g ${width}x${height}+${x}+${y} "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } else {
            // scrot doesn't support rect natively, capture full then crop with ImageMagick
            const tmpFile = filePath + '.tmp.png';
            execSync(`scrot "${tmpFile}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            requireTool('convert'); // ImageMagick
            execSync(`convert "${tmpFile}" -crop ${width}x${height}+${x}+${y} +repage "${filePath}"`, {
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            try { execSync(`rm "${tmpFile}"`, { stdio: ['pipe', 'pipe', 'pipe'] }); } catch { /* ignore */ }
        }
    },

    captureRegion(filePath: string): void {
        const tool = requireTool('maim', 'scrot');
        if (tool === 'maim') {
            // maim -s uses slop for interactive selection
            if (!hasTool('slop')) {
                throw new Error('"slop" is required for region selection with maim. Install it: sudo apt install slop');
            }
            execSync(`maim -s "${filePath}"`, {
                timeout: 120000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } else {
            execSync(`scrot -s "${filePath}"`, {
                timeout: 120000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
    },

    listWindows(): WindowInfo[] {
        if (hasTool('wmctrl')) {
            const output = execSync('wmctrl -l -p', {
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();

            if (!output) return [];

            return output.split('\n').filter(Boolean).map(line => {
                const parts = line.split(/\s+/);
                const pid = parseInt(parts[2], 10);
                const title = parts.slice(4).join(' ');
                return { pid: isNaN(pid) ? 0 : pid, process_name: '', title };
            });
        }

        if (hasTool('xdotool')) {
            let ids: string[];
            try {
                ids = execSync('xdotool search --name ""', {
                    encoding: 'utf8',
                    timeout: 5000,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim().split('\n').filter(Boolean);
            } catch {
                return [];
            }

            return ids.slice(0, 50).map(id => {
                try {
                    const title = execSync(`xdotool getwindowname ${id}`, {
                        encoding: 'utf8',
                        timeout: 2000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    }).trim();
                    let pid = 0;
                    try {
                        pid = parseInt(execSync(`xdotool getwindowpid ${id}`, {
                            encoding: 'utf8',
                            timeout: 2000,
                            stdio: ['pipe', 'pipe', 'pipe'],
                        }).trim(), 10);
                    } catch { /* some windows don't have PID */ }
                    return { pid: isNaN(pid) ? 0 : pid, process_name: '', title };
                } catch {
                    return { pid: 0, process_name: '', title: '' };
                }
            }).filter(w => w.title);
        }

        throw new Error('Neither "wmctrl" nor "xdotool" found. Install one: sudo apt install wmctrl');
    },
};
