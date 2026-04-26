-- 023_backfill_poems_teaching_content.sql
-- Backfill teaching_objectives, inquiry_tasks, curriculum_unit, difficulty_level, period_estimate_minutes
-- for poems that are referenced in teaching_units
-- Safe to re-run; only updates poems that have NULL or empty teaching_objectives

-- Function to safely update poem teaching content
create or replace function backfill_poem_teaching_content(
  p_title text,
  p_author text,
  p_curriculum_unit text,
  p_teaching_objectives jsonb,
  p_inquiry_tasks jsonb,
  p_difficulty_level text,
  p_period_estimate_minutes int
) returns void as $$
declare
  v_poem_id uuid;
begin
  select id into v_poem_id from poems where title = p_title and author = p_author limit 1;

  if v_poem_id is null then
    return;
  end if;

  update poems set
    curriculum_unit = p_curriculum_unit,
    teaching_objectives = coalesce(teaching_objectives, '[]'::jsonb),
    inquiry_tasks = coalesce(inquiry_tasks, '[]'::jsonb),
    difficulty_level = coalesce(nullif(difficulty_level, ''), p_difficulty_level),
    period_estimate_minutes = coalesce(nullif(period_estimate_minutes, 0), p_period_estimate_minutes),
    updated_at = now()
  where id = v_poem_id
    and (
      teaching_objectives is null
      or teaching_objectives = '[]'::jsonb
      or curriculum_unit is null
      or difficulty_level is null
      or period_estimate_minutes is null
    );
end;
$$ language plpgsql;

-- 静夜思 - 李白
select backfill_poem_teaching_content(
  '静夜思',
  '李白',
  '小学语文·古诗单元',
  '["理解诗中"床""的不同解读","体会诗人借月光表达思乡之情","背诵并默写全诗"]'::jsonb,
  '["李白为什么看着月亮会想起故乡？","诗中的"举头"和"低头"动作反映了什么心理？","如果你是李白，在月夜你会想起谁？"]'::jsonb,
  'easy',
  30
);

-- 九月九日忆山东兄弟 - 王维
select backfill_poem_teaching_content(
  '九月九日忆山东兄弟',
  '王维',
  '小学语文·传统节日主题',
  '["理解重阳节的习俗","体会诗人独在异乡的孤独感","感受兄弟情谊"]'::jsonb,
  '["诗人为什么不直接说"想家"而是说"忆山东兄弟"？",""独在异乡为异客"中的"独"字如何理解？","如果你在异乡读书，重阳节时你会怎么做？"]'::jsonb,
  'medium',
  35
);

-- 赠汪伦 - 李白
select backfill_poem_teaching_content(
  '赠汪伦',
  '李白',
  '小学语文·送别诗单元',
  '["感受诗人与好友之间的真挚友情","理解诗歌情景交融的写法","背诵并默写全诗"]'::jsonb,
  '["李白乘船要走时为什么还要唱歌？","从哪些词句可以看出两人感情深厚？","如果你是汪伦，你会用什么样的方式送别好友？"]'::jsonb,
  'easy',
  30
);

-- 黄鹤楼送孟浩然之广陵 - 李白
select backfill_poem_teaching_content(
  '黄鹤楼送孟浩然之广陵',
  '李白',
  '初中语文·送别诗专题',
  '["理解送别诗情景分离的写法","体会寓情于景、情景交融的艺术手法","背诵全诗并理解诗意"]'::jsonb,
  '["李白为什么不写具体的送别场景而只写景色？",""唯见长江天际流"一句如何理解？","这首诗与《赠汪伦》送别方式有什么不同？"]'::jsonb,
  'medium',
  40
);

-- 使至塞上 - 王维
select backfill_poem_teaching_content(
  '使至塞上',
  '王维',
  '初中语文·边塞诗专题',
  '["了解边塞诗的风格特点","理解"大漠孤烟直，长河落日圆"的意境","体会诗人被排挤出京后的心情"]'::jsonb,
  '["为什么诗人用"单车"形容自己出使？","颈联两句写了哪些意象？营造了怎样的意境？","诗中哪个字最传神？试分析。"]'::jsonb,
  'hard',
  45
);

-- 登鹳雀楼 - 王之涣
select backfill_poem_teaching_content(
  '登鹳雀楼',
  '王之涣',
  '小学语文·古诗单元',
  '["理解诗歌大意","体会"欲穷千里目，更上一层楼"的哲理","背诵并默写全诗"]'::jsonb,
  '["诗中描写了哪些景物？","为什么"欲穷千里目"要"更上一层楼"？","这两句诗告诉我们什么道理？"]'::jsonb,
  'easy',
  25
);

-- 望庐山瀑布 - 李白
select backfill_poem_teaching_content(
  '望庐山瀑布',
  '李白',
  '小学语文·山水诗单元',
  '["理解诗歌大意","感受诗人夸张的想象力","背诵并默写全诗"]'::jsonb,
  '["诗人用了哪些数字和动词描写瀑布？","为什么要把瀑布比作"银河"？","诗中哪个词最能体现瀑布的气势？"]'::jsonb,
  'easy',
  30
);

-- 春望 - 杜甫
select backfill_poem_teaching_content(
  '春望',
  '杜甫',
  '初中语文·家国情怀专题',
  '["理解诗歌反映的安史之乱背景","体会诗人忧国忧民的情怀","学习寓情于景的写作手法"]'::jsonb,
  '[""城春草木深"一句中的"深"字如何理解？","诗中哪两句最能体现诗人的忧国忧民之情？","比较这首诗与《闻官军收河南河北》中杜甫情感的不同。"]'::jsonb,
  'hard',
  50
);

