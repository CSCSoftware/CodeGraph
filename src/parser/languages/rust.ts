/**
 * Rust language configuration for AiDex
 */

/**
 * Rust keywords that should be filtered out during indexing
 */
export const RUST_KEYWORDS = new Set([
    // Strict keywords
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate',
    'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if',
    'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut',
    'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
    'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',

    // Reserved keywords
    'abstract', 'become', 'box', 'do', 'final', 'macro', 'override',
    'priv', 'try', 'typeof', 'unsized', 'virtual', 'yield',

    // Weak keywords
    'union', 'dyn',

    // Primitive types
    'bool', 'char', 'str',
    'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
    'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
    'f32', 'f64',

    // Common types (often noise)
    'Option', 'Some', 'None', 'Result', 'Ok', 'Err',
    'Vec', 'String', 'Box', 'Rc', 'Arc', 'Cell', 'RefCell',
    'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet',
    'Fn', 'FnMut', 'FnOnce',
    'Send', 'Sync', 'Copy', 'Clone', 'Debug', 'Default',
    'Iterator', 'IntoIterator',

    // Common macros
    'println', 'print', 'format', 'panic', 'assert', 'assert_eq',
    'vec', 'todo', 'unimplemented', 'unreachable',
]);

/**
 * Tree-sitter node types that represent identifiers in Rust
 */
export const RUST_IDENTIFIER_NODES = new Set([
    'identifier',
    'type_identifier',
    'field_identifier',
]);

/**
 * Tree-sitter node types for comments
 */
export const RUST_COMMENT_NODES = new Set([
    'line_comment',
    'block_comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const RUST_METHOD_NODES = new Set([
    'function_item',
    'function_signature_item',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const RUST_TYPE_NODES = new Set([
    'struct_item',
    'enum_item',
    'trait_item',
    'type_item',
]);

/**
 * Check if a term is a Rust keyword
 */
export function isKeyword(term: string): boolean {
    return RUST_KEYWORDS.has(term);
}
