-- 027_backfill_remaining_poems_teaching.sql
-- Backfill teaching_objectives, inquiry_tasks, curriculum_unit, difficulty_level, period_estimate_minutes
-- for the 22 poems not covered by migration 023
-- Safe to re-run; only updates poems that have NULL or empty teaching_objectives

-- Reuse the backfill function from migration 023 if it exists; create if not
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'backfill_poem_teaching_content') then
    create or replace function backfill_poem_teaching_content(
      p_title text,
      p_author text,
      p_curriculum_unit text,
      p_teaching_objectives jsonb,
      p_inquiry_tasks jsonb,
      p_difficulty_level text,
      p_period_estimate_minutes int
    ) returns void as $fn$
    declare
      v_poem_id uuid;
    begin
      select id into v_poem_id from poems where title = p_title and author = p_author limit 1;
      if v_poem_id is null then return; end if;
      update poems set
        curriculum_unit = coalesce(nullif(curriculum_unit, ''), p_curriculum_unit),
        teaching_objectives = case
          when teaching_objectives is null or teaching_objectives = '[]'::jsonb then p_teaching_objectives
          else teaching_objectives
        end,
        inquiry_tasks = case
          when inquiry_tasks is null or inquiry_tasks = '[]'::jsonb then p_inquiry_tasks
          else inquiry_tasks
        end,
        difficulty_level = coalesce(nullif(difficulty_level, ''), p_difficulty_level),
        period_estimate_minutes = coalesce(nullif(period_estimate_minutes, 0), p_period_estimate_minutes),
        updated_at = now()
      where id = v_poem_id;
    end;
    $fn$ language plpgsql;
  end if;
end;
$$;

-- Spring / Nature poems (春景 / 自然)
select backfill_poem_teaching_content('春晓', '孟浩然',
  '小学·春景',
  '[{"title": "感受春晨画面", "summary": "通过听觉与视觉的转换，体会诗人对春天的喜爱之情。", "goals": ["能背诵并默写全诗", "理解“眠”“晓”“闻”“落”等关键词", "说出诗中由听觉到视觉的转换顺序", "体会诗人惜春之情"], "teacherHint": "先让学生闭眼听读，再说出听到了什么、看到了什么，从感官体验入手。"}]'::jsonb,
  '[{"title": "春晓意象探索", "prompt": "诗人为什么写“春眠不觉晓”而不是直接写早上醒来？", "presetQuestions": ["“处处闻啼鸟”给你怎样的感觉？", "为什么最后写到“花落知多少”？诗人是什么心情？", "如果你来写一首春天的诗，你会从哪个场景开始？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 25
);

select backfill_poem_teaching_content('早发白帝城', '李白',
  '小学·行旅',
  '[{"title": "感受行旅之快", "summary": "通过空间的快速转换，体会诗人遇赦后的畅快心情。", "goals": ["能背诵全诗并理解诗意", "理解“朝辞”“千里”“一日还”中的时空对比", "分析夸张手法的表达效果", "体会诗人遇赦后的喜悦心情"], "teacherHint": "画出诗中地点的转换路线，让学生直观感受空间跨度。"}]'::jsonb,
  '[{"title": "早发白帝城探究", "prompt": "“千里江陵一日还”是真实还是夸张？为什么这样写？", "presetQuestions": ["诗句中有哪些地点变化？画出来感受一下距离。", "“两岸猿声啼不住”起到什么作用？", "李白当时为什么这么高兴？结合生平说一说。"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 30
);

select backfill_poem_teaching_content('望天门山', '李白',
  '小学·山水',
  '[{"title": "欣赏山水之壮", "summary": "通过山水景象的描绘，感受天门山的雄伟壮观。", "goals": ["理解诗中描绘的天门山景象", "分析“中断”“东流”“相对出”的动态描写", "体会诗人对自然景观的赞叹", "能用自己的话描述诗中画面"], "teacherHint": "引导学生比较天门山和其他写山的诗有什么不同，注意动态描写。"}]'::jsonb,
  '[{"title": "望天门山探究", "prompt": "“天门中断楚江开”中的“中断”让你想到了什么画面？", "presetQuestions": ["为什么叫“天门山”？山像门一样说明了什么？", "“碧水东流至此回”——水为什么会“回”？", "李白的山水诗有什么共同特点？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 25
);

