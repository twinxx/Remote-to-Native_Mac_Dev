#!/usr/bin/env bash
# Remote-to-Native Mac Dev 원클릭 실행 스크립트 (bkit 표준)

echo "=============== bkit Mission Control ==============="
echo "[1/3] Node.js 의존성 점검..."
if [ ! -d "node_modules" ]; then
    echo "node_modules가 없습니다. 의존성 설치를 진행합니다..."
    npm install
else
    echo "의존성 설치 확인 완료."
fi

echo "[2/3] 이전 실행 프로세스(포트 3000) 정리 확인..."
# 포트 3000을 점유중인 프로세스가 있다면 종료 조치 (선택적)
PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    echo "포트 3000을 점유중인 프로세스($PORT_PID)를 종료합니다."
    kill -9 $PORT_PID
fi

echo "[3/3] 개발 서버(Vite + Express WS)를 시작합니다..."
echo "서버 종료: [Ctrl + C]"
echo "=================================================="

# npm run dev 구동
npm run dev
