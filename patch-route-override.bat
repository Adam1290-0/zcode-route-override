@echo off
setlocal enabledelayedexpansion

echo ============================================
echo ZCode Route Override Patcher
echo (per-provider header preset + VPN tunnel)
echo ============================================
echo.

:: ZCode must be fully closed (asar repack would be undone by a running app)
tasklist /FI "IMAGENAME eq ZCode.exe" 2>nul | findstr /I /C:"ZCode.exe" >nul
if %errorlevel% equ 0 (
    echo [ERROR] ZCode is still running!
    echo Please close ZCode completely and try again.
    pause
    exit /b 1
)

set "BASE=%~dp0"
:: EDIT ME if your ZCode is installed elsewhere:
set "ASAR_PATH=H:\Zcode\resources\app.asar"
set "ASAR_BACKUP=%ASAR_PATH%.robak"
set "UNPACKED_PATH=H:\Zcode\resources\app.asar.unpacked"
set "UNPACKED_BACKUP=%UNPACKED_PATH%.robak"
set "UI_JS=%BASE%ui_route_override.js"
set "TOKEN_FILE=%BASE%auth-token"
set "INJECT_UI_PY=%BASE%inject-route-override-ui.py"
set "INJECT_ZCODE_PY=%BASE%inject-zcode-wrapper.py"
:: pinned tool version (reproducible builds; tested with 4.3.0)
set "ASAR_PKG=@electron/asar@4.3.0"

if not exist "%ASAR_PATH%"      ( echo [ERROR] app.asar not found: %ASAR_PATH% & pause & exit /b 1 )
if not exist "%UI_JS%"          ( echo [ERROR] ui_route_override.js not found: %UI_JS% & pause & exit /b 1 )
if not exist "%INJECT_UI_PY%"   ( echo [ERROR] inject-route-override-ui.py not found: %INJECT_UI_PY% & pause & exit /b 1 )
if not exist "%INJECT_ZCODE_PY%" ( echo [ERROR] inject-zcode-wrapper.py not found: %INJECT_ZCODE_PY% & pause & exit /b 1 )

:: ---- 1. zcode.cjs wrapper injection (idempotent, has own backup logic) ----
echo [1/5] Injecting wrapper into zcode.cjs...
python "%INJECT_ZCODE_PY%"
if !errorlevel! neq 0 ( echo [ERROR] zcode.cjs injection failed & pause & exit /b 1 )

:: ---- 2. Backup asar + unpacked (refresh when app updated = size changed) ----
for %%A in ("%ASAR_PATH%") do set CUR_SIZE=%%~zA
set REFRESH=1
if exist "%ASAR_BACKUP%" (
    for %%B in ("%ASAR_BACKUP%") do set BAK_SIZE=%%~zB
    if !BAK_SIZE! equ !CUR_SIZE! set REFRESH=0
)
if !REFRESH! equ 1 (
    echo [2/5] Saving asar backup...
    copy /Y "%ASAR_PATH%" "%ASAR_BACKUP%" >nul
    if exist "%UNPACKED_PATH%" (
        if exist "%UNPACKED_BACKUP%" rmdir /S /Q "%UNPACKED_BACKUP%" 2>nul
        xcopy "%UNPACKED_PATH%" "%UNPACKED_BACKUP%" /E /I /Y >nul
    )
) else (
    echo [2/5] Backup already current, skip.
)

:: ---- 3. Extract CURRENT asar (preserves other injections) ----
echo [3/5] Extracting current asar (2-3 minutes)...
set "EXTRACT_DIR=%TEMP%\zro-asar-patch"
if exist "%EXTRACT_DIR%" rmdir /S /Q "%EXTRACT_DIR%" 2>nul
call npx --yes %ASAR_PKG% extract "%ASAR_PATH%" "%EXTRACT_DIR%"
if !errorlevel! neq 0 ( echo [ERROR] Extraction failed & pause & exit /b 1 )

:: ---- 4. Inject renderer UI (also creates the auth token) ----
echo [4/5] Injecting settings-page UI...
python "%INJECT_UI_PY%" "%EXTRACT_DIR%\out" "%UI_JS%" "%TOKEN_FILE%"
if !errorlevel! neq 0 ( echo [ERROR] UI injection failed & pause & exit /b 1 )

:: ---- 5. Repack (old .unpacked removed only AFTER a successful pack) ----
echo [5/5] Repacking asar (2-3 minutes)...
call npx --yes %ASAR_PKG% pack "%EXTRACT_DIR%" "%ASAR_PATH%.new" --unpack "*.{node,dll,exe}"
if !errorlevel! neq 0 (
    echo [ERROR] Repacking failed. Nothing was modified.
    rmdir /S /Q "%EXTRACT_DIR%" 2>nul
    pause
    exit /b 1
)
del /F /Q "%ASAR_PATH%.new" >nul 2>&1
call npx --yes %ASAR_PKG% pack "%EXTRACT_DIR%" "%ASAR_PATH%" --unpack "*.{node,dll,exe}"
if !errorlevel! neq 0 (
    echo [ERROR] Repacking failed. Restoring backup...
    copy /Y "%ASAR_BACKUP%" "%ASAR_PATH%" >nul
    if exist "%UNPACKED_BACKUP%" (
        rmdir /S /Q "%UNPACKED_PATH%" 2>nul
        xcopy "%UNPACKED_BACKUP%" "%UNPACKED_PATH%" /E /I /Y >nul
    )
    rmdir /S /Q "%EXTRACT_DIR%" 2>nul
    pause
    exit /b 1
)
rmdir /S /Q "%EXTRACT_DIR%" 2>nul

echo.
echo ============================================
echo [SUCCESS] Route Override patched!
echo ============================================
echo.
echo Open ZCode - Settings - Model Settings - select a
echo custom provider: header/network controls appear
echo below Base URL.
echo.
echo Re-run this after every ZCode upgrade.
echo To revert: run unpatch-route-override.bat
echo.
pause