select backfill_poem_teaching_content('鹿柴', '王维',
  '小学·山水',
  '[{"title": "感受空山意境", "summary": "通过空山深林的描绘，体会王维诗中有画的独特意境。", "goals": ["理解“空山不见人”的意境", "分析“但闻人语响”的以声衬静手法", "体会“返景入深林”的光影变化", "初步了解王维诗中有画的艺术特点"], "teacherHint": "这首诗是训练学生感受意境的好材料，从声音和光影两个角度切入。"}]'::jsonb,
  '[{"title": "鹿柴探究任务", "prompt": "空山里真的什么都没有吗？诗人看到了什么、听到了什么？", "presetQuestions": ["“空山不见人”给你怎样的第一印象？", "为什么写“但闻人语响”？有人在说话为什么不写人？", "“返景入深林”——光怎么回到青苔上？描述这个画面。"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 25
);

select backfill_poem_teaching_content('竹里馆', '王维',
  '小学·山水',
  '[{"title": "体会独处之美", "summary": "通过幽篁独坐的场景，感受诗人超然物外的闲适心境。", "goals": ["理解诗中幽静的环境描写", "体会“独坐”“弹琴”“长啸”的闲适情趣", "分析“深林人不知”与“明月来相照”的对比", "感受王维诗歌中人与自然和谐共处的主题"], "teacherHint": "可与《鹿柴》对比阅读，两首诗都写空寂之境，但情感基调不同。"}]'::jsonb,
  '[{"title": "竹里馆探究任务", "prompt": "一个人坐在竹林里弹琴，为什么不觉得孤独？", "presetQuestions": ["“独坐幽篁里”——诗人为什么选择在竹林里弹琴？", "“明月来相照”——月亮在这里扮演什么角色？", "这首诗和《鹿柴》有什么异同？一起读一读。"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 25
);

select backfill_poem_teaching_content('绝句（两个黄鹂鸣翠柳）', '杜甫',
  '小学·春景',
  '[{"title": "感受多彩春景", "summary": "通过色彩与动静的对比，欣赏杜甫笔下生机盎然的春日画卷。", "goals": ["能背诵全诗", "找出诗中的色彩词和数字词", "分析动静结合的表现手法", "体会诗人对春日美景的欣赏"], "teacherHint": "让学生用彩笔画出诗中出现的颜色，直观感受杜甫的色彩运用。"}]'::jsonb,
  '[{"title": "绝句探究任务", "prompt": "这首诗短短四句出现了几种颜色？诗人在画画吗？", "presetQuestions": ["诗中包含了哪些颜色？有哪些数字？", "“两个黄鹂鸣翠柳”和“一行白鹭上青天”有什么视角变化？", "最后两句写到雪和船，为什么从近处突然跳到远处？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 30
);

select backfill_poem_teaching_content('送元二使安西', '王维',
  '小学·送别',
  '[{"title": "体会送别深情", "summary": "通过朝雨青柳的意象，体会友人远行时的惜别之情。", "goals": ["理解诗中送别的时间地点和氛围", "分析“朝雨”“客舍”“柳色”的暗示作用", "体会“劝君更尽一杯酒”的深情厚谊", "了解唐代边塞送别的文化背景"], "teacherHint": "让学生思考：为什么离别时要喝酒？为什么提到阳关？补充安西的地理知识。"}]'::jsonb,
  '[{"title": "送元二使安西探究", "prompt": "为什么要“劝君更尽一杯酒”？这杯酒里装的是什么？", "presetQuestions": ["“渭城朝雨浥轻尘”描绘了怎样的清晨景象？", "“西出阳关无故人”——阳关在哪里？意味着什么？", "如果是你在送别朋友，你会说什么？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 30
);

