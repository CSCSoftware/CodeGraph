@echo off
REM CodeGraph Scan - Find all indexed projects
REM Usage: codegraph-scan.bat <path>
REM Example: codegraph-scan.bat Q:\develop

if "%~1"=="" (
    echo Usage: codegraph-scan.bat ^<path^>
    echo Example: codegraph-scan.bat Q:\develop
    exit /b 1
)

node "%~dp0build\index.js" scan "%~1"
