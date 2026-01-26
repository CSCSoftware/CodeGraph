/**
 * Java language configuration for CodeGraph
 */

/**
 * Java keywords that should be filtered out during indexing
 */
export const JAVA_KEYWORDS = new Set([
    // Reserved keywords
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
    'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
    'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
    'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
    'package', 'private', 'protected', 'public', 'return', 'short', 'static',
    'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
    'transient', 'try', 'void', 'volatile', 'while',

    // Contextual keywords (reserved in specific contexts)
    'var', 'record', 'sealed', 'permits', 'yield', 'non-sealed',

    // Literals
    'true', 'false', 'null',
]);

/**
 * Tree-sitter node types that represent identifiers in Java
 */
export const JAVA_IDENTIFIER_NODES = new Set([
    'identifier',
    'type_identifier',
]);

/**
 * Tree-sitter node types for comments
 */
export const JAVA_COMMENT_NODES = new Set([
    'line_comment',
    'block_comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const JAVA_METHOD_NODES = new Set([
    'method_declaration',
    'constructor_declaration',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const JAVA_TYPE_NODES = new Set([
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'record_declaration',
    'annotation_type_declaration',
]);

/**
 * Check if a term is a Java keyword
 */
export function isKeyword(term: string): boolean {
    return JAVA_KEYWORDS.has(term);
}
