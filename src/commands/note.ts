/**
 * note command - Session notes for cross-session communication
 *
 * Stores a single text note in the project's AiDex database that persists
 * between sessions. Useful for:
 * - Reminders for the next session ("Test glob pattern fix!")
 * - User requests ("Remember to refactor X")
 * - Auto-generated notes before session end
 *
 * v1.3.0 - Session tracking integration
 * v1.10.0 - Note history: archived notes are searchable
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { PRODUCT_NAME, INDEX_DIR, TOOL_PREFIX } from '../constants.js';
import { openDatabase } from '../db/index.js';

// ============================================================
// Types
// ============================================================

export interface NoteParams {
    path: string;
    note?: string;      // If provided, sets the note. If omitted, reads current note.
    append?: boolean;   // If true, appends to existing note instead of replacing
    clear?: boolean;    // If true, clears the note
    history?: boolean;  // If true, shows archived note history
    search?: string;    // If provided, searches note history for this term
    limit?: number;     // Max history entries to return (default 20)
}

export interface NoteHistoryEntry {
    id: number;
    note: string;
    created_at: number;
}

export interface NoteResult {
    success: boolean;
    note: string | null;
    action: 'read' | 'write' | 'append' | 'clear' | 'history' | 'search';
    history?: NoteHistoryEntry[];
    historyCount?: number;
    error?: string;
}

// ============================================================
// Constants
// ============================================================

const NOTE_KEY = 'session_note';

// ============================================================
// Implementation
// ============================================================

export function note(params: NoteParams): NoteResult {
    const { path: projectPath, note: newNote, append, clear, history, search, limit } = params;

    // Validate project path
    const dbPath = join(projectPath, INDEX_DIR, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            note: null,
            action: 'read',
            error: `No ${PRODUCT_NAME} index found at ${projectPath}. Run ${TOOL_PREFIX}init first.`,
        };
    }

    // History and search need write access too (for auto-migration)
    const isWriteOperation = newNote !== undefined || clear;
    const needsReadWrite = isWriteOperation || history || search !== undefined;
    const db = openDatabase(dbPath, !needsReadWrite);

    try {
        // Auto-migrate: ensure note_history table exists (for DBs created before v1.10)
        if (needsReadWrite) {
            db.getDb().exec(`
                CREATE TABLE IF NOT EXISTS note_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    note TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_note_history_created ON note_history(created_at);
            `);
        }

        // --- Search history ---
        if (search !== undefined) {
            const results = db.searchNoteHistory(search, limit ?? 20);
            const totalCount = db.countNoteHistory();
            db.close();
            return {
                success: true,
                note: null,
                action: 'search',
                history: results,
                historyCount: totalCount,
            };
        }

        // --- Show history ---
        if (history) {
            const results = db.getNoteHistory(limit ?? 20);
            const totalCount = db.countNoteHistory();
            db.close();
            return {
                success: true,
                note: null,
                action: 'history',
                history: results,
                historyCount: totalCount,
            };
        }

        // --- Clear ---
        if (clear) {
            // Archive current note before clearing
            const existing = db.getMetadata(NOTE_KEY);
            if (existing) {
                db.archiveNote(existing);
            }
            db.deleteMetadata(NOTE_KEY);
            db.close();
            return {
                success: true,
                note: null,
                action: 'clear',
            };
        }

        // --- Write or append ---
        if (newNote !== undefined) {
            let finalNote = newNote;

            if (append) {
                const existing = db.getMetadata(NOTE_KEY);
                if (existing) {
                    finalNote = existing + '\n' + newNote;
                }
            } else {
                // Overwrite: archive the old note first
                const existing = db.getMetadata(NOTE_KEY);
                if (existing) {
                    db.archiveNote(existing);
                }
            }

            db.setMetadata(NOTE_KEY, finalNote);
            db.close();

            return {
                success: true,
                note: finalNote,
                action: append ? 'append' : 'write',
            };
        }

        // --- Read ---
        const currentNote = db.getMetadata(NOTE_KEY);
        db.close();

        return {
            success: true,
            note: currentNote,
            action: 'read',
        };

    } catch (error) {
        db.close();
        return {
            success: false,
            note: null,
            action: 'read',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Get note for a project (used internally by other tools to include in output)
 */
export function getSessionNote(projectPath: string): string | null {
    const dbPath = join(projectPath, INDEX_DIR, 'index.db');

    if (!existsSync(dbPath)) {
        return null;
    }

    try {
        const db = openDatabase(dbPath, true);
        const currentNote = db.getMetadata(NOTE_KEY);
        db.close();
        return currentNote;
    } catch {
        return null;
    }
}
