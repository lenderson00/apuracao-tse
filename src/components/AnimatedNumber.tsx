import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, format, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { val: current.current };
    gsap.to(obj, {
      val: value,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        current.current = obj.val;
        el.textContent = format ? format(obj.val) : String(Math.round(obj.val));
      },
    });
  }, [value, format]);

  return (
    <span ref={ref} className={className}>
      {format ? format(value) : String(value)}
    </span>
  );
}