select backfill_poem_teaching_content('闻官军收河南河北', '杜甫',
  '小学·爱国',
  '[{"title": "感受家国狂喜", "summary": "通过一系列快速动作的描写，体会诗人听闻收复失地后的狂喜之情。", "goals": ["理解诗人喜悦的原因和历史背景", "分析诗中连续动作描写的表达效果", "体会杜甫忧国忧民的家国情怀", "了解“安史之乱”对唐代社会的影响"], "teacherHint": "先补充安史之乱的历史背景，让学生理解这为什么是杜甫生平第一快诗。"}]'::jsonb,
  '[{"title": "闻官军收河南河北探究", "prompt": "杜甫为什么听到一个消息就高兴成这样？结合历史背景讨论。", "presetQuestions": ["诗中连续出现了哪些动作？这些动作说明了什么？", "“却看妻子愁何在”——诗人在看什么？", "“即从巴峡穿巫峡，便下襄阳向洛阳”为什么写得这么快？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 40
);

select backfill_poem_teaching_content('绝句（迟日江山丽）', '杜甫',
  '小学·春景',
  '[{"title": "欣赏春日和谐", "summary": "通过春日景物的描绘，感受大自然的温暖和谐之美。", "goals": ["理解“迟日”的含义", "分析春风、花草、泥融、沙暖等意象", "体会诗人对春日和谐的赞美", "学习多感官描写（视觉、嗅觉、触觉）"], "teacherHint": "引导学生从不同感官角度（看、闻、触）去感受诗中画面。"}]'::jsonb,
  '[{"title": "迟日江山丽探究", "prompt": "“迟日江山丽”——春天的太阳为什么是“迟”的？", "presetQuestions": ["诗中写到了哪几种感官体验？分别是什么？", "“泥融飞燕子”和“沙暖睡鸳鸯”有什么动静对比？", "这首诗表达的情感与《春望》有什么不同？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 25
);

select backfill_poem_teaching_content('赤壁', '杜牧',
  '初中·咏史',
  '[{"title": "理解咏史怀古", "summary": "通过赤壁之战的咏叹，学习咏史诗的写法与怀古之情。", "goals": ["理解诗中赤壁之战的历史典故", "分析“折戟沉沙”以小见大的手法", "体会“东风不与周郎便”的假设与感慨", "初步了解咏史怀古诗的特点"], "teacherHint": "补充赤壁之战的基本史实，重点讨论“以小见大”的写法——从一根断戟写起。"}]'::jsonb,
  '[{"title": "赤壁探究任务", "prompt": "杜牧为什么在意一根断戟？从这件小事能看出什么大道理？", "presetQuestions": ["“折戟沉沙铁未销”——仅仅是一根断戟吗？", "“东风不与周郎便”在表达什么？如果没有东风呢？", "咏史诗和我们之前学的写景诗有什么不同？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 35
);

select backfill_poem_teaching_content('清明', '杜牧',
  '小学·节令',
  '[{"title": "感受清明意境", "summary": "通过清明时节的景象描绘，体会节日氛围与行人情感。", "goals": ["理解清明节的时令特点", "分析“纷纷”一词的双重含义", "体会诗中由愁到暖的情感变化", "背诵全诗"], "teacherHint": "让学生先分享清明节的经历，再读诗对比，注意“纷纷”既写雨也写心情。"}]'::jsonb,
  '[{"title": "清明探究任务", "prompt": "“清明时节雨纷纷”——为什么清明节总是和雨联系在一起？", "presetQuestions": ["“路上行人欲断魂”——清明节人们为什么会悲伤？", "“借问酒家何处有”——为什么要问酒家？想喝酒是为了什么？", "最后一句“牧童遥指杏花村”，画面从悲伤转向了什么？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 25
);

