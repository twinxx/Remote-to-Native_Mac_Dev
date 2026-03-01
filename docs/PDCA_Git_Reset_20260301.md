# Git Repository 초기화 및 병합 충돌 제거 (PDCA)

**작성일**: 2026-03-01

## 1. Plan (계획)
- **배경**: 기존 로컬 Git 히스토리가 손상(Corrupted)되고 꼬임으로써 푸시 및 동기화 작업 시 심각한 에러(fatal: Failed to traverse parents of commit 등)가 지속 발생.
- **목표**: 
  1. 기존의 깨진 Git 히스토리를 강제로 제거.
  2. 현재 작업 디렉토리의 파일들을 유일한 원본(Initial State)으로 삼아 다시 Git 저장소를 구성.
  3. 만들어진 깨끗한 커밋으로 Github 원격 저장소에 덮어쓰기(`Force Push`).

## 2. Do (실행)
1. 로컬 `.git` 폴더 강제 삭제 (`rm -rf .git`) -> 히스토리 전면 제거
2. 새로운 로컬 저장소 생성 (`git init`)
3. 기존 리모트 `origin` 다시 추가 (`git remote add origin https://github.com/twinxx/Remote-to-Native_Mac_Dev.git`)
4. 기본 브랜치 이름을 `main`으로 설정 (`git branch -M main`)
5. 현재 모든 소스 파일 및 문서를 Staging (`git add .`)
6. 초기화 메시지를 포함한 단일 메인 커밋 생성 (`git commit -m "chore: Clean up and force init repository with current state"`)
7. 원격 저장소(`origin/main`)에 강제 푸시 (`git push -u origin main -f`) 수행

## 3. Check (확인)
- 강제 푸시 과정에서 터미널 응답 `forced update`가 정상적으로 표시됨 확인 완료.
- 원격 저장소에 기존의 꼬인 히스토리들이 모두 정리되고, 오직 하나의 최신 커밋("chore: Clean up and force init repository...")만 존재하게 됨.
- 현재 폴더에 있는 불필요한 추적 파일들도 제거되었고, 필요한 파일들만 깨끗하게 버전 관리로 들어감.

## 4. Act (개선)
- 향후 유사한 Git 히스토리 꼬임 현상이 발견될 경우, 복구가 불가능할 수준이라면 현재처럼 완전히 초기화하는 방식(Hard Reset)을 신속히 도입하여 파일 시스템 무결성을 보호.
- 작업 완료 후 항상 최신 상태의 코드를 `main` 브랜치에 단일 소스 오브 트루스(Single Source of Truth)로 유지.
