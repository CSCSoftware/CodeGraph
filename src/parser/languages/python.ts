/**
 * Python language configuration for AiDex
 */

/**
 * Python keywords that should be filtered out during indexing
 */
export const PYTHON_KEYWORDS = new Set([
    // Keywords
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
    'try', 'while', 'with', 'yield',

    // Soft keywords (Python 3.10+)
    'match', 'case', 'type',

    // Built-in types
    'int', 'float', 'str', 'bool', 'bytes', 'list', 'dict', 'set',
    'tuple', 'frozenset', 'object', 'type',

    // Built-in functions (common ones)
    'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter',
    'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'round',
    'open', 'input', 'isinstance', 'issubclass', 'hasattr', 'getattr',
    'setattr', 'delattr', 'callable', 'iter', 'next', 'super',
    'staticmethod', 'classmethod', 'property',

    // Common exceptions
    'Exception', 'ValueError', 'TypeError', 'KeyError', 'IndexError',
    'AttributeError', 'RuntimeError', 'StopIteration',

    // Common decorators
    'abstractmethod', 'dataclass', 'overload',

    // Type hints
    'Optional', 'List', 'Dict', 'Set', 'Tuple', 'Union', 'Any',
    'Callable', 'Iterable', 'Iterator', 'Generator',
    'TypeVar', 'Generic', 'Protocol',

    // Magic names (dunder)
    'self', 'cls',
]);

/**
 * Tree-sitter node types that represent identifiers in Python
 */
export const PYTHON_IDENTIFIER_NODES = new Set([
    'identifier',
]);

/**
 * Tree-sitter node types for comments
 */
export const PYTHON_COMMENT_NODES = new Set([
    'comment',
]);

/**
 * Tree-sitter node types for function declarations
 */
export const PYTHON_METHOD_NODES = new Set([
    'function_definition',
]);

/**
 * Tree-sitter node types for type declarations
 */
export const PYTHON_TYPE_NODES = new Set([
    'class_definition',
]);

/**
 * Check if a term is a Python keyword
 */
export function isKeyword(term: string): boolean {
    return PYTHON_KEYWORDS.has(term);
}
