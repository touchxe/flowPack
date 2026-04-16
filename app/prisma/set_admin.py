"""
prisma/set_admin.py
사용법: python prisma/set_admin.py your@email.com
"""
import sqlite3
import sys
import os

db_path = os.path.join(os.path.dirname(__file__), "dev.db")

if len(sys.argv) < 2:
    print("사용법: python prisma/set_admin.py <이메일>")
    sys.exit(1)

email = sys.argv[1]

conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT id, email, role FROM users WHERE email = ?", (email,))
user = cur.fetchone()

if not user:
    print(f"❌ 유저를 찾을 수 없습니다: {email}")
    conn.close()
    sys.exit(1)

print(f"✅ 유저 발견: {user[1]} (현재 role: {user[2]})")

cur.execute("UPDATE users SET role = 'ADMIN' WHERE email = ?", (email,))
conn.commit()
conn.close()

print(f"🎉 {email} → ADMIN 승격 완료!")
print("⚠️  변경 사항을 반영하려면 재로그인 하세요.")
