@echo off
REM AiDex Scan - Find all indexed projects
REM Usage: aidex-scan.bat <path>
REM Example: aidex-scan.bat Q:\develop

if "%~1"=="" (
    echo Usage: aidex-scan.bat ^<path^>
    echo Example: aidex-scan.bat Q:\develop
    exit /b 1
)

node "%~dp0build\index.js" scan "%~1"