select backfill_poem_teaching_content('江雪', '柳宗元',
  '小学·山水',
  '[{"title": "体会孤高意境", "summary": "通过极简的雪景描写，体会诗人独立不屈的人格精神。", "goals": ["理解诗中极简的景物描写手法", "分析“千山”“万径”与“孤舟”“独钓”的对比", "体会诗人孤独但不屈服的精神", "了解柳宗元被贬的背景"], "teacherHint": "先让学生闭眼想象画面：天地一片白色，只有一个老人在钓鱼。讨论这是怎样的心情。"}]'::jsonb,
  '[{"title": "江雪探究任务", "prompt": "天寒地冻一个人钓鱼，这个老人为什么不回家？", "presetQuestions": ["“千山鸟飞绝，万径人踪灭”——这是一个怎样的世界？", "“孤舟蓑笠翁，独钓寒江雪”——他为什么在雪中钓鱼？", "这首诗和柳宗元的生平有什么关系？钓的是鱼还是什么？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 30
);

select backfill_poem_teaching_content('游子吟', '孟郊',
  '小学·亲情',
  '[{"title": "体会母爱深情", "summary": "通过母亲缝衣的细节描写，体会深沉而无私的母爱。", "goals": ["理解诗中母爱表达的典型意象", "分析“密密缝”细节描写的表达效果", "体会“谁言寸草心，报得三春晖”的比喻", "能联系自身感受谈体会"], "teacherHint": "这首诗最适合让学生联系自身经历，先分享妈妈为自己做过的事，再读诗领悟。"}]'::jsonb,
  '[{"title": "游子吟探究任务", "prompt": "妈妈缝衣服时为什么“意恐迟迟归”？她在担心什么？", "presetQuestions": ["“临行密密缝”——母亲为什么要缝得这么密？", "“谁言寸草心，报得三春晖”用了什么比喻？", "你觉得什么是母爱？用一句话表达你的理解。"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 30
);

select backfill_poem_teaching_content('凉州词', '王翰',
  '小学·边塞',
  '[{"title": "感受边塞豪情", "summary": "通过边塞宴饮的描写，体会战士视死如归的英雄气概。", "goals": ["理解“葡萄美酒夜光杯”的意象", "分析“欲饮琵琶马上催”的紧迫感", "体会“古来征战几人回”的悲壮", "比较两首《凉州词》的异同"], "teacherHint": "与王之涣《凉州词》对比阅读，一首写景一首写事，但都表达边塞主题。"}]'::jsonb,
  '[{"title": "凉州词探究任务", "prompt": "“古来征战几人回”——这是豪迈还是悲伤？说说你的理解。", "presetQuestions": ["“葡萄美酒夜光杯”——边疆怎么会有这些？说明什么？", "“欲饮琵琶马上催”——正要喝酒时发生了什么？", "这首《凉州词》和王之涣的有什么不同？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 30
);

select backfill_poem_teaching_content('钱塘湖春行', '白居易',
  '初中·春景',
  '[{"title": "感受早春生机", "summary": "通过湖东春景的描绘，感受早春万物复苏的勃勃生机。", "goals": ["理解诗中空间视角的转换", "分析“几处”“谁家”等不确定词的表达效果", "体会“最爱湖东行不足”的流连之情", "学习移步换景的写景手法"], "teacherHint": "画出诗中路线图，让学生跟随诗人的脚步感受移步换景的写法。"}]'::jsonb,
  '[{"title": "钱塘湖春行探究", "prompt": "“几处早莺争暖树”——为什么是“几处”而不是“处处”？", "presetQuestions": ["诗人骑马走了哪些地方？画出路线图。", "“乱花渐欲迷人眼”——花怎么“迷人眼”？描写了什么感觉？", "为什么说“最爱湖东行不足”？什么东西让他看不够？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 40
);

