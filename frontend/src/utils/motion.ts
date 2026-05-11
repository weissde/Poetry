import { type Variants } from "framer-motion";

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] },
  },
};

export function stagger(i = 0.06): Variants {
  return {
    animate: {
      transition: { staggerChildren: i },
    },
  };
}
