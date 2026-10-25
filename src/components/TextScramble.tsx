import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./_';

interface Props {
  text: string;
  className?: string;
  /** Run scramble once on mount */
  playOnMount?: boolean;
}

export function TextScramble({ text, className, playOnMount = true }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(playOnMount ? '' : text);
  const done = useRef(!playOnMount);

  useEffect(() => {
    if (!playOnMount || done.current) {
      setDisplay(text);
      return;
    }
    const len = text.length;
    let frame = 0;
    const total = 28;
    const id = setInterval(() => {
      frame += 1;
      const progress = frame / total;
      const revealed = Math.floor(progress * len);
      let out = '';
      for (let i = 0; i < len; i++) {
        if (text[i] === ' ') {
          out += ' ';
        } else if (i < revealed) {
          out += text[i];
        } else {
          out += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      setDisplay(out);
      if (frame >= total) {
        clearInterval(id);
        setDisplay(text);
        done.current = true;
      }
    }, 32);
    return () => clearInterval(id);
  }, [text, playOnMount]);

  useEffect(() => {
    if (!ref.current || !playOnMount) return;
    gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  }, [playOnMount]);

  return (
    <span ref={ref} className={className}>
      {display || text}
    </span>
  );
}
