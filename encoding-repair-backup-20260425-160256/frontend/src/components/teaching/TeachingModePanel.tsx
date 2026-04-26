import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { useTeachingStore } from "@/stores/teachingStore";
import { Magnet } from "@/components/react-bits";
import { advanceTeachingSession, createTeachingSession } from "@/lib/api";

const STEPS = [
  { index: 0, label: '鎬昏' },
  { index: 1, label: '绮捐' },
  { index: 2, label: '鎺㈢┒' },
  { index: 3, label: '缁冩祴' },
  { index: 4, label: '璁板繂' },
  { index: 5, label: '瀛︽儏' },
];

const STEP_HINTS: Record<number, string> = {
  0: '璇句欢鎬昏锛氬悜瀛︾敓浠嬬粛浠婂ぉ鐨勫涔犵洰鏍囧拰鏁欏娴佺▼銆?,
  1: '璇楄瘝绮捐锛氬缓璁睍绀?鏍囧噯鐗?AI 瑙ｆ瀽锛岄噸鐐瑰紩瀵煎鐢熷叧娉ㄦ剰璞″拰鎯呮劅鍒嗘瀽銆?,
  2: '鎺㈢┒浜掑姩锛氬缓璁椂闀?8-10 鍒嗛挓锛岄璁鹃棶棰橀€愪竴灞曠ず锛岃 2-3 浣嶅悓瀛﹀彂瑷€銆?,
  3: '鍗虫椂缁冧範锛氬竷缃?5-8 閬撲笌鏈瘲鐩稿叧鐨勭粌涔狅紝妫€娴嬪綋鍫傛帉鎻℃儏鍐点€?,
  4: '璁板繂宸╁浐锛氬竷缃鍚庨粯鍐欎换鍔★紝寤鸿璁剧疆鏄庡ぉ澶嶄範鎻愰啋銆?,
  5: '瀛︽儏澶嶇洏锛氭煡鐪嬪綋鍫傜粌涔犲噯纭巼锛屾壘鍑哄叏鐝叡鍚岃杽寮辩偣銆?,
};

export function TeachingModePanel(): JSX.Element | null {
  const { isTeacherMode, currentStep, currentPoemId, setCurrentStep, toggleTeachingMode } = useTeachingMode();
  const teacherControlPanelOpen = useTeachingStore((state) => state.teacherControlPanelOpen);
  const toggleTeacherControlPanel = useTeachingStore((state) => state.toggleTeacherControlPanel);
  const setTeacherControlPanelOpen = useTeachingStore((state) => state.setTeacherControlPanelOpen);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0); // 婕旂ず鏃堕暱锛堢锛?
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
      await advanceTeachingSession(sessionId, { currentStep: newStep })
        .catch(() => {}); // 闈欓粯澶辫触锛屽墠绔姸鎬佸凡鏇存柊
    }
  }

  async function startNewSession() {
    try {
      const result = await createTeachingSession({
        poemId: currentPoemId ?? undefined,
        currentStep: currentStep,
      });
      setSessionId(result.session?.id ?? null);
      setElapsed(0);
    } catch {
      // 闈欓粯锛宻ession 涓嶅奖鍝嶆紨绀哄姛鑳?    }
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
            {/* 1. 鍏抽棴鎸夐挳 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>馃搳 璇惧爞鎺у埗鍙?</h2>
              <button onClick={() => setTeacherControlPanelOpen(false)} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral)' }}>脳</button>
            </div>

            {/* 2. 褰撳墠璇楄瘝 */}
            <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--neutral)' }}>褰撳墠璇楄瘝</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 500, color: 'var(--ink-900)' }}>
                {currentPoemId ? `銆婂凡閫夎瘲璇嶃€媊 : '鏈€夋嫨'} 
                <Link to="/explore" style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--ink-500)', textDecoration: 'none' }}>鏇存崲 鈻?</Link>
              </p>
            </div>

            {/* 3. 姝ラ杩涘害 + 涓婁竴姝?涓嬩竴姝ユ寜閽?*/}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '12px' }}>鏁欏杩涘害</h3>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {STEPS.map(step => (
                  <div key={step.index} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    <span style={{ color: currentStep === step.index ? 'var(--warm-700)' : (currentStep > step.index ? 'var(--success)' : 'var(--neutral)') }}>
                      {currentStep === step.index ? '鈼? : (currentStep > step.index ? '鉁? : '鈼?)}
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
                  鈫?涓婁竴姝?                </button>
                <button 
                  onClick={() => advanceStep(Math.min(5, currentStep + 1))}
                  disabled={currentStep >= 5}
                  className="btn-secondary-compact"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  涓嬩竴姝?鈫?                </button>
              </div>
            </div>

            {/* 4. 鏈楠ゆ暀瀛︽彁绀?*/}
            <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--warm-50)', borderLeft: '3px solid var(--warm-700)', borderRadius: '0 8px 8px 0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warm-700)', margin: '0 0 8px 0' }}>鏈楠ゆ暀瀛︽彁绀?</h3>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--ink-900)' }}>
                {STEP_HINTS[currentStep] || '鏃?}
              </p>
            </div>

            {/* 5. 蹇嵎鎿嶄綔鍖?*/}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '12px' }}>蹇嵎鎿嶄綔</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Link to="/practice" className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>鍙戝竷鍗虫椂缁冧範</Link>
                <Link to="/practice?tab=memory" className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>甯冪疆榛樺啓浠诲姟</Link>
                <Link to="/my-learning" className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>瀵煎嚭瀛︽儏鎶ュ憡</Link>
                <button onClick={() => toggleTeachingMode()} className="btn-secondary-compact" style={{ justifyContent: 'center', fontSize: '12px' }}>鍒囨崲瀛︾敓瑙嗗浘</button>
              </div>
            </div>

            {/* 6. 婕旂ず璁板綍 */}
            <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 12px 0' }}>
                婕旂ず璁板綍 路 {sessionId ? `鏈宸茶繘琛?${formatTime(elapsed)}` : '灏氭湭寮€濮?}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button disabled={!sessionId} className="btn-secondary-compact" style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }}>淇濆瓨杩涘害</button>
                <button onClick={startNewSession} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '12px', padding: '6px' }}>寮€濮嬫柊婕旂ず</button>
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
          馃搳 璇惧爞鎺у埗鍙?        </button>
      </Magnet>
    </>
  );
}

