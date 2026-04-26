import { memo, useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

const CONFETTI_COLORS = ["#c89b5a", "#e8c97a", "#c03b3b", "#223a5e", "#d4695a", "#f0d68a"];
const PARTICLE_COUNT = 80;

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const rafRef = useRef<number>(0);

  const spawnParticles = useCallback((width: number, height: number) => {
    const particles: ConfettiParticle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: -Math.random() * height * 0.6,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2 + 1.5,
        size: Math.random() * 6 + 3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        life: 0,
        maxLife: 200 + Math.random() * 120,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    spawnParticles(canvas.width, canvas.height);
    window.addEventListener("resize", resize);

    let frame = 0;
    const animate = () => {
      if (frame % 120 === 0 && frame < 600) {
        spawnParticles(canvas.width, canvas.height);
      }
      frame++;

      const particles = particlesRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        if (p.life > p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.vy += 0.03; // gravity
        p.y += p.vy;
        p.vx *= 0.995; // air resistance

        const alpha = 1 - p.life / p.maxLife;
        const sinWiggle = Math.sin(p.life * 0.1) * 1.5;
        ctx.save();
        ctx.translate(p.x + sinWiggle, p.y);
        ctx.rotate((p.life * 0.05));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [spawnParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}

const Confetti = memo(ConfettiCanvas);

export default function CelebrationOverlay({
  title,
  author,
  dynasty,
  poemId,
  accuracy,
  onDismiss,
}: {
  title: string;
  author: string;
  dynasty: string;
  poemId: string;
  accuracy?: number;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 400);
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={handleDismiss}
        >
          <Confetti />

          {/* Ink-brush animated background */}
          <div className="absolute inset-0 bg-[#f7f4ee]/94 backdrop-blur-sm">
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 40%, #223a5e 0%, transparent 55%), radial-gradient(circle at 70% 60%, #c89b5a 0%, transparent 50%)",
                animation: "inkBreath 4s ease-in-out infinite",
              }}
            />
          </div>

          <motion.div
            className="relative z-20 bg-white/90 backdrop-blur-lg border border-[rgba(200,155,90,0.3)] rounded-3xl px-12 py-11 shadow-[0_24px_64px_rgba(34,58,94,0.12)] max-w-md w-full mx-4 text-center"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[rgba(200,155,90,0.10)] mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
            >
              <span className="text-4xl">&#x1f3c6;</span>
            </motion.div>

            <motion.p
              className="text-sm tracking-[0.18em] text-[#9b6731] uppercase mb-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              精讲完成
            </motion.p>

            <motion.h2
              className="text-3xl font-serif text-brand-ink mb-2"
              style={{
                background: "linear-gradient(135deg, #c89b5a 0%, #e8c97a 50%, #9b6731 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {title}
            </motion.h2>

            <motion.p
              className="text-base text-ink-secondary mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              {dynasty} · {author}
            </motion.p>

            <motion.div
              className="grid grid-cols-3 gap-3 mb-9"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <div className="bg-[rgba(34,58,94,0.03)] rounded-xl py-3 px-2">
                <p className="text-xl font-serif text-brand-ink">5</p>
                <p className="text-xs text-ink-secondary mt-1">阶段完成</p>
              </div>
              <div className="bg-[rgba(34,58,94,0.03)] rounded-xl py-3 px-2">
                <p className="text-xl font-serif text-brand-ink">
                  {accuracy != null ? `${Math.round(accuracy * 100)}%` : "--"}
                </p>
                <p className="text-xs text-ink-secondary mt-1">记忆正确率</p>
              </div>
              <div className="bg-[rgba(34,58,94,0.03)] rounded-xl py-3 px-2">
                <p className="text-xl font-serif text-brand-ink">&#x2714;</p>
                <p className="text-xs text-ink-secondary mt-1">已记录</p>
              </div>
            </motion.div>

            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
            >
              <Link
                to={`/my-learning?tab=overview&refId=${poemId}`}
                className="inline-flex items-center justify-center h-11 rounded-xl bg-[rgba(200,155,90,0.12)] text-[#8A6B32] font-medium text-sm hover:bg-[rgba(200,155,90,0.18)] transition-colors"
              >
                查看学情报告 &rarr;
              </Link>
              <Link
                to="/explore"
                className="inline-flex items-center justify-center h-11 rounded-xl bg-[#c03b3b] text-white font-medium text-sm hover:bg-[#d4695a] transition-colors"
              >
                探索下一首
              </Link>
              <button
                className="inline-flex items-center justify-center h-11 rounded-xl bg-transparent text-ink-secondary text-sm hover:text-brand-ink transition-colors"
                onClick={handleDismiss}
              >
                关闭
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
