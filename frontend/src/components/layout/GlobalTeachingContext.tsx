import { useNavigate } from 'react-router-dom';
import { useLearningContextStore } from '@/stores/learningContextStore';

const stageLabels: Record<string, string> = {
  firstMeet:  '初见',
  analysis:   '解析',
  inquiry:    '探究',
  memory:     '记忆',
  examPoints: '考点',
};

const stageNext: Record<string, { label: string; path: string }> = {
  explore:  { label: '开始精讲', path: '/learn' },
  firstMeet:{ label: '进入解析', path: '/learn?tab=analysis' },
  analysis: { label: '进入探究', path: '/learn?tab=inquiry' },
  inquiry:  { label: '开始记忆', path: '/learn?tab=memory' },
  memory:   { label: '查看考点', path: '/learn?tab=examPoints' },
  examPoints:{ label: '去练测',   path: '/practice' },
  practice: { label: '记忆训练', path: '/memory' },
  create:   { label: '查看学情', path: '/my-learning' },
};

export function GlobalTeachingContext() {
  const { currentUnitName, currentPoemTitle, currentStage } =
    useLearningContextStore();
  const navigate = useNavigate();

  if (!currentUnitName && !currentPoemTitle) return null;

  const next = currentStage ? stageNext[currentStage] : null;

  return (
    <div 
      className="global-teaching-context-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 24px',
        background: 'var(--warm-50)',
        borderBottom: '1px solid var(--border-default)',
        fontSize: '13px',
        color: 'var(--text-secondary)'
      }}
    >
      {currentUnitName  && <span style={{ fontWeight: 500 }}>🎯 当前单元：{currentUnitName}</span>}
      {currentPoemTitle && <span style={{ fontWeight: 500 }}>📍 当前诗词：{currentPoemTitle}</span>}
      {currentStage     && <span>🚩 教学阶段：{stageLabels[currentStage] || '未知阶段'}</span>}
      {next && (
        <button 
          onClick={() => navigate(next.path)}
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            background: 'var(--brand-ink)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          ▶ 下一步：{next.label}
        </button>
      )}
    </div>
  );
}
