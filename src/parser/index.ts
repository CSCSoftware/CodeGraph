/**
 * Parser module exports
 */

export {
    extract,
    detectLanguage,
    isSupported,
    getSupportedExtensions,
    type ExtractionResult,
    type ExtractedItem,
    type ExtractedLine,
    type ExtractedMethod,
    type ExtractedType,
} from './extractor.js';

export { parse, parseFile, getParser, type SupportedLanguage } from './tree-sitter.js';

export { getLanguageConfig, isKeyword } from './languages/index.js';
