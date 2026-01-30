/**
 * C language configuration for AiDex
 */

/**
 * C keywords that should be filtered out during indexing
 */
export const C_KEYWORDS = new Set([
    // Storage class specifiers
    'auto', 'extern', 'inline', 'register', 'static', 'thread_local',
    '__inline', '__inline__', '__forceinline', '__thread',

    // Type qualifiers
    'const', 'constexpr', 'restrict', 'volatile',
    '__restrict__', '__extension__', '_Atomic', '_Noreturn',
    'noreturn', '_Nonnull', 'alignas', '_Alignas',

    // Primitive types
    'bool', 'char', 'double', 'float', 'int', 'void',
    'signed', 'unsigned', 'short', 'long',
    'size_t', 'ssize_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t',
    'int8_t', 'int16_t', 'int32_t', 'int64_t',
    'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',

    // Control flow
    'break', 'case', 'continue', 'default', 'do', 'else',
    'for', 'goto', 'if', 'return', 'switch', 'while',

    // Type declaration
    'enum', 'struct', 'typedef', 'union',

    // Special operations
    'alignof', 'offsetof', 'sizeof', '_alignof', '_Generic',
    '__alignof', '__alignof__', '__asm', '__asm__', 'asm',

    // Exception handling (Windows)
    '__except', '__finally', '__leave', '__try',

    // Literal values
    'NULL', 'nullptr', 'true', 'false', 'TRUE', 'FALSE',
]);

/**
 * Tree-sitter node types that represent identifiers in C
 */
export const C_IDENTIFIER_NODES = new Set([
    'identifier',
    'type_identifier',
    'field_identifier',
]);

/**
 * Tree-sitter node types for comments
 */
export const C_COMMENT_NODES = new Set([
    'comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const C_METHOD_NODES = new Set([
    'function_definition',
    'function_declarator',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const C_TYPE_NODES = new Set([
    'struct_specifier',
    'union_specifier',
    'enum_specifier',
    'type_definition',
]);

/**
 * Check if a term is a C keyword
 */
export function isKeyword(term: string): boolean {
    return C_KEYWORDS.has(term);
}
