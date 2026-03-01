# PDCA - `native_mac_dev` 경로 이동
**Date:** 2026-02-28
**Author:** bkit Assistant

## Plan (계획)
- **목표:** `src/native_mac_dev` 폴더를 프로젝트 루트(`/Users/twinxx/SynologyDrive/Anti_Dev/Remote-to-Native_Mac_Dev/`)로 이동하여 경로 구조를 간결화합니다.
- **사유:** Remote-to-Native-Mac 개발 환경에서 해당 모듈이 독립된 패키지로 혹은 루트에서 직접 관리되는 것이 구조상 적합하다는 판단에 따른 정리입니다.

## Do (실행)
- 터미널(command) 도구를 활용하여 이동 수행:
  ```bash
  cd /Users/twinxx/SynologyDrive/Anti_Dev/Remote-to-Native_Mac_Dev
  mv src/native_mac_dev .
  ```
- 이동 후 관련 문서(본 문서) 작성 완료.

## Check (점검)
- 실행 결과: 타겟 폴더가 프로젝트 루트로 정상 이동됨 확인.
- 의존성 경로: 현재 프로젝트 내에 `src/native_mac_dev`를 강력히 참조하는 곳은 일차적으로 없는 것으로 파악됩니다(필요 시 후속 처리 요망).
  
## Act (개선/조치)
- 향후 스크립트나 코드에서 `native_mac_dev` 안의 리소스를 불러올 때, 루트 경로 기준으로 참조하도록 가이드를 유지합니다.
- 파일 구조 레이아웃의 무결성을 지속적으로 확보합니다.
