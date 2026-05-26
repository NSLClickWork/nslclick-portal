@echo off
title NSL Click - Auto Share & Startup Panel
color 0C
cls

echo ====================================================================
echo             NSL CLICK - HUBER PORTAL AUTO-SHARE PANEL
echo ====================================================================
echo.

:: Get local IP address dynamically
set LOCAL_IP=127.0.0.1
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)
:ip_found
set LOCAL_IP=%LOCAL_IP: =%

echo [+] 1. Khoi dong Local Server (Port 3000)...
start "NSL Server (Port 3000)" cmd /c "npm run dev"
timeout /t 3 >nul

echo [+] 2. Tu dong mo duong truyen HTTPS (Localtunnel)...
start "NSL Tunnel (Localtunnel)" cmd /k "echo ========================================================== && echo  DUONG TRUYEN HTTPS CHINH (LOCALTUNNEL) && echo  Hay copy link 'your url is: ...' ben duoi de gui cho nguoi khac: && echo ========================================================== && echo. && npx -y localtunnel --port 3000"

echo [+] 3. Tu dong mo duong truyen HTTPS du phong (Localhost.run)...
start "NSL Tunnel (Localhost.run)" cmd /k "echo ========================================================== && echo  DUONG TRUYEN HTTPS DU PHONG (LOCALHOST.RUN) && echo  Hay copy link 'https://...lhr.life' ben duoi de gui cho nguoi khac: && echo ========================================================== && echo. && ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run"

echo.
echo ====================================================================
echo   DA KICH HOAT THANH CONG TOAN BO CAC CONG CHIA SE!
echo ====================================================================
echo   * Xem tren cung mang Wi-Fi (Dien thoai, Laptop cung Wi-Fi):
echo     👉 http://%LOCAL_IP%:3000
echo.
echo   * Xem tu xa qua Internet (Gui cho sep, doi tac, khac Wi-Fi):
echo     👉 Lay link tai 2 cua so Terminal (Localtunnel hoac Localhost.run) vua hien len!
echo ====================================================================
echo.
echo [!] Luu y: Giu cac cua so terminal chay de duy tri duong truyen.
echo.
echo Nhan phim bat ky de dong bang dieu khien (Server va Tunnel van tiep tuc chay).
pause >nul
exit
