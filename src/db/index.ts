/**
 * Database module exports
 */

export { CodeGraphDatabase, openDatabase, createDatabase } from './database.js';
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
} from './queries.js';