select backfill_poem_teaching_content('赋得古原草送别', '白居易',
  '小学·送别',
  '[{"title": "体会生命力量", "summary": "通过草的旺盛生命力与送别场景的结合，体会自然之力和离别之情。", "goals": ["理解“离离”的含义", "分析草的生长特征与生命力", "体会送别场景中的情感表达", "背诵名句“野火烧不尽，春风吹又生”"], "teacherHint": "前四句写草的生命力（自然），后四句写送别（人情），引导学生体会这种结构安排。"}]'::jsonb,
  '[{"title": "赋得古原草送别探究", "prompt": "“野火烧不尽，春风吹又生”——草为什么这么顽强？", "presetQuestions": ["前四句和后四句有什么关系？为什么写草又写送别？", "“远芳侵古道”——芳草怎么“侵”古道？这个词好在哪里？", "用草来比喻生命力给你什么启发？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 30
);

select backfill_poem_teaching_content('忆江南', '白居易',
  '初中·山水',
  '[{"title": "领略江南之美", "summary": "通过对比与概括，体会词人对江南的深深眷恋。", "goals": ["理解“风景旧曾谙”的含义", "分析“日出江花红胜火，春来江水绿如蓝”的对仗和色彩", "体会词人对江南的深厚感情", "了解词和诗的形式区别"], "teacherHint": "展示真实的江南风景图片，让学生将文字与画面对照，感受色彩之美。"}]'::jsonb,
  '[{"title": "忆江南探究任务", "prompt": "白居易为什么说“能不忆江南”？江南有什么让他念念不忘？", "presetQuestions": ["“日出江花红胜火”——江花真的比火还红吗？这是什么手法？", "这首词只有三句，和诗的形式有什么不同？", "如果你要写一首《忆___》，你会写哪里？为什么？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 35
);

select backfill_poem_teaching_content('渔家傲·秋思', '范仲淹',
  '初中·边塞',
  '[{"title": "体会边塞秋思", "summary": "通过边塞秋景的描写，感受将士们思乡与报国的矛盾情感。", "goals": ["理解词中边塞秋景的意象选择", "分析“浊酒一杯家万里”的矛盾情感", "体会“燕然未勒归无计”的家国两难", "了解词的上下片结构"], "teacherHint": "重点引导学生体会“家万里”与“归无计”之间的矛盾，这是理解全词的关键。"}]'::jsonb,
  '[{"title": "渔家傲探究任务", "prompt": "将士们为什么想回家又不回家？这种矛盾情感你理解吗？", "presetQuestions": ["上片写了哪些边塞景象？给你怎样的感觉？", "“燕然未勒归无计”是什么意思？燕然在哪里？", "这种“想回家又不能回”的心情，你在生活中遇到过类似的吗？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 40
);

select backfill_poem_teaching_content('江城子·密州出猎', '苏轼',
  '初中·豪放',
  '[{"title": "感受豪放气概", "summary": "通过出猎场景的描写，体会苏轼豪迈奔放的人生态度。", "goals": ["理解词中出猎场景的描写", "分析“老夫聊发少年狂”的豪迈气概", "体会“会挽雕弓如满月”的英雄形象", "了解苏轼的密州生活和写作背景"], "teacherHint": "这是苏轼豪放词的代表作，可与《念奴娇·赤壁怀古》对比，感受苏轼不同风格。"}]'::jsonb,
  '[{"title": "江城子探究任务", "prompt": "“老夫聊发少年狂”——词人在什么情况下写出这样豪迈的句子？", "presetQuestions": ["出猎的场面是怎样的？用现代话说说看到了什么画面。", "“持节云中，何日遣冯唐？”用了一个什么典故？", "这首词和《水调歌头》的风格有什么不同？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 40
);

