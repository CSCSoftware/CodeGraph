/**
 * Ruby language configuration for CodeGraph
 */

/**
 * Ruby keywords that should be filtered out during indexing
 */
export const RUBY_KEYWORDS = new Set([
    // Control flow
    'if', 'elsif', 'else', 'unless', 'then',
    'while', 'until', 'do', 'end',
    'for', 'in', 'case', 'when',

    // Definition
    'def', 'class', 'module', 'super', 'alias', 'undef',

    // Exception handling
    'begin', 'rescue', 'ensure', 'retry', 'raise',

    // Return & Flow control
    'return', 'yield', 'break', 'next', 'redo',

    // Literals & Values
    'true', 'false', 'nil', 'self',

    // Logical operators
    'and', 'or', 'not',

    // Special
    'defined?', 'BEGIN', 'END',

    // Magic constants
    '__LINE__', '__FILE__', '__ENCODING__',

    // Common built-ins (often noise)
    'attr_reader', 'attr_writer', 'attr_accessor',
    'private', 'protected', 'public',
    'require', 'require_relative', 'include', 'extend', 'prepend',
]);

/**
 * Tree-sitter node types that represent identifiers in Ruby
 */
export const RUBY_IDENTIFIER_NODES = new Set([
    'identifier',
    'constant',
    'instance_variable',
    'class_variable',
    'global_variable',
]);

/**
 * Tree-sitter node types for comments
 */
export const RUBY_COMMENT_NODES = new Set([
    'comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const RUBY_METHOD_NODES = new Set([
    'method',
    'singleton_method',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const RUBY_TYPE_NODES = new Set([
    'class',
    'module',
    'singleton_class',
]);

/**
 * Check if a term is a Ruby keyword
 */
export function isKeyword(term: string): boolean {
    return RUBY_KEYWORDS.has(term);
}
