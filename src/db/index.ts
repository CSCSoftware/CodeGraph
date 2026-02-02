/**
 * Database module exports
 */

export { AiDexDatabase, openDatabase, createDatabase } from './database.js';
export { Queries, createQueries } from './queries.js';
export type {
    FileRow,
    LineRow,
    ItemRow,
    OccurrenceRow,
    SignatureRow,
    MethodRow,
    TypeRow,
    DependencyRow,
    TaskRow,
    TaskLogRow,
} from './queries.js';
