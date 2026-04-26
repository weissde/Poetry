import { useEffect, useMemo, useState } from "react";
import { Users, Clock, Target, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { BlurText, Magnet } from "@/components/react-bits";
import { CourseCover } from "@/components/home/CourseCover";
import { TeachingFlowStrip } from "@/components/home/TeachingFlowStrip";
import { TodaySection } from "@/components/home/TodaySection";
import { CurriculumNav } from "@/components/teaching/CurriculumNav";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";
import { useTodayTasks } from "@/hooks/useTodayTasks";
import {
  advanceTeachingSession,
  createTeachingSession,
  getLatestTeachingSession,
  getPoemDetail,
  getUserRole,
} from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type {
  CurriculumNavSection,
  TeachingSessionRecord,
  TeachingUnitItem,
  PoemRecord,
} from "@/types";

const JOURNEY_INTRO_STORAGE_KEY = "poetry_ai_journey_intro_v1_dismissed";

const teacherQuickActions = [
  { label: "杩涘叆璇楄瘝绮捐", to: "/learn" },
  { label: "鍙戝竷鍗虫椂缁冧範", to: "/practice?entry=practice" },
  { label: "鏌ョ湅鏁欏鍗曞厓", to: "/explore" },
  { label: "鏌ョ湅瀛︽儏涓績", to: "/my-learning" },
] as const;

function GuestOverview(): JSX.Element {
  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <section className="mx-auto max-w-[760px] rounded-[32px] bg-[linear-gradient(135deg,#1A2B4C_0%,#283F68_62%,#3C567E_100%)] px-6 py-12 text-white shadow-[0_22px_48px_rgba(26,43,76,0.24)] md:px-10">
          <p className="text-xs tracking-[0.18em] text-white/70">璇楀閫?路 璇惧爞闂ㄥ巺</p>
          <BlurText as="h1" text="鎶婂彜璇楄瘝瀛︿範缁勭粐鎴愪竴娈垫竻鏅扮殑璇惧爞鏃呯▼" className="mt-4 text-4xl font-semibold leading-tight md:text-5xl" delayPerChar={0.018} />
          <p className="mt-5 max-w-[560px] text-sm leading-8 text-white/82 md:text-base">
            鐧诲綍鍚庣洿鎺ヨ繘鍏ヤ粖鏃ヨ绋嬨€佺簿璁层€佺粌娴嬨€佸浘璋变笌瀛︽儏宸ヤ綔鍖猴紝涓嶅啀鍋滅暀鍦ㄩ暱绡囦骇鍝佷粙缁嶉〉銆?          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="btn-primary inline-flex items-center gap-2 bg-white text-[#1A2B4C] hover:bg-stone-100">
              寮€濮嬪涔?              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 text-white hover:bg-white/16">
              杩涘叆婕旂ず璐﹀彿
            </Link>
          </div>
        </section>
      </PageStage>
    </div>
  );
}

