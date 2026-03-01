@echo off
chcp 65001 >nul
:: Remote-to-Native Mac Dev 원클릭 실행 스크립트 (Windows용 bkit 표준)
title bkit Mission Control - Remote Mac Dev Server

echo =============== bkit Mission Control ===============
echo [1/3] Node.js 의존성 점검...
if not exist "node_modules\" (
    echo node_modules가 없습니다. 의존성 설치를 진행합니다...
    call npm install
) else (
    echo 의존성 설치 확인 완료.
)

echo.
echo [2/3] 이전 실행 프로세스(포트 3000) 정리 확인...
:: Windows에서 3000번 포트를 사용중인 PID 찾기
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    if "%%a" NEQ "0" (
        echo 포트 3000을 점유중인 프로세스(PID: %%a)를 종료합니다.
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo [3/3] 개발 서버(Vite + Express WS)를 시작합니다...
echo 서버 종료: [Ctrl + C]
echo ==================================================

:: npm run dev 구동 (call을 쓰지 않으면 배치 창이 같이 꺼집니다)
call npm run dev
