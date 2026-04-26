-- 022_expand_teaching_units.sql
-- Second batch teaching unit seeds - expand from 8 to 20 units
-- Safe to re-run; duplicate units are skipped by title + curriculum_ref

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '咏物诗精选',
  '借物抒怀与人格投射',
  'theme',
  array['primary', 'middle', 'high'],
  array_remove(
    array[
      (select id from poems where title = '咏鹅' and author = '骆宾王' limit 1),
      (select id from poems where title = '咏柳' and author = '贺知章' limit 1),
      (select id from poems where title = '墨梅' and author = '王冕' limit 1),
      (select id from poems where title = '石灰吟' and author = '于谦' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  82,
  9,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '咏物诗精选' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '宋词·离别与相思',
  '词中婉约情韵',
  'theme',
  array['middle', 'high'],
  array_remove(
    array[
      (select id from poems where title = '雨霖铃·寒蝉凄切' and author = '柳永' limit 1),
      (select id from poems where title = '鹊桥仙·纤云弄巧' and author = '秦观' limit 1),
      (select id from poems where title = '蝶恋花·庭院深深深几许' and author = '欧阳修' limit 1),
      (select id from poems where title = '青玉案·元夕' and author = '辛弃疾' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  84,
  10,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '宋词·离别与相思' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '元曲选读',
  '俗中见雅与市井风情',
  'theme',
  array['middle', 'high'],
  array_remove(
    array[
      (select id from poems where title = '天净沙·秋思' and author = '马致远' limit 1),
      (select id from poems where title = '山坡羊·潼关怀古' and author = '张养浩' limit 1),
      (select id from poems where title = '卖花声·怀古' and author = '张可久' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  80,
  11,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '元曲选读' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '小学必背古诗',
  '蒙学阶段的诗意启蒙',
  'grade',
  array['primary'],
  array_remove(
    array[
      (select id from poems where title = '静夜思' and author = '李白' limit 1),
      (select id from poems where title = '咏鹅' and author = '骆宾王' limit 1),
      (select id from poems where title = '悯农（其二）' and author = '李绅' limit 1),
      (select id from poems where title = '江雪' and author = '柳宗元' limit 1),
      (select id from poems where title = '登鹳雀楼' and author = '王之涣' limit 1),
      (select id from poems where title = '望庐山瀑布' and author = '李白' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  85,
  12,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '小学必背古诗' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '初中古诗词',
  '教材核心篇目精读',
  'grade',
  array['middle'],
  array_remove(
    array[
      (select id from poems where title = '观沧海' and author = '曹操' limit 1),
      (select id from poems where title = '次北固山下' and author = '王湾' limit 1),
      (select id from poems where title = '钱塘湖春行' and author = '白居易' limit 1),
      (select id from poems where title = '天净沙·秋思' and author = '马致远' limit 1),
      (select id from poems where title = '闻王昌龄左迁龙标遥有此寄' and author = '李白' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材核心篇目',
  85,
  13,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '初中古诗词' and curriculum_ref = '统编教材核心篇目'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '高中古诗词',
  '高考必考诗词精讲',
  'grade',
  array['high'],
  array_remove(
    array[
      (select id from poems where title = '沁园春·长沙' and author = '毛泽东' limit 1),
      (select id from poems where title = '短歌行' and author = '曹操' limit 1),
      (select id from poems where title = '归园田居（其一）' and author = '陶渊明' limit 1),
      (select id from poems where title = '蜀道难' and author = '李白' limit 1),
      (select id from poems where title = '登高' and author = '杜甫' limit 1),
      (select id from poems where title = '琵琶行' and author = '白居易' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材核心篇目',
  88,
  14,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '高中古诗词' and curriculum_ref = '统编教材核心篇目'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '诗圣杜甫专题',
  '沉郁顿挫的现实主义',
  'author',
  array['middle', 'high'],
  array_remove(
    array[
      (select id from poems where title = '春望' and author = '杜甫' limit 1),
      (select id from poems where title = '闻官军收河南河北' and author = '杜甫' limit 1),
      (select id from poems where title = '登高' and author = '杜甫' limit 1),
      (select id from poems where title = '茅屋为秋风所破歌' and author = '杜甫' limit 1),
      (select id from poems where title = '望岳' and author = '杜甫' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  85,
  15,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '诗圣杜甫专题' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '诗仙李白专题',
  '浪漫主义的飞扬神采',
  'author',
  array['middle', 'high'],
  array_remove(
    array[
      (select id from poems where title = '静夜思' and author = '李白' limit 1),
      (select id from poems where title = '望庐山瀑布' and author = '李白' limit 1),
      (select id from poems where title = '蜀道难' and author = '李白' limit 1),
      (select id from poems where title = '行路难（其一）' and author = '李白' limit 1),
      (select id from poems where title = '黄鹤楼送孟浩然之广陵' and author = '李白' limit 1),
      (select id from poems where title = '赠汪伦' and author = '李白' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  86,
  16,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '诗仙李白专题' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '苏轼专题',
  '旷达词风与人生智慧',
  'author',
  array['high'],
  array_remove(
    array[
      (select id from poems where title = '水调歌头·明月几时有' and author = '苏轼' limit 1),
      (select id from poems where title = '念奴娇·赤壁怀古' and author = '苏轼' limit 1),
      (select id from poems where title = '题西林壁' and author = '苏轼' limit 1),
      (select id from poems where title = '饮湖上初晴后雨' and author = '苏轼' limit 1),
      (select id from poems where title = '江城子·密州出猎' and author = '苏轼' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  87,
  17,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '苏轼专题' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '陶渊明专题',
  '隐逸诗风与田园情怀',
  'author',
  array['middle', 'high'],
  array_remove(
    array[
      (select id from poems where title = '饮酒（其五）' and author = '陶渊明' limit 1),
      (select id from poems where title = '归园田居（其一）' and author = '陶渊明' limit 1),
      (select id from poems where title = '桃花源记' and author = '陶渊明' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  84,
  18,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '陶渊明专题' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '节日节气诗词',
  '时令与诗词的交融',
  'theme',
  array['primary', 'middle', 'high'],
  array_remove(
    array[
      (select id from poems where title = '九月九日忆山东兄弟' and author = '王维' limit 1),
      (select id from poems where title = '清明' and author = '杜牧' limit 1),
      (select id from poems where title = '元日' and author = '王安石' limit 1),
      (select id from poems where title = '春晓' and author = '孟浩然' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  80,
  19,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '节日节气诗词' and curriculum_ref = '统编教材主题拓展'
);

insert into teaching_units (
  title,
  subtitle,
  category,
  grade_level,
  poem_ids,
  curriculum_ref,
  mastery_target,
  display_order,
  is_active,
  created_at,
  updated_at
)
select
  '四季诗词',
  '诗中四季流转',
  'theme',
  array['primary', 'middle'],
  array_remove(
    array[
      (select id from poems where title = '春晓' and author = '孟浩然' limit 1),
      (select id from poems where title = '小池' and author = '杨万里' limit 1),
      (select id from poems where title = '山行' and author = '杜牧' limit 1),
      (select id from poems where title = '江雪' and author = '柳宗元' limit 1)
    ]::uuid[],
    null::uuid
  ),
  '统编教材主题拓展',
  83,
  20,
  true,
  now(),
  now()
where not exists (
  select 1 from teaching_units where title = '四季诗词' and curriculum_ref = '统编教材主题拓展'
);
