@echo off
REM Cursor Windows hook wrapper. A .cmd entry lets python inherit stdin;
REM log_hook.py also falls back to CURSOR_TRANSCRIPT_PATH if the pipe is empty.
set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1
call "%~dp0_pyrun.cmd" -u "%~dp0log_hook.py" --tool=cursor
