/**
 * global-signatures command
 *
 * Search for methods and types across ALL registered projects.
 */

import type Database from 'better-sqlite3';
import type { GlobalProject } from '../../db/global-database.js';
import { withGlobalDb } from './global-shared.js';

// ============================================================
// Types
// ============================================================

export type SignatureKind = 'method' | 'class' | 'struct' | 'interface' | 'enum' | 'type';

export interface GlobalSignaturesParams {
    term: string;
    kind?: SignatureKind;
    projectFilter?: string;
    tagFilter?: string;
    limit?: number;
}

export interface GlobalMethodMatch {
    name: string;
    prototype: string;
    file: string;
    lineNumber: number;
    visibility: string | null;
    isStatic: boolean;
    isAsync: boolean;
}

export interface GlobalTypeMatch {
    name: string;
    kind: string;
    file: string;
    lineNumber: number;
}

export interface GlobalSignaturesProjectResult {
    project: string;
    projectPath: string;
    methods: GlobalMethodMatch[];
    types: GlobalTypeMatch[];
}

export interface GlobalSignaturesResult {
    success: boolean;
    term: string;
    kind: SignatureKind | 'all';
    projectResults: GlobalSignaturesProjectResult[];
    totalMethods: number;
    totalTypes: number;
    projectsSearched: number;
    error?: string;
}

// ============================================================
// Implementation
// ============================================================

export function globalSignatures(params: GlobalSignaturesParams): GlobalSignaturesResult {
    const limit = params.limit ?? 50;
    const kind = params.kind ?? 'all' as const;

    return withGlobalDb<GlobalSignaturesResult>(
        (error) => ({
            success: false,
            term: params.term,
            kind: params.kind ?? 'all',
            projectResults: [],
            totalMethods: 0,
            totalTypes: 0,
            projectsSearched: 0,
            error,
        }),
        (globalDb) => {
            const filter: { tag?: string; namePattern?: string } = {};
            if (params.tagFilter) filter.tag = params.tagFilter;
            if (params.projectFilter) filter.namePattern = params.projectFilter;

            const projects = globalDb.getProjects(filter);

            if (projects.length === 0) {
                return {
                    success: true,
                    term: params.term,
                    kind: params.kind ?? 'all',
                    projectResults: [],
                    totalMethods: 0,
                    totalTypes: 0,
                    projectsSearched: 0,
                };
            }

            // Escape term for LIKE
            const escapedTerm = params.term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
            const likePattern = `%${escapedTerm}%`;

            interface CombinedResult {
                methods: GlobalMethodMatch[];
                types: GlobalTypeMatch[];
            }

            const queryFn = (db: Database.Database, alias: string, project: GlobalProject): CombinedResult[] => {
                const methods: GlobalMethodMatch[] = [];
                const types: GlobalTypeMatch[] = [];

                // Search methods
                if (kind === 'all' || kind === 'method') {
                    const methodSql = `
                        SELECT m.name, m.prototype, f.path, m.line_number, m.visibility, m.is_static, m.is_async
                        FROM ${alias}.methods m
                        JOIN ${alias}.files f ON m.file_id = f.id
                        WHERE m.name LIKE ? ESCAPE '\\' COLLATE NOCASE
                        ORDER BY f.path, m.line_number
                        LIMIT ?
                    `;

                    const rows = db.prepare(methodSql).all(likePattern, limit) as Array<{
                        name: string;
                        prototype: string;
                        path: string;
                        line_number: number;
                        visibility: string | null;
                        is_static: number;
                        is_async: number;
                    }>;

                    for (const row of rows) {
                        methods.push({
                            name: row.name,
                            prototype: row.prototype,
                            file: row.path,
                            lineNumber: row.line_number,
                            visibility: row.visibility,
                            isStatic: row.is_static === 1,
                            isAsync: row.is_async === 1,
                        });
                    }
                }

                // Search types
                if (kind === 'all' || kind !== 'method') {
                    let typeSql: string;
                    let typeParams: (string | number)[];
                    if (kind === 'all') {
                        typeSql = `
                            SELECT t.name, t.kind, f.path, t.line_number
                            FROM ${alias}.types t
                            JOIN ${alias}.files f ON t.file_id = f.id
                            WHERE t.name LIKE ? ESCAPE '\\' COLLATE NOCASE
                            ORDER BY f.path, t.line_number
                            LIMIT ?
                        `;
                        typeParams = [likePattern, limit];
                    } else {
                        // Specific kind (class, struct, interface, enum, type)
                        typeSql = `
                            SELECT t.name, t.kind, f.path, t.line_number
                            FROM ${alias}.types t
                            JOIN ${alias}.files f ON t.file_id = f.id
                            WHERE t.name LIKE ? ESCAPE '\\' COLLATE NOCASE AND t.kind = ?
                            ORDER BY f.path, t.line_number
                            LIMIT ?
                        `;
                        typeParams = [likePattern, kind, limit];
                    }

                    const rows = db.prepare(typeSql).all(...typeParams) as Array<{
                        name: string;
                        kind: string;
                        path: string;
                        line_number: number;
                    }>;

                    for (const row of rows) {
                        types.push({
                            name: row.name,
                            kind: row.kind,
                            file: row.path,
                            lineNumber: row.line_number,
                        });
                    }
                }

                if (methods.length === 0 && types.length === 0) return [];
                return [{ methods, types }];
            };

            const results = globalDb.queryAcrossProjects(projects, queryFn, limit);

            // Format output
            const projectResults: GlobalSignaturesProjectResult[] = results.map(r => ({
                project: r.project.name,
                projectPath: r.project.path,
                methods: r.results[0]?.methods ?? [],
                types: r.results[0]?.types ?? [],
            }));

            const totalMethods = projectResults.reduce((sum, pr) => sum + pr.methods.length, 0);
            const totalTypes = projectResults.reduce((sum, pr) => sum + pr.types.length, 0);

            return {
                success: true,
                term: params.term,
                kind: params.kind ?? 'all',
                projectResults,
                totalMethods,
                totalTypes,
                projectsSearched: projects.length,
            };
        }
    );
}
