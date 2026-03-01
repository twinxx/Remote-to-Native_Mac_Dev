# Remote-to-Native Mac DevTool (bkit Standard)

🚀 **웹(브라우저) 환경에서 코딩한 내용을 로컬 또는 가상 머신(UTM)의 Mac으로 실시간 동기화하고, 즉시 빌드 및 화면 스트리밍을 제공하는 혁신적인 미들웨어 플랫폼입니다.**

이 프로젝트는 Mac이 없는 윈도우/리눅스 유저나 아이패드 사용자가, 원격지에 있는 Mac 환경을 마치 내 컴퓨터의 브라우저 UI처럼 간편하게 다루며 iOS/macOS Native App(Swift)을 개발할 수 있도록 설계되었습니다.

---

## 🌟 주요 기능 (Features)

1. **실시간 코드 동기화 (Smart Sync)**
   - WebSocket 기반으로 웹 UI에서 변경된 파일을 Mac 수신기(`Receiver`)로 즉시 동기화합니다.
2. **원격 빌드 및 즉시 실행 (Remote Build & Run)**
   - 브라우저 대시보드에서 `Force Rebuild` 클릭 한 번으로 Mac 내부의 `swift build` 툴체인을 구동시키고 자동으로 `.app` 패키지로 패키징합니다.
3. **앱 강제 종료 (Stop App)**
   - `pkill` 명령을 활용하여 브라우저에서 버튼 클릭만으로 Mac에 떠 있는 타겟 앱 프로세스를 깔끔하게 종료(Kill)합니다.
4. **리얼타임 화면 전송 (Screen Casting)**
   - Mac 환경의 화면을 `screencapture` 명령과 Base64 인코딩을 통해 1초에 2.5프레임씩 웹 대시보드로 실시간 중계합니다. (WebRTC 등의 무거운 설정이 필요 없습니다.)
5. **App Bundle 자동 압축 및 다운로드 (Download .zip)**
   - 원격지에서 빌드 완료된 `.app` 번들을 `.zip`으로 압축하여 웹 대시보드 접속 환경(PC)으로 즉시 다운로드 받을 수 있습니다.

---

## 🏗 아키텍처 개요 (Architecture)

본 시스템은 크게 2가지 핵심 컴포넌트로 나뉘어 작동합니다.

### 1. 🌐 Sync Server (Node.js + Vite + Express + WS)
- **역할**: 개발자가 접속하여 컨트롤하는 "Mission Control" 웹 대시보드입니다.
- **실행**:
  ```bash
  // Mac / Linux
  ./start.sh
  
  // Windows
  start.bat
  ```
- **주요 파일**: `server.ts` (명령 중계 등), `src/Dashboard.tsx` (웹 화면)

### 2. 🍎 Native Mac Receiver
- **역할**: 실제 XCode 및 Swift 툴체인이 깔려있는 Mac 환경에서 백그라운드로 도는 수신기입니다.
- **실행**: Mac 터미널에서 다음을 실행합니다.
  ```bash
  node src/receiverScript.js
  ```
  *(주: 내부적으로 `screencapture` 권한이 필요하므로 Mac 시스템 설정에서 해당 터미널의 '화면 기록(Screen Recording)' 권한을 허용해야 합니다.)*

---

## 📚 폴더 구조 가이드

- `native_mac_dev/`: 실제 Mac 환경으로 전송 및 빌드될 원본 Swift 프로젝트 폴더들이 모여있는 작업 공간(Workspace)입니다.
- `src/`: React 기반의 대시보드 UI 프론트엔드 소스코드 (`App.tsx`, `Dashboard.tsx` 등)
- `.gemini/downloads/`: 빌드가 완료되어 수신기로부터 전송받은 압축앱(`.zip`)이 임시 보관되는 장소입니다.

## ⚠️ 커스텀 설정 (app-config.json)
`native_mac_dev/{프로젝트명}/app-config.json` 파일을 생성하여 앱의 메타데이터를 직접 정의할 수 있습니다. (생략 시 기본 템플릿 사용)

```json
{
  "appName": "MyApp",
  "fullTitle": "My Beautiful Native App",
  "bundleId": "com.bkit.myapp"
}
```

---
*Created and maintained under the [bkit Standard Practices]*
