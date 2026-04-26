import { Fragment } from "react";
import { motion } from "framer-motion";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

interface BlurTextProps {
  text: string;
  as?: "p" | "h1" | "h2" | "h3" | "span";
  className?: string;
  delayPerChar?: number;
}

export function BlurText({ text, as = "p", className = "", delayPerChar = 0.045 }: BlurTextProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const Tag = as;

  if (reduceMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={className}>
      {text.split("").map((char, index) => (
        <Fragment key={`${char}-${index}`}>
          <motion.span
            className="inline-block whitespace-pre"
            initial={{ opacity: 0, filter: "blur(6px)", y: 6 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: index * delayPerChar }}
          >
            {char}
          </motion.span>
        </Fragment>
      ))}
    </Tag>
  );
}
