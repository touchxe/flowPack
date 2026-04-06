# DB 스키마 — 변경 금지 (가상 CTO 관할)

> ⚠️ 이 파일은 읽기 전용입니다.
> 테이블/컬럼 추가 시 `docs/change-proposals/`에 제안서를 먼저 작성하세요.

---

## DB 엔진
- PostgreSQL 16 (Supabase 호스팅)
- ORM: Drizzle ORM
- 마이그레이션: Drizzle Kit

## 네이밍 규칙
- 테이블명: snake_case, 복수형 (users, posts)
- 컬럼명: snake_case (created_at, user_id)
- 인덱스명: idx_[테이블]_[컬럼] (idx_users_email)
- FK명: fk_[소스테이블]_[대상테이블] (fk_posts_users)

---

## 테이블 정의

### users (사용자)
| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 사용자 고유 ID |
| email | varchar(255) | UNIQUE, NOT NULL | 이메일 |
| name | varchar(100) | NOT NULL | 표시 이름 |
| avatar_url | text | NULLABLE | 프로필 이미지 URL |
| role | varchar(20) | NOT NULL, DEFAULT 'user' | 역할 (user/admin) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 생성일 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 수정일 |

**인덱스:**
- `idx_users_email` ON (email)

### (프로젝트별 테이블 추가)

> PRD 확정 후 기능별 테이블을 여기에 추가합니다.

---

## 관계도 (ERD)

```
users
  └─< (프로젝트별 관계 추가)
```

---

## 변경 이력

| 날짜 | 변경 내용 | 승인자 | 마이그레이션 파일 |
|------|----------|--------|-----------------|
| YYYY-MM-DD | 최초 작성 | YoungBin | 0001_initial.sql |
