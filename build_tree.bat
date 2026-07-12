@echo off
setlocal enabledelayedexpansion

:: Get the current folder path to use as a search term for removal
set "current_dir=%cd%\"

:: Create a temporary dummy folder for Robocopy
mkdir "%temp%\dummy_dest" 2>nul

:: List files while excluding folders
robocopy . "%temp%\dummy_dest" /L /E /XD .git .github public node_modules .vs /NJH /NJS /NC /NS /NDL > temp_structure.txt

:: Loop through each line, strip the current directory path, and save
(for /f "tokens=*" %%A in (temp_structure.txt) do (
    set "line=%%A"
    :: Strip the prefix out of the line
    set "line=!line:%current_dir%=!"
    echo !line!
)) > structure.txt

:: Clean up temporary files
del temp_structure.txt
rmdir "%temp%\dummy_dest" 2>nul

endlocal
