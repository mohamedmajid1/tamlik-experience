@echo off
rem Plays the Tamlik film full screen WITH SOUND, no click needed.
rem Browsers block sound until someone clicks; this starts Microsoft Edge with that rule switched off,
rem in its own profile so it works even when Edge is already open. Press Alt+F4 to close.
rem Add ?mute to the address to play silently, or pass another address:  "Play Tamlik.bat" https://tamlik.pages.dev
set "URL=https://mohamedmajid1.github.io/tamlik-experience/"
if not "%~1"=="" set "URL=%~1"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
start "" "%EDGE%" --user-data-dir="%LOCALAPPDATA%\TamlikScreen" --no-first-run --autoplay-policy=no-user-gesture-required --kiosk "%URL%" --edge-kiosk-type=fullscreen
