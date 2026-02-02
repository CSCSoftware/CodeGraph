/**
 * TypeScript/JavaScript language configuration for AiDex
 */

/**
 * TypeScript/JavaScript keywords that should be filtered out during indexing
 */
export const TYPESCRIPT_KEYWORDS = new Set([
    // Declarations
    'function', 'class', 'interface', 'type', 'enum',
    'const', 'let', 'var',
    'namespace', 'module', 'declare',

    // Modifiers
    'export', 'import', 'from', 'as',
    'public', 'private', 'protected',
    'static', 'readonly', 'abstract',
    'async', 'await',
    'override',

    // Primitive types
    'void', 'number', 'string', 'boolean', 'symbol', 'bigint',
    'any', 'unknown', 'never', 'object',

    // Control flow
    'if', 'else', 'switch', 'case', 'default',
    'for', 'while', 'do',
    'break', 'continue', 'return',
    'try', 'catch', 'finally', 'throw',
    'in', 'of',

    // Operators and literals
    'new', 'typeof', 'instanceof', 'delete', 'keyof',
    'true', 'false', 'null', 'undefined',
    'this', 'super',
    'is', 'infer', 'extends', 'implements',

    // Property accessors
    'get', 'set',

    // Other
    'constructor', 'with', 'debugger',
    'yield', 'satisfies',

    // Common framework types (often noise)
    'Promise', 'Array', 'Map', 'Set', 'Object', 'Function',
    'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit',
    'Exclude', 'Extract', 'ReturnType', 'Parameters',
]);

/**
 * Tree-sitter node types that represent identifiers in TypeScript
 */
export const TYPESCRIPT_IDENTIFIER_NODES = new Set([
    'identifier',
    'type_identifier',
    'property_identifier',
    'shorthand_property_identifier',
]);

/**
 * Tree-sitter node types for comments
 */
export const TYPESCRIPT_COMMENT_NODES = new Set([
    'comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const TYPESCRIPT_METHOD_NODES = new Set([
    'function_declaration',
    'method_definition',
    'arrow_function',
    'function_expression',
    'generator_function_declaration',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const TYPESCRIPT_TYPE_NODES = new Set([
    'class_declaration',
    'abstract_class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
]);

/**
 * Check if a term is a TypeScript keyword
 */
export function isKeyword(term: string): boolean {
    return TYPESCRIPT_KEYWORDS.has(term.toLowerCase());
}
