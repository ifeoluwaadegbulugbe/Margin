'use client';
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/** Count from `from` to `to` over `ms` with ease-out (tabular figures prevent jitter). */
export function useCountUp(to: number, ms = 800, from = 0) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(from);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, from, reduce]);
  return reduce ? to : v;
}
