# Remote-to-Native Mac Dev 프로젝트 분석 보고서

**작성일**: 2026-02-28
**작성자**: bkit Assistant

## 1. 프로젝트 개요 (Overview)
본 프로젝트는 **웹 브라우저(React 기반 대시보드)와 Native Mac (Swift/Xcode) 환경 간의 원격 제어 및 동기화**를 목적으로 하는 하이브리드 풀스택 애플리케이션입니다. 

주된 특징:
- 원격 브라우저(Web UI) 환경에서 Native Mac의 로컬 빌드를 명령하고, 상태를 관제합니다.
- WebSocket을 통해 Web 클라이언트와 Mac 로컬 환경(Receiver) 간의 실시간 쌍방향 통신 채널을 구축합니다.
- Mac 환경 내의 앱 프로젝트 빌드 및 번들링(`.app` 생성) 과정을 자동화하는 스크립트 작성 로직이 포함되어 있습니다.

## 2. 기술 스택 (Tech Stack)
### Backend / Server-side
- **Runtime**: Node.js (via `tsx`)
- **Server Framework**: Express (`express`)
- **Real-time Comm**: WebSockets (`ws`)
- **File System/Watcher**: `chokidar` (파일 변경 감지 및 동기화)

### Frontend / Client-side
- **Framework**: React (`react`, `react-dom`) + Vite
- **Styling/UI**: React 기반 컴포넌트 구조 (`App.tsx`, `Dashboard.tsx`)
- **Icons**: `lucide-react`
- **Animations**: `motion`

### Build & Tooling
- **Language**: TypeScript (`tsconfig.json` ESNext 모듈 기준 설정)
- **Bundler**: Vite (`vite.config.ts`)

## 3. 핵심 아키텍처 및 동작 원리
### 3.1 `server.ts` (Core Logic)
`server.ts`는 프론트엔드 서빙(Vite SSR Middleware 통합)과 백엔드 API, WebSocket 서버 역할을 동시에 수행합니다.
- **WebSocket 핸들러**: 
  - `RECEIVER_AUTH`, `CONNECT_MAC`: Native Mac VM(혹은 로컬 수신기)과의 Inbound/Outbound 인증 및 터널링 구성.
  - `REQUEST_SYNC_ALL`, `REQUEST_FILES`: 웹 인터페이스에서 요청한 소스 코드를 Mac으로 전송(동기화).
  - `REQUEST_BUILD`: Mac 쪽으로 빌드를 요청.
- **`generateBuildScript` 함수**: 
  - 대상 프로젝트(`native_mac_dev` 또는 루트 하위 프로젝트) 안에서 `Package.swift` 의존성을 분석한 후, Mac Native App 번들링(`.app` 패키지 구성 및 아이콘 세팅 등)을 수행하는 bash 스크립트(`.auto_package.sh`)를 동적으로 생성합니다.

### 3.2 Frontend (`App.tsx`, `Dashboard.tsx`)
주로 WebSocket에 연결되어 Native VM의 상태를 시각화하고, 동기화(Sync) 밒 빌드(Build) 요청을 트리거하는 제어판(Control Panel) 역할을 합니다.

### 3.3 Receiver (`src/receiverScript.ts`)
웹소켓 서버(`server.ts`)에서 보낸 파일 변경 내역(File Update)이나 빌드 요청(Build Request)을 수신하고, Mac의 로컬 디스크 레벨에 반영하거나 쉘 스크립트 기반 이벤트를 실제로 구동하는 에이전트 역할을 담당할 것으로 보입니다.

## 4. 폴더 구조 최적화 및 정리 권장사항 (File Cleanup)
현재 루트 경로에 React 관련 파일과 Server 관련 파일이 혼재되어 있습니다. 

### 현재 상태 평가
- `App.tsx`, `Dashboard.tsx`, `index.tsx`, `index.html` 폴더들이 최상단 루트에 위치.
- 백엔드 코드인 `server.ts`가 루트에 위치.
- `src` 내부에는 `receiverScript.ts`만 남아있으며, 방금 독립 모듈형이었던 `native_mac_dev`가 상위로 분리되었습니다.

### 권장하는 디렉토리 구조 (bkit 표준 적용)
프로젝트 규모가 커짐에 따라 프론트엔드와 백엔드를 명확하게 분리하는 구조를 제안합니다.

```text
/Remote-to-Native_Mac_Dev
├── /docs                 # PDCA, 분석 보고서 등 작업 기록 (현재 위치 유지)
├── /native_mac_dev       # Swift 등 Mac Native 전용 타겟 프로젝트 영역 (독립 유지)
├── /client               # [신규 제안] 프론트엔드 소스 (UI/UX)
│   ├── index.html
│   ├── index.tsx
│   ├── App.tsx
│   └── Dashboard.tsx
├── /server               # [신규 제안] 백엔드 및 웹소켓 제어 소스
│   ├── server.ts
│   └── ...
├── /receiver             # [신규 제안] (구 src) Mac에 상주할 수신기(Agent) 소스
│   └── receiverScript.ts
├── package.json
└── vite.config.ts
```

> **참고**: 무작정 파일을 옮길 경우 `vite.config.ts` 등 빌드 설정이 깨질 수 있으므로, 재구조화(리팩토링) 시에는 각 설정들의 경로 업데이트가 필수적입니다. 당장 리팩토링이 부담스럽다면 `src` 안에 프론트엔드 소스(`App.tsx` 등)를 전부 집어넣고, `server.ts`만 루트에 두는 방식이 Vite의 기본 스탠스와 가장 잘 맞습니다.

## 5. 결론 및 향후 계획 (Next Steps)
1. **보고서 기반 의사결정**: 파일 정리(루트에 늘어져 있는 리액트 컴포넌트들을 `src`로 이동) 작업을 바로 진행할지 사용자(형님)의 승인을 받습니다.
2. **동기화 및 빌드 테스트**: 구조가 정리된 이후, `npm run dev`를 구동하여 Web UI와 Receiver 스크립트 간의 WebCocket 통신이 정상적으로 맺어지는지 점검합니다.
3. **지속적인 문서화**: 추가적인 요구사항 개발 시 `docs/` 폴더 내에 지속적으로 PDCA를 남깁니다.
