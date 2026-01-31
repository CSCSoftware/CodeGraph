@echo off
REM Publish AiDex to npm
REM Usage: npm-publish.bat
REM
REM Prerequisites:
REM   - npm login (or auth token configured)
REM   - Version in package.json already bumped
REM
REM Note: Uses IPv4 to avoid ECONNRESET on some networks

echo Publishing aidex-mcp v%npm_package_version% to npm...
echo.

set NODE_OPTIONS=--dns-result-order=ipv4first
npm publish

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success! Published to https://www.npmjs.com/package/aidex-mcp
) else (
    echo.
    echo Failed! Check the error above.
)
