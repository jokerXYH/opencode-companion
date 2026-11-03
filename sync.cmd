@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "SRC=%USERPROFILE%\.config\opencode"
set "SKILLS=%USERPROFILE%\.agents\skills"
set "DST=%~dp0"
if "%DST:~-1%"=="\" set "DST=%DST:~0,-1%"

echo 同步配置到 %DST%

copy /Y "%SRC%\cli.json"        "%DST%\" >nul 2>&1
copy /Y "%SRC%\opencode.json"   "%DST%\" >nul 2>&1
copy /Y "%SRC%\cache-hit.json"  "%DST%\" >nul 2>&1
copy /Y "%SRC%\go-usage.py"     "%DST%\" >nul 2>&1
copy /Y "%SRC%\go-usage.cmd"    "%DST%\" >nul 2>&1

xcopy "%SRC%\plugins\go-usage" "%DST%\plugins\go-usage\" /E /Y /I /Q >nul
for /d %%P in ("%SRC%\plugins\*") do (
  if /i not "%%~nxP"=="go-usage" xcopy "%%~fP" "%DST%\plugins\%%~nxP\" /E /Y /I /Q >nul
)

if not exist "%DST%\skills\game-design"   mkdir "%DST%\skills\game-design"
if not exist "%DST%\skills\prompt-craft"  mkdir "%DST%\skills\prompt-craft"
copy /Y "%SKILLS%\game-design\SKILL.md"  "%DST%\skills\game-design\"  >nul 2>&1
copy /Y "%SKILLS%\prompt-craft\SKILL.md" "%DST%\skills\prompt-craft\" >nul 2>&1

echo 提交并推送...
git -C "%DST%" add -A
git -C "%DST%" -c user.name="opencode-sync" -c user.email="sync@local" commit -m "sync: %DATE% %TIME%"
if errorlevel 1 echo （没有新改动）
git -C "%DST%" push

echo.
echo 完成。
pause
