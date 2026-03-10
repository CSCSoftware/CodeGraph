/**
 * global-guideline command
 *
 * Persistent key-value store in ~/.aidex/global.db for AI guidelines,
 * coding conventions, and project-wide rules.
 *
 * Use this to store named instructions that apply across all projects —
 * e.g. "review" → detailed review checklist, "release-prep" → release steps.
 */

import { openGlobalDatabase, type GuidelineRow } from '../../db/global-database.js';

// ============================================================
// Types
// ============================================================

export type GuidelineAction = 'set' | 'get' | 'list' | 'delete';

export interface GlobalGuidelineParams {
    action: GuidelineAction;
    key?: string;
    value?: string;
    filter?: string;
}

export interface GlobalGuidelineResult {
    success: boolean;
    action: GuidelineAction;
    guideline?: GuidelineRow;
    guidelines?: GuidelineRow[];
    deleted?: boolean;
    error?: string;
}

// ============================================================
// Implementation
// ============================================================

export function globalGuideline(params: GlobalGuidelineParams): GlobalGuidelineResult {
    const { action, key, value, filter } = params;

    // openGlobalDatabase() creates ~/.aidex/global.db if it doesn't exist yet —
    // so guidelines work even without prior global_init.
    const globalDb = openGlobalDatabase();

    try {
        switch (action) {

            case 'set': {
                if (!key) return { success: false, action, error: 'key is required for set' };
                if (value === undefined || value === null) return { success: false, action, error: 'value is required for set' };
                globalDb.setGuideline(key, value);
                const saved = globalDb.getGuideline(key);
                return { success: true, action, guideline: saved ?? undefined };
            }

            case 'get': {
                if (!key) return { success: false, action, error: 'key is required for get' };
                const row = globalDb.getGuideline(key);
                if (!row) return { success: false, action, error: `Guideline not found: "${key}"` };
                return { success: true, action, guideline: row };
            }

            case 'list': {
                const rows = globalDb.listGuidelines(filter);
                return { success: true, action, guidelines: rows };
            }

            case 'delete': {
                if (!key) return { success: false, action, error: 'key is required for delete' };
                const deleted = globalDb.deleteGuideline(key);
                return { success: true, action, deleted };
            }

            default:
                return { success: false, action, error: `Unknown action: ${action as string}` };
        }
    } catch (error) {
        return {
            success: false,
            action,
            error: error instanceof Error ? error.message : String(error),
        };
    } finally {
        globalDb.close();
    }
}
