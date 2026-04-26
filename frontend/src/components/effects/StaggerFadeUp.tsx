import { Children, isValidElement, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

interface StaggerFadeUpProps {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  staggerSeconds?: number;
  initialDelaySeconds?: number;
  durationSeconds?: number;
}

export function StaggerFadeUp({
  children,
  className = "",
  itemClassName = "",
  staggerSeconds = 0.08,
  initialDelaySeconds = 0,
  durationSeconds = 0.42,
}: StaggerFadeUpProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const items = Children.toArray(children);

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = isValidElement(item) && item.key != null ? String(item.key) : `stagger-item-${index}`;
        return (
          <motion.div
            key={key}
            className={itemClassName}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: initialDelaySeconds + index * staggerSeconds,
              duration: durationSeconds,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {item}
          </motion.div>
        );
      })}
    </div>
  );
}
