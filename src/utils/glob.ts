/**
 * Shared glob-to-regex conversion utility
 * Replaces 3 duplicate implementations in query.ts, signature.ts, and files.ts
 */

/**
 * Convert a glob pattern to a regular expression
 * Supports: *, **, ? and handles path separators correctly
 *
 * - `**\/` matches any path prefix (zero or more directories)
 * - `\/**` matches any path suffix
 * - `**` standalone matches anything
 * - `*` matches any characters except /
 * - `?` matches any single character except /
 */
export function globToRegex(pattern: string): RegExp {
    // Normalize to forward slashes
    pattern = pattern.replace(/\\/g, '/');

    // Escape regex special chars except * and ?
    let regex = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    // Convert glob patterns to regex using placeholders to avoid double-replacement
    regex = regex
        .replace(/\*\*\//g, '\x00STARSTARSLASH\x00')   // **/ placeholder
        .replace(/\/\*\*/g, '\x00SLASHSTARSTAR\x00')    // /** placeholder
        .replace(/\*\*/g, '\x00STARSTAR\x00')           // standalone ** placeholder
        .replace(/\*/g, '[^/]*')                         // * matches anything except /
        .replace(/\?/g, '[^/]')                          // ? matches single char except /
        .replace(/\x00STARSTARSLASH\x00/g, '(.*/)?')    // **/ = optional prefix ending with /
        .replace(/\x00SLASHSTARSTAR\x00/g, '(/.*)?')    // /** = optional suffix starting with /
        .replace(/\x00STARSTAR\x00/g, '.*');             // ** matches anything

    return new RegExp(`^${regex}$`, 'i');
}
