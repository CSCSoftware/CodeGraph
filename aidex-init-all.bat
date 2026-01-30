@echo off
REM AiDex Init All - Index all git projects recursively that don't have .aidex yet
REM Usage: aidex-init-all.bat <path>
REM Example: aidex-init-all.bat Q:\develop\Repos

setlocal enabledelayedexpansion

if "%~1"=="" (
    echo Usage: aidex-init-all.bat ^<path^>
    echo Example: aidex-init-all.bat Q:\develop\Repos
    exit /b 1
)

set "ROOT=%~1"
set "AIDEX_DIR=%~dp0"
set "COUNT=0"
set "SKIPPED=0"

echo.
echo AiDex Init All
echo ==================
echo Scanning: %ROOT%
echo.

REM Find all git repos by looking for .git directories
for /r "%ROOT%" %%G in (.git) do (
    if exist "%%G\HEAD" (
        set "PROJ=%%~dpG"
        REM Remove trailing backslash
        set "PROJ=!PROJ:~0,-1!"

        if exist "!PROJ!\.aidex\index.db" (
            echo [SKIP] !PROJ!
            set /a SKIPPED+=1
        ) else (
            echo [INIT] !PROJ!
            node "!AIDEX_DIR!build\index.js" init "!PROJ!"
            if !errorlevel! equ 0 (
                set /a COUNT+=1
            ) else (
                echo        Failed - no supported source files?
                set /a SKIPPED+=1
            )
        )
    )
)

echo.
echo ==================
echo Indexed: %COUNT% projects
echo Skipped: %SKIPPED% projects
