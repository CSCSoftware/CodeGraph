/**
 * Go language configuration for AiDex
 */

/**
 * Go keywords that should be filtered out during indexing
 */
export const GO_KEYWORDS = new Set([
    'break',
    'case',
    'chan',
    'const',
    'continue',
    'default',
    'defer',
    'else',
    'fallthrough',
    'for',
    'func',
    'go',
    'goto',
    'if',
    'import',
    'interface',
    'map',
    'package',
    'range',
    'return',
    'select',
    'struct',
    'switch',
    'type',
    'var',

    // Built-in types
    'bool', 'byte', 'complex64', 'complex128',
    'error', 'float32', 'float64',
    'int', 'int8', 'int16', 'int32', 'int64',
    'rune', 'string',
    'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',

    // Built-in constants
    'true', 'false', 'iota', 'nil',

    // Built-in functions (often noise)
    'append', 'cap', 'close', 'complex', 'copy', 'delete',
    'imag', 'len', 'make', 'new', 'panic', 'print', 'println',
    'real', 'recover',
]);

/**
 * Tree-sitter node types that represent identifiers in Go
 */
export const GO_IDENTIFIER_NODES = new Set([
    'identifier',
    'type_identifier',
    'field_identifier',
    'package_identifier',
]);

/**
 * Tree-sitter node types for comments
 */
export const GO_COMMENT_NODES = new Set([
    'comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const GO_METHOD_NODES = new Set([
    'function_declaration',
    'method_declaration',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const GO_TYPE_NODES = new Set([
    'type_declaration',
    'type_spec',
    'struct_type',
    'interface_type',
]);

/**
 * Check if a term is a Go keyword
 */
export function isKeyword(term: string): boolean {
    return GO_KEYWORDS.has(term);
}
