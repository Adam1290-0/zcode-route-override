@echo off
rem Plan B: standalone proxy mode - NO ZCode patching needed.
rem Usage: start-standalone-proxy.bat [upstream-url]
rem Then set the provider Base URL in ZCode to: http://127.0.0.1:8899/v1
rem Env overrides: PROXY_PORT (default 8899), PROXY_URL (default http://127.0.0.1:12334)
setlocal
set "UPSTREAM=%~1"
if "%UPSTREAM%"=="" set "UPSTREAM=https://agentrouter.org"
python "%~dp0standalone-proxy.py" "%UPSTREAM%"
pause