function StudentOverview({ onSwitchToTeacher }: { onSwitchToTeacher: () => void }): JSX.Element {
  const { currentPoemId } = useTeachingMode();
  const { data: taskPayload } = useTodayTasks();
  const [showJourneyIntro, setShowJourneyIntro] = useState(false);
  const [heroPoem, setHeroPoem] = useState<PoemRecord | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(JOURNEY_INTRO_STORAGE_KEY) !== "1") {
        setShowJourneyIntro(true);
      }
    } catch {
      setShowJourneyIntro(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!currentPoemId) {
      setHeroPoem(null);
      return () => {
        active = false;
      };
    }

    void getPoemDetail(currentPoemId)
      .then((poem) => {
        if (active) {
          setHeroPoem(poem);
        }
      })
      .catch(() => {
        if (active) {
          setHeroPoem(null);
        }
      });

    return () => {
      active = false;
    };
  }, [currentPoemId]);

  const taskItems = taskPayload?.items || [];
  const pendingTaskCount = taskPayload?.summary?.todo ?? taskItems.filter((task) => task.status === "todo").length;
  const heroLesson = useMemo(() => {
    if (!heroPoem) {
      return {
        title: "寰呴€夋嫨璇楄瘝",
        author: "鈥?,
        dynasty: "鈥?,
        summary: "褰撳墠鏈攣瀹氳鍫傝瘲璇嶏紝鍏堝幓鎺㈢储鎴栫簿璁查〉閫夋嫨涓€棣栬瘲寮€濮嬨€?,
        goals: ["閫夋嫨浠婃棩绮捐璇楄瘝", "瀹屾垚绮捐涓庣粌娴嬭鎺?, "鍥炲埌瀛︽儏椤垫煡鐪嬬粨鏋?],
        to: "/learn",
      };
    }
    return {
      title: heroPoem.title,
      author: heroPoem.author,
      dynasty: heroPoem.dynasty,
      summary: `浠婂ぉ缁х画瀛︿範銆?{heroPoem.title}銆嬶紝鍏堝畬鎴愮簿璁诧紝鍐嶆妸璇惧爞缁撴灉甯﹀埌缁冩祴涓庡鎯呭鐩樸€俙,
      goals: [
        `瀹屾垚銆?{heroPoem.title}銆嬬殑涓€杞簿璁蹭笌瑙ｆ瀽`,
        "鎶婅鍫傜悊瑙ｈ縼绉诲埌缁冩祴鎴栨帰绌朵换鍔￠噷",
        "鍦ㄥ鎯呴〉鏌ョ湅鏈瘲鐩稿叧琛ㄧ幇涓庝笅涓€姝ュ缓璁?,
      ],
      to: `/learn/${heroPoem.id}`,
    };
  }, [heroPoem]);

  const dismissJourneyIntro = (): void => {
    try {
      window.localStorage.setItem(JOURNEY_INTRO_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowJourneyIntro(false);
  };

  return (
    <>
    <div className="page-shell">
      <PageStage tone="primary">
        <CourseCover
          title="鍞愬畫璇楄瘝 AI 鏁欏璇句欢"
          subtitle="AI 椹卞姩鐨勫畬鏁磋鍫傚涔犱綋楠屻€備粠杩欓噷寮€濮嬩粖澶╃殑绮捐銆佺粌娴嬨€佸浘璋变笌瀛︽儏宸ヤ綔鍖恒€?
          primaryAction={{ label: "寮€濮嬩粖鏃ヨ绋?, to: heroLesson.to }}
          secondaryAction={{ label: "鏌ョ湅瀛︽儏", to: "/my-learning" }}
        >
          <Magnet className="inline-flex">
            <button type="button" onClick={onSwitchToTeacher} className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 px-6 py-3 text-base text-white hover:bg-white/16 ml-4">
              鍒囨崲鏁欏笀妯″紡
            </button>
          </Magnet>
        </CourseCover>
      </PageStage>

      <PageStage tone="secondary">
        <TeachingFlowStrip currentStage="explore" />
      </PageStage>

      <PageStage tone="secondary">
        <TodaySection
          memoryCount={12}
          practiceCount={pendingTaskCount}
          recommendedPoem={heroPoem || { id: "default", title: "闈欏鎬? }}
        />
      </PageStage>

      <PageStage tone="secondary">
        <LearnJourneyProgress />
      </PageStage>
    </div>

    {showJourneyIntro ? (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-intro-heading"
      >
        <div className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-[linear-gradient(160deg,#fffdf8_0%,#f4efe6_100%)] p-6 shadow-[0_24px_60px_rgba(26,43,76,0.22)] md:p-8">
          <p className="text-2xl" aria-hidden>
            馃憢
          </p>
          <h2 id="journey-intro-heading" className="mt-2 font-display text-2xl text-[#1A2B4C] md:text-3xl">
            <BlurText as="span" text="娆㈣繋鏉ュ埌璇楀閫? className="font-display text-2xl text-[#1A2B4C] md:text-3xl" delayPerChar={0.022} />
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">璁╂垜浠姳 30 绉掍簡瑙ｄ竴涓嬪涔犳梾绋嬶細</p>
          <ol className="mt-4 space-y-2.5 text-sm leading-7 text-slate-700">
            <li>鈶?鎺㈢储锛氶€夋嫨瑕佸涔犵殑璇楄瘝</li>
            <li>鈶?瀛︿範锛欰I 绮捐 + 鎺㈢┒瀵硅瘽</li>
            <li>鈶?缁冩祴锛氫笓椤圭粌涔?+ 妯℃嫙鑰冭瘯</li>
            <li>鈶?璁板繂锛氬～绌?+ 榛樺啓 + 澶嶄範</li>
            <li>鈶?瀛︽儏锛氳瘖鏂急鐐?+ 澶嶄範璁″垝</li>
          </ol>
          <div className="mt-8 flex flex-wrap gap-2">
            <Magnet className="inline-flex">
              <Link
                to="/explore"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => {
                  dismissJourneyIntro();
                }}
              >
                寮€濮嬫帰绱?                <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnet>
            <button type="button" onClick={dismissJourneyIntro} className="btn-secondary">
              绋嶅悗鍐嶈
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function TeacherOverviewHome({ onSwitchToStudent }: { onSwitchToStudent: () => void }): JSX.Element {
  const navigate = useNavigate();
  const { setCurrentPoemId, setCurrentSessionId, setCurrentStep } = useTeachingMode();
  const { data: unitsPayload } = useTeachingUnits();
  const [latestSession, setLatestSession] = useState<TeachingSessionRecord | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [isStartingTeaching, setIsStartingTeaching] = useState(false);
  const units = unitsPayload?.items || [];

  useEffect(() => {
    let active = true;

    void Promise.allSettled([getLatestTeachingSession()]).then((results) => {
      if (!active) {
        return;
      }
      const [sessionResult] = results;
      if (sessionResult.status === "fulfilled") {
        const nextSession = sessionResult.value.session || null;
        setLatestSession(nextSession);
        if (nextSession?.status === "active") {
          setCurrentSessionId(nextSession.id || null);
          setCurrentPoemId(nextSession.poemId || null);
          setCurrentStep(nextSession.currentStep || 1);
        } else if (!nextSession) {
          setCurrentSessionId(null);
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedUnitId((current) => current || units[0]?.id || "");
  }, [units]);

  const selectedUnit = useMemo(() => units.find((item) => item.id === selectedUnitId) || units[0] || null, [selectedUnitId, units]);

  const unitSections = useMemo<CurriculumNavSection[]>(() => {
    if (!units.length) {
      return [
        {
          title: "璇剧▼鍗曞厓",
          caption: "绛夊緟鏁欏鍗曞厓鏁版嵁",
          items: [],
        },
      ];
    }
    const groups = new Map<string, TeachingUnitItem[]>();
    for (const unit of units) {
      const key = unit.gradeLevel[0] || "all";
      groups.set(key, [...(groups.get(key) || []), unit]);
    }
    return Array.from(groups.entries()).map(([grade, items]) => ({
      title: `璇剧▼鍗曞厓 路 ${grade === "all" ? "鍏ㄩ儴" : grade}`,
      caption: "鏁版嵁搴撻┍鍔ㄧ殑鏁欏鍗曞厓瀵艰埅",
      items: items.map((item) => ({
        id: item.id,
        label: item.title,
        keyword: item.title,
        gradeLevel: item.gradeLevel[0] || "all",
      })),
    }));
  }, [units]);

  const startTeachingTo = latestSession?.poemId
    ? `/learn/${latestSession.poemId}`
    : selectedUnit?.poemIds?.[0]
      ? `/learn/${selectedUnit.poemIds[0]}`
      : "/learn";

  const handleStartTeaching = async (): Promise<void> => {
    if (isStartingTeaching) {
      return;
    }
    const fallbackPoemId = latestSession?.poemId || selectedUnit?.poemIds?.[0] || null;
    const fallbackStep = Math.max(1, latestSession?.currentStep ?? 1);
    const fallbackTarget = fallbackPoemId ? `/learn/${fallbackPoemId}` : startTeachingTo;

    setIsStartingTeaching(true);

    try {
      const commonPayload = {
        poemId: fallbackPoemId || undefined,
        poemTitle: latestSession?.poemTitle || selectedUnit?.title || undefined,
        unitId: latestSession?.unitId || selectedUnit?.id || undefined,
      };
      const nextSession =
        latestSession?.id && latestSession.status === "active"
          ? (await advanceTeachingSession(latestSession.id, { currentStep: fallbackStep, ...commonPayload })).session
          : (await createTeachingSession({ currentStep: fallbackStep, ...commonPayload })).session;

      const syncedSession = nextSession || latestSession;
      const nextPoemId = syncedSession?.poemId || fallbackPoemId;
      const nextStep = Math.max(1, syncedSession?.currentStep ?? fallbackStep);
      const nextTarget = nextPoemId ? `/learn/${nextPoemId}` : "/learn";

      setLatestSession(syncedSession || null);
      setCurrentSessionId(syncedSession?.id || null);
      setCurrentPoemId(nextPoemId || null);
      setCurrentStep(nextStep);
      void navigate(nextTarget);
      return;
    } catch {
    } finally {
      setIsStartingTeaching(false);
    }

    setCurrentPoemId(fallbackPoemId);
    setCurrentStep(fallbackStep);
    void navigate(fallbackTarget);
  };

  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <CourseCover
          title="鍞愬畫璇楄瘝 AI 鏁欏璇句欢"
          subtitle="鏁欏笀宸ヤ綔鍙板叆鍙ｃ€備粠杩欓噷寮€濮嬭鍫傜簿璁层€佸竷缃换鍔′笌鐝骇瀛︽儏杩借釜銆?
          primaryAction={{ label: "寮€濮嬭鍫?, onClick: () => void handleStartTeaching() }}
          secondaryAction={{ label: "甯冪疆浠诲姟", to: "/my-learning?scope=classroom&board=homework" }}
        >
          <Magnet className="inline-flex">
            <button type="button" onClick={onSwitchToStudent} className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 px-6 py-3 text-base text-white hover:bg-white/16 ml-4">
              鍒囨崲鍥炲鐢熻瑙?            </button>
          </Magnet>
        </CourseCover>
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard density="roomy" weight="summary">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <p className="text-xs tracking-[0.12em] text-slate-500">鐝骇瀛︾敓</p>
            </div>
            <p className="font-serif text-3xl text-[#1A2B4C]">32 <span className="text-sm font-sans text-slate-500">浜?</span></p>
          </SectionCard>
          <SectionCard density="roomy" weight="summary">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-emerald-500" />
              <p className="text-xs tracking-[0.12em] text-slate-500">浠婃棩娲昏穬</p>
            </div>
            <p className="font-serif text-3xl text-[#1A2B4C]">28 <span className="text-sm font-sans text-slate-500">浜?</span></p>
          </SectionCard>
          <SectionCard density="roomy" weight="summary">
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-5 w-5 text-amber-500" />
              <p className="text-xs tracking-[0.12em] text-slate-500">骞冲潎姝ｇ‘鐜?</p>
            </div>
            <p className="font-serif text-3xl text-[#1A2B4C]">76<span className="text-sm font-sans text-slate-500">%</span></p>
          </SectionCard>
        </div>
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <SectionCard
            title="鏈€杩戣鍫傝褰?
            subtitle="缁х画鏈畬鎴愮殑璇惧爞鎴栨煡鐪嬪巻鍙茶褰曘€?
            density="roomy"
            weight="workspace"
          >
            <div className="rounded-[28px] bg-white/88 px-5 py-5 shadow-[0_10px_28px_rgba(34,58,94,0.08)]">
              <p className="text-xs tracking-[0.14em] text-slate-500">璇剧▼瀵艰埅</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                褰撳墠鍗曞厓锛歿selectedUnit?.title || "绛夊緟鏁欏鍗曞厓"}銆傛暀甯堝彲浠ュ厛閫夊畾鍗曞厓锛屽啀寮€濮嬬簿璁叉垨鍒嗗彂浠诲姟銆?              </p>
              <CurriculumNav
                sections={unitSections}
                selectedLabel={selectedUnit?.title || ""}
                onSelect={(item) => {
                  setSelectedUnitId(item.id);
                }}
                className="mt-4"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="蹇嵎鎿嶄綔"
            subtitle="鏁欏笀甯哥敤绠＄悊宸ュ叿鍏ュ彛銆?
            density="roomy"
            weight="summary"
          >
            <div className="grid gap-3">
              {teacherQuickActions.map((action) => (
                <Link key={action.label} to={action.to} className="rounded-[22px] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5">
                  <p className="font-serif text-xl text-[#1A2B4C]">{action.label}</p>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </PageStage>
    </div>
  );
}

export default function HomePage(): JSX.Element {
  const { isTeacherMode, setTeachingMode } = useTeachingMode();
  const { user, initialized, initialize } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (!initialized || !user?.id) {
      return;
    }

    let active = true;
    void getUserRole()
      .then((payload) => {
        if (!active) {
          return;
        }
        const role = payload.role === "teacher" ? "teacher" : "student";
        setTeachingMode(role);
      })
      .catch(() => {
        // keep local teaching mode when role API is unavailable
      });

    return () => {
      active = false;
    };
  }, [initialized, setTeachingMode, user?.id]);

  const handleSwitchToStudent = (): void => {
    setTeachingMode("student");
  };

  const handleSwitchToTeacher = (): void => {
    setTeachingMode("teacher");
  };

  if (!initialized) {
    return (
      <div className="page-shell">
        <PageStage tone="primary">
          <section className="rounded-[28px] bg-white px-6 py-8 text-sm text-slate-500 shadow-[0_12px_32px_rgba(26,43,76,0.06)]">
            姝ｅ湪鍑嗗璇惧爞闂ㄥ巺...
          </section>
        </PageStage>
      </div>
    );
  }

  if (!user) {
    return <GuestOverview />;
  }

  if (isTeacherMode) {
    return <TeacherOverviewHome onSwitchToStudent={handleSwitchToStudent} />;
  }

  return <StudentOverview onSwitchToTeacher={handleSwitchToTeacher} />;
}

