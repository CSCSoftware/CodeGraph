/**
 * Language configuration registry
 */

import type { SupportedLanguage } from '../tree-sitter.js';
import * as csharp from './csharp.js';
import * as typescript from './typescript.js';
import * as rust from './rust.js';
import * as python from './python.js';

export interface LanguageConfig {
    isKeyword: (term: string) => boolean;
    identifierNodes: Set<string>;
    commentNodes: Set<string>;
    methodNodes: Set<string>;
    typeNodes: Set<string>;
    propertyNodes?: Set<string>;
}

const configs: Record<SupportedLanguage, LanguageConfig> = {
    csharp: {
        isKeyword: csharp.isKeyword,
        identifierNodes: csharp.CSHARP_IDENTIFIER_NODES,
        commentNodes: csharp.CSHARP_COMMENT_NODES,
        methodNodes: csharp.CSHARP_METHOD_NODES,
        typeNodes: csharp.CSHARP_TYPE_NODES,
        propertyNodes: csharp.CSHARP_PROPERTY_NODES,
    },
    typescript: {
        isKeyword: typescript.isKeyword,
        identifierNodes: typescript.TYPESCRIPT_IDENTIFIER_NODES,
        commentNodes: typescript.TYPESCRIPT_COMMENT_NODES,
        methodNodes: typescript.TYPESCRIPT_METHOD_NODES,
        typeNodes: typescript.TYPESCRIPT_TYPE_NODES,
    },
    javascript: {
        // JavaScript uses same config as TypeScript
        isKeyword: typescript.isKeyword,
        identifierNodes: typescript.TYPESCRIPT_IDENTIFIER_NODES,
        commentNodes: typescript.TYPESCRIPT_COMMENT_NODES,
        methodNodes: typescript.TYPESCRIPT_METHOD_NODES,
        typeNodes: typescript.TYPESCRIPT_TYPE_NODES,
    },
    rust: {
        isKeyword: rust.isKeyword,
        identifierNodes: rust.RUST_IDENTIFIER_NODES,
        commentNodes: rust.RUST_COMMENT_NODES,
        methodNodes: rust.RUST_METHOD_NODES,
        typeNodes: rust.RUST_TYPE_NODES,
    },
    python: {
        isKeyword: python.isKeyword,
        identifierNodes: python.PYTHON_IDENTIFIER_NODES,
        commentNodes: python.PYTHON_COMMENT_NODES,
        methodNodes: python.PYTHON_METHOD_NODES,
        typeNodes: python.PYTHON_TYPE_NODES,
    },
};

/**
 * Get language configuration
 */
export function getLanguageConfig(language: SupportedLanguage): LanguageConfig {
    return configs[language];
}

/**
 * Check if a term is a keyword for the given language
 */
export function isKeyword(term: string, language: SupportedLanguage): boolean {
    return configs[language].isKeyword(term);
}
