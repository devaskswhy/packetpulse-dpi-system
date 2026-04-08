import { useEffect, useRef, useState } from 'react';

export function useCountUp(target, duration = 600) {
  const [count, setCount] = useState(target);
  const prev = useRef(target);
  const animRef = useRef(null);

  useEffect(() => {
    // Skip animation if difference is tiny
    if (!target || Math.abs(target - prev.current) < 5) {
      setCount(target || 0);
      prev.current = target || 0;
      return;
    }

    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 2);
      setCount(Math.round(start + diff * ease));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        prev.current = target;
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [target, duration]);

  return count;
}
