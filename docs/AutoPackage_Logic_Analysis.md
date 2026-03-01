# `.auto_package.sh` 생성 로직 분석

`.auto_package.sh` 파일은 `server.ts` 의 `generateBuildScript` 함수 (9~154 라인)에서 동적으로 생성되고 있습니다.

## 1. 생성 코드 원본 (`server.ts`)

```typescript
function generateBuildScript(project: string) {
  // 프로젝트 루트 경로 탐색
  let projectRoot = join(process.cwd(), "native_mac_dev", project);
  if (!existsSync(projectRoot)) {
    projectRoot = join(process.cwd(), project);
  }

  if (!existsSync(projectRoot)) {
    console.error(`❌ Project root not found: ${project}`);
    return;
  }

  // 패키지 스위프트 파일 존재 여부 확인
  const isSwift = existsSync(join(projectRoot, "Package.swift"));
  if (!isSwift) return;

  // 기본 설정 및 app-config.json 읽기
  let config = {
    appName: project,
    fullTitle: project,
    bundleId: `com.native.${project.toLowerCase()}`,
    binName: ""
  };

  const configPath = join(projectRoot, 'app-config.json');
  if (existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      config = { ...config, ...userConfig };
    } catch (e) { }
  }

  // Package.swift 에서 이름 추출 시도
  if (!config.binName) {
    try {
      const packageSwift = readFileSync(join(projectRoot, 'Package.swift'), 'utf8');
      const match = packageSwift.match(/name:\s*"([^"]+)"/);
      if (match) config.binName = match[1];
    } catch (e) { }
  }

  const BIN_NAME = config.binName || config.appName;
  const APP_NAME = config.appName;
  const FULL_TITLE = config.fullTitle;

  // 쉘 스크립트 템플릿 작성
  const shellScript = `#!/usr/bin/env bash
set -e

echo "🚀 Starting Swift Build for ${BIN_NAME} (Release)..."
swift build -c release

echo "📦 Creating App Bundle Structure for ${APP_NAME}.app..."
BUILD_DIR="build"
APP_DIR="$BUILD_DIR/${APP_NAME}.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

rm -rf "$BUILD_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

echo "🔍 Searching for binary: ${BIN_NAME}..."
SPM_BIN_PATH=$(swift build -c release --show-bin-path 2>/dev/null || echo "")
echo "📂 SPM Suggestion: $SPM_BIN_PATH"

BINARY_SOURCE=$(find .build -type f -iname "${BIN_NAME}" 2>/dev/null | grep -i -v "\.dSYM" | grep -v "derived-data" | head -n 1)

if [ -z "$BINARY_SOURCE" ] && [ -n "$SPM_BIN_PATH" ] && [ -d "$SPM_BIN_PATH" ]; then
    BINARY_SOURCE=$(find "$SPM_BIN_PATH" -type f -iname "${BIN_NAME}" 2>/dev/null | head -n 1)
fi

if [ -z "$BINARY_SOURCE" ]; then
    echo "❌ Error: Binary ${BIN_NAME} not found anywhere in .build/"
    exit 1
fi

echo "✅ Found binary at: $BINARY_SOURCE"

echo "📂 Assembling App Bundle..."
cp "$BINARY_SOURCE" "$MACOS_DIR/${APP_NAME}"

# ... 아이콘 생성 및 Info.plist, PkgInfo 처리 로직 생략 ...

echo "🚀 Opening the App..."
# Force open via the full path and ensure it's treated as an app
open -a "$APP_DIR" || open "$APP_DIR" || true

echo "🗜 Compressing App Bundle..."
cd "$BUILD_DIR"
zip -q -r "${APP_NAME}.zip" "${APP_NAME}.app"
ZIP_PATH="$PWD/${APP_NAME}.zip"

echo "✅ Packaging Complete: $APP_DIR"
echo "📦 ZIP_READY: $ZIP_PATH"
\`;

  writeFileSync(join(projectRoot, '.auto_package.sh'), shellScript);
}
```

## 2. 의심되는 로직 문제점 분석 (Check)

형님, 이전 대화에서 언급하셨던 `Unable to find application named build/HelloWorldApp.app` 오류 등 여러 가지 잠재적 문제들을 확인했습니다.

1. **상대 경로를 이용한 `open -a` 명령 실행 오류**: 
   - `open -a "$APP_DIR"` 에서 `$APP_DIR` 은 `build/HelloWorldApp.app` 같은 상대 경로입니다.
   - `-a` 옵션은 주로 시스템에 설치된 '이름(예: Safari)' 혹은 어플리케이션의 '절대 경로'를 인자로 받습니다. 상대 경로로 지정하면 시스템이 앱을 올바르게 찾지 못해 `Unable to find application named...` 에러를 뱉게 됩니다.
   - **해결 방안:** 백그라운드 환경이나 특정 경로의 앱을 강제 실행할 때는 단순히 절대 경로로만 열거나, `-a` 옵션 없이 `open "$APP_DIR"`만 사용하는 것이 안전합니다. (`open "$PWD/$APP_DIR"`)

2. **`Package.swift` 정규식 파싱의 한계**:
   - `name:\s*"([^"]+)"` 로 파싱하는데, Package.swift 내부에서 여러 name이 명시되어 있거나 주석 처리된 부분에 걸리면 엉뚱한 이름이 바이너리 이름으로 지정될 수 있습니다. 

3. **`zip` 명령어 실행 후 디렉토리 이동 이슈**:
   - `cd "$BUILD_DIR"` 로 경로를 변경한 뒤에 스크립트가 종류되지만, 쉘 환경에 따라 이후 작업에 부작용을 일으킬 수도 있습니다.

## 3. 수정 계획안 (Plan)

* `server.ts`의 `shellScript` 문자열 템플릿 수정
* **변경 1:** `open -a "$APP_DIR" || open "$APP_DIR" || true` 구문을 `open "$PWD/$APP_DIR" || true` 등 절대 경로 기준으로 수정하여 에러 방지.
* **변경 2:** `$APP_DIR` 생성 시 처음부터 `$PWD` 를 섞어 절대 경로로 관리. (필요 시)

이 계획대로 코드를 수정해 볼까요, 행님?
