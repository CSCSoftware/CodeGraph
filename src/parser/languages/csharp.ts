/**
 * C# language configuration for AiDex
 */

/**
 * C# keywords that should be filtered out during indexing
 */
export const CSHARP_KEYWORDS = new Set([
    // Access modifiers
    'public', 'private', 'protected', 'internal',

    // Type keywords
    'class', 'struct', 'interface', 'enum', 'record',
    'namespace', 'using',

    // Modifiers
    'static', 'readonly', 'const', 'volatile',
    'virtual', 'override', 'abstract', 'sealed',
    'async', 'await', 'partial', 'extern',
    'unsafe', 'fixed',

    // Primitive types
    'void', 'int', 'uint', 'long', 'ulong', 'short', 'ushort',
    'byte', 'sbyte', 'float', 'double', 'decimal',
    'bool', 'char', 'string', 'object', 'dynamic', 'var',
    'nint', 'nuint',

    // Control flow
    'if', 'else', 'switch', 'case', 'default',
    'for', 'foreach', 'while', 'do',
    'break', 'continue', 'return', 'yield',
    'try', 'catch', 'finally', 'throw',
    'goto', 'when',

    // Operators and literals
    'new', 'typeof', 'sizeof', 'nameof', 'default',
    'is', 'as', 'in', 'out', 'ref', 'params',
    'true', 'false', 'null',
    'this', 'base', 'value',

    // Property accessors
    'get', 'set', 'init', 'add', 'remove',

    // LINQ
    'where', 'select', 'from', 'orderby', 'group', 'by',
    'into', 'join', 'on', 'equals', 'let', 'ascending', 'descending',

    // Other
    'delegate', 'event', 'operator',
    'implicit', 'explicit',
    'checked', 'unchecked',
    'lock', 'stackalloc',
    'with', 'and', 'or', 'not',
    'required', 'file', 'scoped',

    // Common framework types (often noise)
    'Task', 'Action', 'Func', 'List', 'Dictionary',
    'IEnumerable', 'IList', 'ICollection',
]);

/**
 * Tree-sitter node types that represent identifiers in C#
 */
export const CSHARP_IDENTIFIER_NODES = new Set([
    'identifier',
    'type_identifier',
]);

/**
 * Tree-sitter node types for comments
 */
export const CSHARP_COMMENT_NODES = new Set([
    'comment',
    'multiline_comment',
]);

/**
 * Tree-sitter node types for method declarations
 */
export const CSHARP_METHOD_NODES = new Set([
    'method_declaration',
    'constructor_declaration',
    'operator_declaration',
    'conversion_operator_declaration',
    'local_function_statement',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const CSHARP_TYPE_NODES = new Set([
    'class_declaration',
    'struct_declaration',
    'interface_declaration',
    'enum_declaration',
    'record_declaration',
]);

/**
 * Tree-sitter node types for property declarations
 */
export const CSHARP_PROPERTY_NODES = new Set([
    'property_declaration',
    'indexer_declaration',
]);

/**
 * Check if a term is a C# keyword
 */
export function isKeyword(term: string): boolean {
    return CSHARP_KEYWORDS.has(term.toLowerCase());
}
