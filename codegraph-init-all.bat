@echo off
REM CodeGraph Init All - Index all projects that don't have .codegraph yet
REM Usage: codegraph-init-all.bat <path>
REM Example: codegraph-init-all.bat Q:\develop\Repos

setlocal enabledelayedexpansion

if "%~1"=="" (
    echo Usage: codegraph-init-all.bat ^<path^>
    echo Example: codegraph-init-all.bat Q:\develop\Repos
    exit /b 1
)

set "ROOT=%~1"
set "CODEGRAPH_DIR=%~dp0"
set "COUNT=0"
set "SKIPPED=0"

echo.
echo CodeGraph Init All
echo ==================
echo Scanning: %ROOT%
echo.

REM Loop through immediate subdirectories
for /d %%D in ("%ROOT%\*") do (
    if exist "%%D\.codegraph\index.db" (
        echo [SKIP] %%~nxD - already indexed
        set /a SKIPPED+=1
    ) else (
        echo [INIT] %%~nxD
        node "%CODEGRAPH_DIR%build\index.js" init "%%D"
        if !errorlevel! equ 0 (
            set /a COUNT+=1
        ) else (
            echo        Failed - no supported source files?
            set /a SKIPPED+=1
        )
    )
)

echo.
echo ==================
echo Indexed: %COUNT% projects
echo Skipped: %SKIPPED% projects
