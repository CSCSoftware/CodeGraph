/**
 * Tree-sitter parser integration for CodeGraph
 */

import Parser from 'tree-sitter';

// Language grammars
import CSharp from 'tree-sitter-c-sharp';
import TypeScript from 'tree-sitter-typescript';
import Rust from 'tree-sitter-rust';
import Python from 'tree-sitter-python';

export type SupportedLanguage = 'csharp' | 'typescript' | 'javascript' | 'rust' | 'python';

// File extension to language mapping
const EXTENSION_MAP: Record<string, SupportedLanguage> = {
    '.cs': 'csharp',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.rs': 'rust',
    '.py': 'python',
    '.pyw': 'python',
};

// Cached parsers per language
const parsers: Map<SupportedLanguage, Parser> = new Map();

/**
 * Get or create a parser for the given language
 */
export function getParser(language: SupportedLanguage): Parser {
    let parser = parsers.get(language);
    if (parser) {
        return parser;
    }

    parser = new Parser();

    switch (language) {
        case 'csharp':
            parser.setLanguage(CSharp);
            break;
        case 'typescript':
            parser.setLanguage(TypeScript.typescript);
            break;
        case 'javascript':
            parser.setLanguage(TypeScript.typescript); // TS parser handles JS too
            break;
        case 'rust':
            parser.setLanguage(Rust);
            break;
        case 'python':
            parser.setLanguage(Python);
            break;
        default:
            throw new Error(`Unsupported language: ${language}`);
    }

    parsers.set(language, parser);
    return parser;
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return EXTENSION_MAP[ext] ?? null;
}

/**
 * Check if a file extension is supported
 */
export function isSupported(filePath: string): boolean {
    return detectLanguage(filePath) !== null;
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_MAP);
}

// Default buffer size for tree-sitter parser (1 MB)
// Fixes "Invalid argument" error for files > 32KB
// See: https://github.com/tree-sitter/tree-sitter/issues/3473
const PARSE_BUFFER_SIZE = 1024 * 1024;

/**
 * Parse source code and return the syntax tree
 */
export function parse(sourceCode: string, language: SupportedLanguage): Parser.Tree {
    const parser = getParser(language);
    return parser.parse(sourceCode, undefined, { bufferSize: PARSE_BUFFER_SIZE });
}

/**
 * Parse a file's content with auto-detected language
 */
export function parseFile(sourceCode: string, filePath: string): Parser.Tree | null {
    const language = detectLanguage(filePath);
    if (!language) {
        return null;
    }
    return parse(sourceCode, language);
}
