INSERT INTO categories (name, code, sort_order)
VALUES
    ('校园生活', 'campus-life', 10),
    ('学习交流', 'study', 20),
    ('失物招领', 'lost-found', 30),
    ('求助问答', 'help', 40),
    ('经验分享', 'experience', 50),
    ('其他', 'other', 60)
ON CONFLICT (code) DO NOTHING;