select backfill_poem_teaching_content('饮湖上初晴后雨', '苏轼',
  '小学·山水',
  '[{"title": "欣赏西湖之美", "summary": "通过西湖晴雨变化的描写，体会自然之美的多样性。", "goals": ["理解诗中西湖晴雨的景象对比", "分析“淡妆浓抹总相宜”的比喻手法", "体会诗人对西湖的赞美之情", "背诵全诗"], "teacherHint": "展示西湖在晴天和雨天的真实照片，让学生直观感受“淡妆浓抹”的对比。"}]'::jsonb,
  '[{"title": "饮湖上初晴后雨探究", "prompt": "西湖晴天美还是雨天美？为什么“淡妆浓抹总相宜”？", "presetQuestions": ["“水光潋滟晴方好”——潋滟是什么样子？", "“山色空蒙雨亦奇”——空蒙又是什么感觉？", "把西湖比作西子，这个比喻妙在哪里？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'easy', 30
);

select backfill_poem_teaching_content('如梦令·常记溪亭日暮', '李清照',
  '初中·婉约',
  '[{"title": "体会闲适情趣", "summary": "通过少女时期的游玩回忆，感受李清照早期词的清新婉约。", "goals": ["理解词中游玩场景的描写", "分析“争渡争渡”反复修辞的效果", "体会词人少女时期的闲适快乐", "初步了解李清照词风的前后变化"], "teacherHint": "可结合《声声慢》对比阅读，让学生感受李清照前后期词风的巨大变化。"}]'::jsonb,
  '[{"title": "如梦令探究任务", "prompt": "“误入藕花深处”——这是一次意外还是一次美妙的发现？", "presetQuestions": ["词人描绘了怎样的一次郊游？用现代话说说。", "“争渡，争渡，惊起一滩鸥鹭”——这里是怎样的画面？", "这首词的情感和李清照后期的《声声慢》有什么不同？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 30
);

select backfill_poem_teaching_content('声声慢·寻寻觅觅', '李清照',
  '高中·婉约',
  '[{"title": "体会深层哀愁", "summary": "通过叠字的运用和秋景的描写，体会词人国破家亡后的深沉哀愁。", "goals": ["分析开篇七组叠字的表达效果", "理解词中借景抒情的手法", "体会词人国破家亡后的悲凉心境", "了解李清照的生平经历与词风变化"], "teacherHint": "重点分析七组叠字：寻寻觅觅→冷冷清清→凄凄惨惨戚戚，每一层情绪递进都要讲清。"}]'::jsonb,
  '[{"title": "声声慢探究任务", "prompt": "为什么开篇用了七组叠字？这些叠字读起来有什么感觉？", "presetQuestions": ["“寻寻觅觅，冷冷清清”连用叠字，表达了怎样的心境？", "词中描写了哪些秋景？它们和词人的心情有什么关系？", "为什么这首词被称为千古绝唱？它最打动你的是什么？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'hard', 50
);

select backfill_poem_teaching_content('天净沙·秋思', '马致远',
  '初中·秋思',
  '[{"title": "感受秋思意境", "summary": "通过意象并列的手法，体会羁旅之人的深秋思乡之情。", "goals": ["找出词中的九种意象", "分析意象并列手法的表达效果", "体会“断肠人在天涯”的点睛作用", "了解元曲的基本知识"], "teacherHint": "把九个意象做成卡片让学生排序，讨论为什么这个顺序最有效果，"断肠人在天涯"为什么放在最后。"}]'::jsonb,
  '[{"title": "天净沙·秋思探究", "prompt": "短短28个字中包含了多少种意象？它们之间是什么关系？", "presetQuestions": ["找出曲中的九种意象，它们分别属于什么类别？", "为什么前九句都是名词排列没有动词？这种写法特点是什么？", "“断肠人在天涯”——去掉这一句会有什么不同？"], "completionCta": "完成探究，进入练习"}]'::jsonb,
  'medium', 35
);

-- Note: '绝句（迟日江山丽）' by 杜甫 may conflict with the existing '绝句' entry.
-- Use exact title match to distinguish.
