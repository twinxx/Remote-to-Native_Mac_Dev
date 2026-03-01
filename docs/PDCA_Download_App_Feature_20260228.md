# PDCA - Mac 앱(.app) 원격 다운로드 환경 점검 및 개발 계획
**Date:** 2026-02-28
**Author:** bkit Assistant

## Plan (계획)
- **현재 상황 (Current State):**
  - **Front-end (`Dashboard.tsx`):** 빌드 성공 시 활성화되는 "Download .app" 버튼(UI)만 있고 아무런 `onClick` 로직이 없습니다.
  - **Back-end (`server.ts`):** 빌드 결과물은 로컬 폴더(ex: `.build/` 내부 혹은 `build/~~.app`)에 저장되지만 웹 클라이언트에서 해당 파일을 받아갈 수 있는 Express Route API나 WebSocket 이벤트가 전혀 구현되어 있지 않습니다.
- **해결 방안 (Solution):**
  1. `server.ts` 측에 Mac 네이티브 빌드 파일(`.app`은 디렉토리이므로 바로 브라우저 다운로드가 불가능, 따라서 묶어줄 필요가 있음)을 압축(ZIP)하여 클라이언트(브라우저)로 전달하는 API 엔드포인트(예: `GET /api/download/:project`) 추가.
  2. `Dashboard.tsx` 다운로드 버튼을 클릭 시 상기 API를 호출하고 자바스크립트 브라우저 단에서 임시 앵커(`<a>`) 태그를 생성하여 zip 파일을 로컬(Web 브라우저 실행 위치)으로 내려받게 구현.
  3. (옵션) 원격 Mac(Receiver) 쪽에서 빌드된 경우, `server.ts`에서 바로 꺼내줄 수 없으므로(터널링 환경), 다운로드 로직은 궁극적으로 Mac 로컬 수신기(Legacy Native 측)로부터 파일을 가져오는 흐름이 되어야 하나, **현재 구조상의 맹점**(server가 클라이언트이고 Mac VM이 터널로 물려 있는 역방향 릴레이 상태)이 있습니다.

- **향후 과제 (Architectural Decision Needed):**
  - 현재 빌드는 Native Mac 쪽에서 발생하고, `.app` 폴더도 Native Mac 쪽에 만들어집니다.
  - 이 `.app`을 로컬 웹 브라우저가 받으려면:
    `Browser` -> `server.ts` -> `WebSocket(Receiver)` -> `.zip 묶기` -> `Binary 전송` -> `server.ts` -> `Browser` 구조의 역방향 파이프라인 개발이 필요합니다.

## Next Steps 여부 확인 (To-Do)
- 사용자에게 위와 같은 복잡한 비동기 멀티 파트 바이너리 터널링 구현을 진행할지 컴펌 받습니다.
