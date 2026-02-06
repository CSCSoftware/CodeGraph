/**
 * Screenshot types - shared across all platform implementations
 *
 * v1.9.0 - Initial screenshot support
 */

// ============================================================
// Screenshot Types
// ============================================================

export type ScreenshotMode = 'fullscreen' | 'active_window' | 'window' | 'region';

export interface ScreenshotParams {
    mode?: ScreenshotMode;
    window_title?: string;
    monitor?: number;
    delay?: number;
    filename?: string;
    save_path?: string;
}

export interface ScreenshotResult {
    success: boolean;
    file_path: string;
    mode: ScreenshotMode;
    monitor?: number;
    error?: string;
}

// ============================================================
// Window Listing Types
// ============================================================

export interface WindowInfo {
    title: string;
    pid: number;
    process_name: string;
}

export interface WindowsParams {
    filter?: string;
}

export interface WindowsResult {
    success: boolean;
    windows: WindowInfo[];
    platform: string;
    error?: string;
}

// ============================================================
// Platform Interface
// ============================================================

export interface PlatformScreenshot {
    captureFullscreen(filePath: string, monitor?: number): void;
    captureActiveWindow(filePath: string): void;
    captureWindow(filePath: string, windowTitle: string): void;
    captureRegion(filePath: string): void;
    listWindows(): WindowInfo[];
}