-- 水调歌头·明月几时有 - 苏轼
select backfill_poem_teaching_content(
  '水调歌头·明月几时有',
  '苏轼',
  '高中语文·宋词专题',
  '["理解词中小序的作用","体会词人由孤独到旷达的情感变化","背诵全词并理解名句含义"]'::jsonb,
  '["词前小序有什么作用？","上阙写月，下阙写人，两部分如何关联？",""但愿人长久，千里共婵娟"表达了什么情感？"]'::jsonb,
  'hard',
  60
);

-- 山居秋暝 - 王维
select backfill_poem_teaching_content(
  '山居秋暝',
  '王维',
  '高中语文·山水田园诗专题',
  '["理解诗歌描绘的意境","学习动静结合的写法","体会诗人归隐山林的情趣"]'::jsonb,
  '["诗中哪些意象体现了"空山"的特点？","中间两联如何做到动静结合？","王维为什么要隐居山林？这与他的仕途经历有什么关系？"]'::jsonb,
  'medium',
  45
);

-- 饮酒（其五）- 陶渊明
select backfill_poem_teaching_content(
  '饮酒（其五）',
  '陶渊明',
  '初中语文·田园诗专题',
  '["理解"心远地自偏"的含义","体会诗人归隐田园后的心境","学习借景寓理的手法"]'::jsonb,
  '["诗中"采菊"与"见南山"有什么内在联系？","如何理解"此中有真意，欲辨已忘言"？","陶渊明为什么要放弃官职归隐田园？"]'::jsonb,
  'medium',
  45
);

-- 观沧海 - 曹操
select backfill_poem_teaching_content(
  '观沧海',
  '曹操',
  '初中语文·古体诗专题',
  '["体会诗歌宏伟的意境","感受诗人吞吐日月的气魄","背诵全诗"]'::jsonb,
  '["诗中哪些细节体现了曹操的壮志？","作者观海时产生了怎样的联想？","这首诗与曹操《短歌行》比较，情感有何异同？"]'::jsonb,
  'medium',
  40
);

-- 念奴娇·赤壁怀古 - 苏轼
select backfill_poem_teaching_content(
  '念奴娇·赤壁怀古',
  '苏轼',
  '高中语文·宋词专题',
  '["理解怀古词的特点","体会词人壮志难酬的感慨","学习以诗入词的手法"]'::jsonb,
  '["上阙描写赤壁景色，有什么作用？","周瑜在词中是什么样的形象？","词人为什么要写周瑜？表达了什么情感？"]'::jsonb,
  'hard',
  60
);

-- 题西林壁 - 苏轼
select backfill_poem_teaching_content(
  '题西林壁',
  '苏轼',
  '小学语文·哲理诗单元',
  '["理解诗歌含义","体会"当局者迷，旁观者清"的道理","背诵并默写全诗"]'::jsonb,
  '["为什么"不识庐山真面目"？","诗中哪两句说明了原因？","这首诗告诉我们一个什么道理？"]'::jsonb,
  'easy',
  25
);

-- 凉州词 - 王之涣
select backfill_poem_teaching_content(
  '凉州词',
  '王之涣',
  '初中语文·边塞诗专题',
  '["理解边塞诗的苍凉意境","体会戍边将士的思乡之情","感受葡萄美酒的作用"]'::jsonb,
  '["诗中描写了哪些边塞特有的意象？","为什么将士们"欲饮"时"琵琶"就"马上催"？","如何理解这首诗的结尾？"]'::jsonb,
  'medium',
  40
);

-- 出塞 - 王昌龄
select backfill_poem_teaching_content(
  '出塞',
  '王昌龄',
  '初中语文·边塞诗专题',
  '["理解诗歌大意","体会诗人渴望良将保境安民的情感","背诵全诗"]'::jsonb,
  '[""秦时明月汉时关"一句有什么特点？","诗人为什么怀念李广？","如何理解诗中蕴含的反对战争、热爱和平的情感？"]'::jsonb,
  'medium',
  40
);

-- 枫桥夜泊 - 张继
select backfill_poem_teaching_content(
  '枫桥夜泊',
  '张继',
  '小学语文·古诗单元',
  '["理解诗歌描写的景色","体会诗人孤寂惆怅的心情","背诵并默写全诗"]'::jsonb,
  '["诗中写了哪些景物？",""江枫渔火对愁眠"中"愁"从何来？","如果你在船上听到钟声，会有什么感受？"]'::jsonb,
  'easy',
  30
);

-- 泊秦淮 - 杜牧
select backfill_poem_teaching_content(
  '泊秦淮',
  '杜牧',
  '初中语文·怀古诗专题',
  '["理解诗歌内容","体会诗人忧国忧民的情怀","感受用典的写法"]'::jsonb,
  '[""烟笼寒水月笼沙"营造了怎样的意境？","诗人为什么感叹"商女不知亡国恨"？","这首诗与《夜泊牛渚怀古》在情感上有何异同？"]'::jsonb,
  'medium',
  45
);

-- 次北固山下 - 王湾
select backfill_poem_teaching_content(
  '次北固山下',
  '王湾',
  '初中语文·思乡诗专题',
  '["理解诗歌内容","体会诗人借雁传情的写法","学习描写景物表达情感的手法"]'::jsonb,
  '["诗中哪一句体现了时令特点？","作者是如何借鸿雁传书的？","比较这首诗与《天净沙·秋思》中思乡情感的异同。"]'::jsonb,
  'medium',
  40
);

drop function backfill_poem_teaching_content(text, text, text, jsonb, jsonb, text, int);
