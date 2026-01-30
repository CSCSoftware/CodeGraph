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
}

export interface NoteResult {
    success: boolean;
    note: string | null;
    action: 'read' | 'write' | 'append' | 'clear';
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
    const { path: projectPath, note: newNote, append, clear } = params;

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

    // Open database (read-write for writing, read-only for reading)
    const isWriteOperation = newNote !== undefined || clear;
    const db = openDatabase(dbPath, !isWriteOperation);

    try {
        if (clear) {
            // Clear the note
            db.deleteMetadata(NOTE_KEY);
            db.close();
            return {
                success: true,
                note: null,
                action: 'clear',
            };
        }

        if (newNote !== undefined) {
            // Write or append note
            let finalNote = newNote;

            if (append) {
                // Get existing note first
                const existing = db.getMetadata(NOTE_KEY);
                if (existing) {
                    finalNote = existing + '\n' + newNote;
                }
            }

            // Save the note
            db.setMetadata(NOTE_KEY, finalNote);
            db.close();

            return {
                success: true,
                note: finalNote,
                action: append ? 'append' : 'write',
            };
        }

        // Read note
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
