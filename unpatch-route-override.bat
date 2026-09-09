@echo off
setlocal

echo ============================================
echo ZCode Route Override - UNPATCH
echo ============================================
echo.

tasklist /FI "IMAGENAME eq ZCode.exe" 2>nul | findstr /I /C:"ZCode.exe" >nul
if %errorlevel% equ 0 (
    echo [ERROR] ZCode is still running! Close it first.
    pause
    exit /b 1
)

:: EDIT ME if your ZCode is installed elsewhere:
set "ASAR_PATH=H:\Zcode\resources\app.asar"
set "ASAR_BACKUP=%ASAR_PATH%.robak"
set "UNPACKED_PATH=H:\Zcode\resources\app.asar.unpacked"
set "UNPACKED_BACKUP=%UNPACKED_PATH%.robak"
set "ZCODE_CJS=H:\Zcode\resources\glm\zcode.cjs"
set "ZCODE_BAK=%ZCODE_CJS%.robak"

if exist "%ZCODE_BAK%" (
    copy /Y "%ZCODE_BAK%" "%ZCODE_CJS%" >nul
    echo [OK] zcode.cjs restored
) else (
    echo [i] no zcode.cjs backup found (maybe never injected)
)

if exist "%ASAR_BACKUP%" (
    copy /Y "%ASAR_BACKUP%" "%ASAR_PATH%" >nul
    if exist "%UNPACKED_BACKUP%" (
        rmdir /S /Q "%UNPACKED_PATH%" 2>nul
        xcopy "%UNPACKED_BACKUP%" "%UNPACKED_PATH%" /E /I /Y >nul
    )
    echo [OK] app.asar restored
    echo [NOTE] other asar patches applied AFTER this backup
    echo        are also reverted - re-run their patchers if needed.
) else (
    echo [i] no app.asar backup found
)

echo.
echo Done. Config/route files are untouched by uninstall.
echo.
pause
