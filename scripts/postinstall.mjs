// Postinstall - auto-register AiDex with AI clients
// Skip with: AIDEX_NO_SETUP=1 npm install -g aidex-mcp

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

if (process.env.AIDEX_NO_SETUP === '1' || process.env.CI) {
    console.log('\n  AiDex installed. Setup skipped (AIDEX_NO_SETUP=1 or CI detected).\n');
    process.exit(0);
}

// Find the built index.js relative to this script
const thisDir = dirname(fileURLToPath(import.meta.url));
const indexJs = resolve(thisDir, '..', 'build', 'index.js');

if (!existsSync(indexJs)) {
    // Build not available yet (e.g. development install) - show hint
    console.log('\n  AiDex installed! Run "aidex setup" to register with your AI clients.\n');
    process.exit(0);
}

try {
    execSync(`"${process.execPath}" "${indexJs}" setup`, { stdio: 'inherit', timeout: 15000 });
} catch {
    // Setup failed - not critical, show manual hint
    console.log('\n  Auto-setup failed. Run "aidex setup" manually to register with your AI clients.\n');
}
