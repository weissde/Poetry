export interface TeachingStageFallback {
  stageId: string;
  stageTitle: string;
  studentObjectives: string[];
  studentTip: string;
  teacherHints: string[];
  guidedQuestions: string[];
  suggestedMinutes: number;
}

const STAGE_FALLBACKS: TeachingStageFallback[] = [
  {
    stageId: "stage1",
    stageTitle: "初见",
    studentObjectives: [
      "读通全诗，先说出眼前画面与身体感受",
      "圈出 1-2 个关键意象，暂不判断主旨",
      "完成朗读后再进入分层解析",
    ],
    studentTip: "先读原文，关注最先击中你的那一句。不需要一次懂完全诗，先抓住画面感。",
    teacherHints: [
      "先让学生看到画面——先读原文、抓意象，再追问'哪一句最先让你感到情绪变化'",
      "不要一上来就讲标准答案，让学生用自己的语言描述诗中场景",
      "关注朗读节奏，断句是否正确反映语意",
    ],
    guidedQuestions: [
      "这首诗让你看到了怎样的画面？",
      "哪一句最先让你感受到情绪的变化？",
      "你觉得诗人当时身处怎样的环境中？",
    ],
    suggestedMinutes: 12,
  },
  {
    stageId: "stage2",
    stageTitle: "解析",
    studentObjectives: [
      "按译解 → 意象 → 情感 → 手法逐层对照原文",
      "每条结论尽量引用诗句中的词作证据",
      "记下一条可在练测中复用的答题句式",
    ],
    studentTip: "每看一个层次就回到原文找对应词句，不要让解析脱离文本。",
    teacherHints: [
      "解析阶段要分层推进——建议按「译解 → 意象 → 情感 → 手法」的顺序推进",
      "课堂上每次只讲一个层次，避免信息一次堆满",
      "引导学生引用原词原句，而非空谈感受",
    ],
    guidedQuestions: [
      "这首诗的关键意象是什么？它们在诗中如何变化？",
      "诗人用了哪些手法来传达情感？",
      "你能否用一句话概括这首诗的核心主旨？",
    ],
    suggestedMinutes: 15,
  },
  {
    stageId: "stage3",
    stageTitle: "探究",
    studentObjectives: [
      "先用预设问题开口，再让 AI 追问而非代答",
      "把讨论结论用自己的话写进札记或摘要",
      "为下一阶段记忆练习预留 2 个重点句",
    ],
    studentTip: "不要等 AI 给标准答案——先说出你的理解，再让 AI 帮你深化。",
    teacherHints: [
      "探究不是换一种讲解——优先用预设问题让学生先说",
      "用 AI 追问把结论留给学生自己总结出来，而非直接告知",
      "关注学生回答中的关键词，引导他们发现自己的盲区",
    ],
    guidedQuestions: [
      "如果你是诗人，在写下这首诗时你的心境如何？",
      "诗中的某个意象如果换掉，整首诗的情感会变化吗？",
      "你同意课本上对这首诗的解读吗？有没有不同看法？",
    ],
    suggestedMinutes: 15,
  },
  {
    stageId: "stage4",
    stageTitle: "记忆",
    studentObjectives: [
      "优先练「易错字 + 句序」的短句填空",
      "正确率稳定后再尝试半句或全篇默写",
      "把仍卡壳的句子标进错题/复习队列",
    ],
    studentTip: "从短句开始，别一上来就默全篇。卡壳的句子标记下来，下次重点复习。",
    teacherHints: [
      "记忆环节先巩固关键句——先做 2-3 个短句填空确认掌握",
      "再决定是否进入全文默写，课堂上不建议一次拉太长",
      "关注全班错字分布，集中讲解共性错误",
    ],
    guidedQuestions: [
      "这首诗中哪些字最容易写错？",
      "你能否根据上句自然衔接出下句？",
      "哪几句你在记忆时反复卡壳？为什么会卡？",
    ],
    suggestedMinutes: 10,
  },
  {
    stageId: "stage5",
    stageTitle: "考点",
    studentObjectives: [
      "对照考点清单自查是否覆盖高频角度",
      "用一轮同诗练测检验迁移效果",
      "错题与图谱入口二选一补齐薄弱链",
    ],
    studentTip: "考点阶段不是终点——把不会的标记好，从练测和图谱入口补上闭环。",
    teacherHints: [
      "考点要立刻落到下一步动作——讲清高频考点后，直接引导学生去做同诗练习",
      "进入图谱关联发现，形成闭环",
      "评估全班对本诗的掌握层级，决定是否需要回讲",
    ],
    guidedQuestions: [
      "你觉得这首诗最可能在考试中以什么形式出现？",
      "今天的精讲内容你掌握得怎么样？哪些还需要复习？",
      "下一步你打算从练测还是图谱继续巩固？",
    ],
    suggestedMinutes: 8,
  },
];

export function getTeachingFallback(stageId: string): TeachingStageFallback {
  return (
    STAGE_FALLBACKS.find((s) => s.stageId === stageId) ?? {
      stageId,
      stageTitle: stageId,
      studentObjectives: ["跟随当前阶段的学习目标"],
      studentTip: "按照课堂节奏推进即可。",
      teacherHints: ["引导学生理解当前阶段的核心内容"],
      guidedQuestions: ["你从中学到了什么？"],
      suggestedMinutes: 10,
    }
  );
}

export function getAllStageFallbacks(): TeachingStageFallback[] {
  return STAGE_FALLBACKS;
}
