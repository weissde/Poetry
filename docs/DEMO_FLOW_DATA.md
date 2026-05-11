# 演示流程数据操作文档

## 目标

`backend/scripts/seed_demo_flow.py` 会扫描当前 Supabase 数据表，并生成一套可演示的完整流程数据：

- 诗词基础库、练习题、教学字段
- 知识图谱节点和边
- 教师、学生用户画像
- 演示班级、班级成员、课堂会话、教师任务
- 学生学习进度、练习记录、错题、薄弱项、考试记录
- 背诵复习、收藏、笔记、复习计划
- 创作广场作品和点赞

脚本使用固定 UUID，可重复运行，不会因为多次执行产生重复演示数据。

## 前置条件

1. `backend/.env` 已配置：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Supabase Auth 至少已有 1 个用户；建议准备 2 个用户：
   - 一个教师账号
   - 一个学生账号

## 扫描数据表

```powershell
cd D:\Poetry\Poetry-AI\backend
python scripts\seed_demo_flow.py --dry-run
```

如果需要指定账号：

```powershell
python scripts\seed_demo_flow.py --dry-run --teacher-email teacher@example.com --student-email student@example.com
```

## 生成演示数据

```powershell
cd D:\Poetry\Poetry-AI\backend
python scripts\seed_demo_flow.py --teacher-email teacher@example.com --student-email student@example.com
```

不传邮箱时，脚本会优先复用 `user_profiles.role` 中已有的教师/学生；没有角色数据时，会从 Auth 用户列表中自动选择。

## 推荐演示顺序

1. 用学生账号登录，进入 `/learn` 查看诗词学习。
2. 进入 `/explore`，选择《静夜思》或山水诗，展示诗词详情和教学内容。
3. 进入 `/graph`，展示诗人、朝代、意象、主题、手法之间的知识图谱。
4. 进入 `/practice`，演示练习、考试入口、错题沉淀。
5. 进入 `/my-learning`，展示学习进度、任务、错题、复习计划。
6. 进入 `/create`，展示仿写作品和创作广场。
7. 切换教师账号，进入 `/teacher`，展示班级、课堂会话、任务布置。

## 常见问题

### 提示没有 Auth 用户

先通过前端注册或登录至少一个账号，再重新运行脚本。

### 只有一个账号

脚本会把同一个用户同时作为教师和学生使用，适合临时演示。由于数据库策略不允许给自己的公开作品点赞，`creation_likes` 会跳过。

### 页面看不到教师入口

确认教师账号的 `user_profiles.role` 为 `teacher`。重新运行脚本会自动修正指定教师账号的角色。

### 图谱表显示不可用

如果 `poem_graph_nodes` 和 `poem_graph_edges` 显示不可用，说明当前 Supabase 还没有执行图谱相关迁移。脚本会自动跳过这两张表，其余学习、练习、班级、任务、背诵、错题和创作流程不受影响。

### 想刷新演示数据

直接重新运行生成命令即可。脚本是幂等的，会覆盖同一批演示数据的最新状态。
