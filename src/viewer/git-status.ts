/**
 * Git status utilities for AiDex Viewer
 *
 * Provides git status per file to show colored cat icons:
 * - untracked (gray): Git doesn't know about file
 * - modified (yellow): Changed, not committed
 * - committed (blue): Committed locally, not pushed
 * - pushed (green): In sync with remote
 */

import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================
// Types
// ============================================================

export type GitFileStatus = 'untracked' | 'modified' | 'committed' | 'pushed';

export interface GitStatusInfo {
    isGitRepo: boolean;
    hasRemote: boolean;
    fileStatuses: Map<string, GitFileStatus>;
}

// ============================================================
// Implementation
// ============================================================

/**
 * Check if a directory is a git repository
 */
export function isGitRepo(projectPath: string): boolean {
    return existsSync(join(projectPath, '.git'));
}

/**
 * Get git status for all files in a project
 * Returns a map of relative file paths to their git status
 */
export async function getGitStatus(projectPath: string): Promise<GitStatusInfo> {
    if (!isGitRepo(projectPath)) {
        return {
            isGitRepo: false,
            hasRemote: false,
            fileStatuses: new Map()
        };
    }

    const git: SimpleGit = simpleGit(projectPath);
    const fileStatuses = new Map<string, GitFileStatus>();

    try {
        // Get current status (uncommitted changes)
        const status: StatusResult = await git.status();

        // Mark untracked files
        for (const file of status.not_added) {
            fileStatuses.set(normalizePathSeparators(file), 'untracked');
        }

        // Mark modified/staged files (not yet committed)
        for (const file of status.modified) {
            fileStatuses.set(normalizePathSeparators(file), 'modified');
        }
        for (const file of status.staged) {
            // Staged but not yet committed = still modified
            fileStatuses.set(normalizePathSeparators(file), 'modified');
        }
        for (const file of status.created) {
            // New staged files
            fileStatuses.set(normalizePathSeparators(file), 'modified');
        }
        for (const file of status.deleted) {
            fileStatuses.set(normalizePathSeparators(file), 'modified');
        }
        for (const file of status.renamed.map(r => r.to)) {
            fileStatuses.set(normalizePathSeparators(file), 'modified');
        }

        // Check if remote exists
        let hasRemote = false;
        try {
            const remotes = await git.getRemotes();
            hasRemote = remotes.length > 0;
        } catch {
            // No remotes
        }

        if (hasRemote) {
            // Get files that are committed locally but not pushed
            try {
                // Get current branch
                const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
                const currentBranch = branch.trim();

                // Check if remote tracking branch exists
                const trackingBranch = `origin/${currentBranch}`;

                try {
                    // Get commits ahead of remote
                    const log = await git.log([`${trackingBranch}..HEAD`, '--name-only']);

                    // Extract files from commits that haven't been pushed
                    for (const commit of log.all) {
                        // The diff field contains changed files
                        const diff = (commit as unknown as { diff?: { files: Array<{ file: string }> } }).diff;
                        if (diff?.files) {
                            for (const file of diff.files) {
                                const normalizedPath = normalizePathSeparators(file.file);
                                // Only mark as committed if not already modified/untracked
                                if (!fileStatuses.has(normalizedPath)) {
                                    fileStatuses.set(normalizedPath, 'committed');
                                }
                            }
                        }
                    }

                    // Alternative: use diff to get files
                    const diffOutput = await git.diff(['--name-only', trackingBranch, 'HEAD']);
                    if (diffOutput) {
                        for (const file of diffOutput.split('\n').filter(f => f.trim())) {
                            const normalizedPath = normalizePathSeparators(file);
                            if (!fileStatuses.has(normalizedPath)) {
                                fileStatuses.set(normalizedPath, 'committed');
                            }
                        }
                    }
                } catch {
                    // No tracking branch or other error - ignore
                }
            } catch {
                // Could not determine branch - ignore
            }
        }

        return {
            isGitRepo: true,
            hasRemote,
            fileStatuses
        };

    } catch (error) {
        console.error('Error getting git status:', error);
        return {
            isGitRepo: true,
            hasRemote: false,
            fileStatuses: new Map()
        };
    }
}

/**
 * Normalize path separators to forward slashes (for consistency)
 */
function normalizePathSeparators(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}
