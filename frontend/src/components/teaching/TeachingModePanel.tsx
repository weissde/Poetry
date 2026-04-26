import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { useTeachingStore } from "@/stores/teachingStore";
import { Magnet } from "@/components/react-bits";
import { apiPost, apiPatch } from "@/lib/api";

const STEPS = [
  { index: 0, label: '总览' },
  { index: 1, label: '精讲' },
  { index: 2, label: '探究' },
  { index: 3, label: '练测' },
  { index: 4, label: '记忆' },
  { index: 5, label: '学情' },
];

const STEP_HINTS: Record<number, string> = {
  0: '课件总览：向学生介绍今天的学习目标和教学流程。',
  1: '诗词精讲：建议展示"标准版"AI 解析，重点引导学生关注意象和情感分析。',
  2: '探究互动：建议时长 8-10 分钟，预设问题逐一展示，请 2-3 位同学发言。',
  3: '即时练习：布置 5-8 道与本诗相关的练习，检测当堂掌握情况。',
  4: '记忆巩固：布置课后默写任务，建议设置明天复习提醒。',
  5: '学情复盘：查看当堂练习准确率，找出全班共同薄弱点。',
};

export function TeachingModePanel(): JSX.Element | null {
  const { isTeacherMode, currentStep, currentPoemId, setCurrentStep, toggleTeachingMode } = useTeachingMode();
  const teacherControlPanelOpen = useTeachingStore((state) => state.teacherControlPanelOpen);
  const toggleTeacherControlPanel = useTeachingStore((state) => state.toggleTeacherControlPanel);
  const setTeacherControlPanelOpen = useTeachingStore((state) => state.setTeacherControlPanelOpen);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0); // 演示时长（秒）

  useEffect(() => {
    let timer: number;
    if (sessionId) {
      timer = window.setInterval(() => setElapsed(prev => prev + 1), 1000);
    }
    return () => window.clearInterval(timer);
  }, [sessionId]);

  if (!isTeacherMode) return null;

  async function advanceStep(newStep: number) {
    setCurrentStep(newStep);
    if (sessionId) {
      await apiPatch(`/api/teaching/sessions/${sessionId}/advance-step`, { step: newStep })
        .catch(() => {}); // 静默失败，前端状态已更新
    }
  }

  async function startNewSession() {
    try {
      const session = await apiPost<{ id: string }>('/api/teaching/sessions', {
        poem_id: currentPoemId,
        current_step: currentStep,
      });
      setSessionId(session.id);
      setElapsed(0);
    } catch {
      // 静默，session 不影响演示功能
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <AnimatePresence>
        {teacherControlPanelOpen && (
          <motion.div
            key="panel"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.4, 1] }}
            style={{
              position: 'fixed', right: 0, top: 60, bottom: 0,
              width: 320, background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border)',
              boxShadow: '-4px 0 20px rgba(13,27,42,0.08)',
              zIndex: 100, overflowY: 'auto', padding: '24px 20px',
            }}
          >
            {/* 1. 关闭按钮 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>📊 课堂控制台</h2>
              <button onClick={() => setTeacherControlPanelOpen(false)} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral)' }}>×</button>
            </div>

            {/* 2. 当前诗词 */}
            <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--neutral)' }}>当前诗词</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 500, color: 'var(--ink-900)' }}>
                {currentPoemId ? `《已选诗词》` : '未选择'} 
                <Link to="/explore" style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--ink-500)', textDecoration: 'none' }}>更换 ▾</Link>
              </p>
            </div>

            {/* 3. 步骤进度 + 上一步/下一步按钮 */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '12px' }}>教学进度</h3>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {STEPS.map(step => (
                  <div key={step.index} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    <span style={{ color: currentStep === step.index ? 'var(--warm-700)' : (currentStep > step.index ? 'var(--success)' : 'var(--neutral)') }}>
                      {currentStep === step.index ? '●' : (currentStep > step.index ? '✓' : '○')}
                    </span>
                    <span style={{ color: currentStep === step.index ? 'var(--warm-700)' : 'var(--ink-900)' }}>{step.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => advanceStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep <= 0}
                  className="btn-secondary-compact"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  ← 上一步
                </button>
                <button 
                  onClick={() => advanceStep(Math.min(5, currentStep + 1))}
                  disabled={currentStep >= 5}
                  className="btn-secondary-compact"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  下一步 →
                </button>
              </div>
            </div>

            {/* 4. 本步骤教学提示 */}
            <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--warm-50)', borderLeft: '3px solid var(--warm-700)', borderRadius: '0 8px 8px 0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warm-700)', margin: '0 0 8px 0' }}>本步骤教学提示</h3>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--ink-900)' }}>
                {STEP_HINTS[currentStep] || '无'}
              </p>
            </div>

            {/* 5. 快捷操作区 */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '12px' }}>快捷操作</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Link to="/practice" className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>发布即时练习</Link>
                <Link to="/practice?tab=memory" className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>布置默写任务</Link>
                <Link to="/my-learning" className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>导出学情报告</Link>
                <button onClick={() => toggleTeachingMode()} className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>切换学生视图</button>
              </div>
            </div>

            {/* 6. 演示记录 */}
            <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 12px 0' }}>
                演示记录 · {sessionId ? `本次已进行 ${formatTime(elapsed)}` : '尚未开始'}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button disabled={!sessionId} className="btn-secondary-compact" style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }}>保存进度</button>
                <button onClick={startNewSession} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '12px', padding: '6px' }}>开始新演示</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Magnet>
        <button
          onClick={toggleTeacherControlPanel}
          style={{
            position: 'fixed', right: 24, bottom: 24,
            background: 'var(--warm-700)', color: '#fff',
            borderRadius: 24, padding: '10px 20px',
            boxShadow: '0 4px 16px rgba(160,98,43,0.3)',
            zIndex: 99, display: 'flex', alignItems: 'center', gap: 8,
            border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '14px'
          }}
        >
          📊 课堂控制台
        </button>
      </Magnet>
    </>
  );
}
