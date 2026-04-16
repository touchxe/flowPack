import sqlite3
import hashlib
import os

# bcrypt 없이 SHA-256으로 임시 비밀번호 해시 확인
conn = sqlite3.connect("prisma/dev.db")
cur = conn.cursor()
cur.execute("SELECT id, email, role, passwordHash FROM users")
rows = cur.fetchall()
for r in rows:
    print(f"id={r[0][:8]}... email={r[1]} role={r[2]} hash={str(r[3])[:30]}...")
conn.close()
