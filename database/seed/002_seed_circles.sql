INSERT INTO circles (name, description)
SELECT seed.name, seed.description
FROM (VALUES
    ('学习', '交流课程、考试和学习经验'),
    ('表白', '分享想说的话与校园心情'),
    ('二手', '发布和浏览校园二手信息')
) AS seed(name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM circles WHERE circles.name = seed.name
);
