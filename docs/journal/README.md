# 개발 일지 (Dev Journal)

온기코퍼레이션 생산 모니터링 대시보드의 날짜별 개발 진행 보고서입니다.

## 📂 인덱스

| 날짜 | 요일 | 주요 내용 | 파일 |
|---|---|---|---|
| 2026-04-23 | 목 | 프로젝트 킥오프 + Phase 1 (기반) + Phase 2 착수 | [2026-04-23.md](./2026-04-23.md) |
| 2026-04-24 | 금 | Phase 2~4 완료 + 실제 Cloud 배포 + UX 조정 | [2026-04-24.md](./2026-04-24.md) |

## 📊 2일 요약

| 항목 | 수치 |
|---|---|
| **총 개발일** | 2일 |
| **Git commits** | 80+ |
| **Phase 완료** | 4 (phase-1~4-complete) |
| **총 테스트** | 87 (Unit 11 + pgTAP 56 + Integration 15 + E2E 5) |
| **DB 마이그레이션** | 29 |
| **Edge Functions** | 4 (ingest / invite-user / generate-pdf / llm-analyze) |
| **Admin CRUD 페이지** | 6 |
| **뷰어 페이지** | 4 |
| **배포** | Supabase Cloud + Vercel (Production live) |

## 🗂️ 관련 문서

- [DEV_NOTES.md](../DEV_NOTES.md) — 종합 개발 노트 (참조용)
- [DEPLOYMENT.md](../DEPLOYMENT.md) — 배포 가이드
- [OPERATIONS.md](../OPERATIONS.md) — 운영 가이드
- [설계 스펙](../superpowers/specs/2026-04-23-ongi-dashboard-design.md)
- [Phase별 plan](../superpowers/plans/)

## 🏷️ 태그

- `phase-1-complete` → 기반 구축 완료
- `phase-2-complete` → 모니터링 탭 완료
- `phase-3-complete` → 관리 기능 완료
- `phase-4-complete` → 리포트·배포 완료
