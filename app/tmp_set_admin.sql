SELECT email, role, substr(passwordHash, 1, 30) as hash_preview FROM users WHERE email = 'admin@flowpack.dev';
