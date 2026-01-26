/**
 * PHP language configuration for CodeGraph
 */

/**
 * PHP keywords that should be filtered out during indexing
 */
export const PHP_KEYWORDS = new Set([
    // Control flow
    'if', 'elseif', 'else', 'switch', 'case', 'default',
    'for', 'foreach', 'while', 'do', 'break', 'continue',
    'goto', 'throw', 'try', 'catch', 'finally',

    // Functions & Classes
    'function', 'class', 'interface', 'trait', 'namespace',
    'abstract', 'final', 'static', 'const', 'var',

    // Visibility
    'public', 'protected', 'private', 'readonly',

    // Include/Require
    'include', 'include_once', 'require', 'require_once',
    'use',

    // Object operators
    'new', 'clone', 'instanceof', 'insteadof', 'implements', 'extends',

    // Output
    'echo', 'print',

    // Logical operators
    'and', 'or', 'xor',

    // Language constructs
    'array', 'list', 'eval', 'unset', 'empty', 'isset',
    'return', 'yield',

    // Declarations
    'declare', 'enddeclare', 'endif', 'endfor', 'endforeach',
    'endswitch', 'endwhile', 'callable',

    // Other
    '__halt_compiler', 'die', 'exit', 'fn', 'match', 'global',

    // Magic constants
    '__CLASS__', '__DIR__', '__FILE__', '__FUNCTION__',
    '__LINE__', '__METHOD__', '__NAMESPACE__', '__TRAIT__',

    // Literals
    'true', 'false', 'null',
]);

/**
 * Tree-sitter node types that represent identifiers in PHP
 */
export const PHP_IDENTIFIER_NODES = new Set([
    'name',
    'variable_name',
]);

/**
 * Tree-sitter node types for comments
 */
export const PHP_COMMENT_NODES = new Set([
    'comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const PHP_METHOD_NODES = new Set([
    'function_definition',
    'method_declaration',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const PHP_TYPE_NODES = new Set([
    'class_declaration',
    'interface_declaration',
    'trait_declaration',
    'enum_declaration',
]);

/**
 * Check if a term is a PHP keyword
 */
export function isKeyword(term: string): boolean {
    return PHP_KEYWORDS.has(term.toLowerCase());
}
