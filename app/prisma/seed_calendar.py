import sqlite3
import json
import uuid
from datetime import datetime, timedelta

DB_PATH = r"prisma\dev.db"

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# 가장 최근 유저 조회
cur.execute("SELECT id, email FROM users ORDER BY createdAt DESC LIMIT 1")
row = cur.fetchone()
if not row:
    print("유저가 없습니다.")
    exit(1)

user_id, email = row
print(f"대상 유저: {email} ({user_id})")

now = datetime.now()
year = now.year
month = now.month

seeds = [
    {
        "title": "[테스트] 봄 신제품 카드뉴스",
        "type": "CAROUSEL",
        "status": "SCHEDULED",
        "scheduledAt": datetime(year, month, 8, 10, 0).isoformat() + "Z",
        "slides": json.dumps([
            {"index": 0, "title": "봄 신제품 출시!", "body": "이번 시즌 가장 핫한 아이템을 만나보세요."},
            {"index": 1, "title": "특별 할인 혜택", "body": "출시 기념 20% 특별 할인 이벤트 진행 중!"},
        ]),
    },
    {
        "title": "[테스트] 브랜드 스토리 블로그 포스팅",
        "type": "BLOG",
        "status": "DRAFT",
        "scheduledAt": datetime(year, month, 12, 14, 0).isoformat() + "Z",
        "slides": json.dumps([
            {"index": 0, "title": "우리 브랜드의 시작", "body": "2020년, 작은 창고에서 시작된 이야기입니다."},
        ]),
    },
    {
        "title": "[테스트] 주간 SNS 대량 기획",
        "type": "BULK",
        "status": "SCHEDULED",
        "scheduledAt": datetime(year, month, 15, 9, 0).isoformat() + "Z",
        "slides": json.dumps([]),
    },
    {
        "title": "[테스트] 4월 이벤트 카드뉴스",
        "type": "CAROUSEL",
        "status": "PUBLISHED",
        "scheduledAt": datetime(year, month, 20, 11, 0).isoformat() + "Z",
        "slides": json.dumps([
            {"index": 0, "title": "4월 이벤트", "body": "봄맞이 특별 이벤트에 참여하세요!"},
        ]),
    },
    {
        "title": "[테스트] URL 기반 콘텐츠 변환",
        "type": "URL_TO_POST",
        "status": "DRAFT",
        "scheduledAt": datetime(year, month, 22, 16, 0).isoformat() + "Z",
        "slides": json.dumps([]),
    },
]

count = 0
for seed in seeds:
    cid = str(uuid.uuid4()).replace("-", "")[:25]
    ts = datetime.utcnow().isoformat() + "Z"
    cur.execute("""
        INSERT INTO contents (id, userId, title, type, status, scheduledAt, slides, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (cid, user_id, seed["title"], seed["type"], seed["status"],
          seed["scheduledAt"], seed["slides"], ts, ts))
    print(f'  ✓ "{seed["title"]}" ({seed["scheduledAt"][:10]})')
    count += 1

conn.commit()
conn.close()
print(f"\n✅ 더미 콘텐츠 {count}개 삽입 완료!")
