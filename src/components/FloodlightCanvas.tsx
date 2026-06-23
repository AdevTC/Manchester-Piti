import React, { useEffect, useRef } from "react";

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
}

/**
 * Cinematic "stadium floodlight" layer for the hero: soft sky-blue light cones
 * from above plus slow-drifting atmospheric motes, drawn on a Canvas 2D context.
 * Dependency-free. Pauses when off-screen, caps particle count, and renders a
 * single static frame under prefers-reduced-motion. The hero also carries a CSS
 * fallback glow, so this is pure enhancement.
 */
export const FloodlightCanvas: React.FC<{ className?: string }> = ({ className }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let motes: Mote[] = [];

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(18, Math.min(60, Math.round(w / 26)));
      motes = Array.from({ length: count }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.6, 2.2),
        vx: rand(-0.07, 0.07),
        vy: rand(-0.24, -0.05),
        a: rand(0.05, 0.32),
      }));
    };

    const drawBeams = () => {
      const g1 = ctx.createRadialGradient(w * 0.72, -h * 0.2, 0, w * 0.72, -h * 0.2, h * 1.25);
      g1.addColorStop(0, "rgba(108,171,221,0.17)");
      g1.addColorStop(1, "rgba(108,171,221,0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(w * 0.16, -h * 0.12, 0, w * 0.16, -h * 0.12, h * 1.1);
      g2.addColorStop(0, "rgba(124,211,252,0.10)");
      g2.addColorStop(1, "rgba(124,211,252,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
    };

    const drawMotes = () => {
      for (const m of motes) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196,222,247,${m.a})`;
        ctx.fill();
        m.x += m.vx;
        m.y += m.vy;
        if (m.y < -12) {
          m.y = h + 12;
          m.x = rand(0, w);
        }
        if (m.x < -12) m.x = w + 12;
        else if (m.x > w + 12) m.x = -12;
      }
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      drawBeams();
      drawMotes();
      raf = requestAnimationFrame(frame);
    };

    resize();

    if (reduce) {
      ctx.clearRect(0, 0, w, h);
      drawBeams();
      return;
    }

    // Run the loop only when the canvas is on-screen AND the tab is visible.
    // A backgrounded tab keeps "intersecting" but is hidden, so without the
    // visibility gate the rAF loop would keep burning CPU/battery (browsers only
    // throttle, not stop, background rAF). Both gates funnel through this helper.
    let onScreen = false;
    const sync = () => {
      const shouldRun = onScreen && document.visibilityState === "visible";
      if (shouldRun && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={`mp-floodlight ${className ?? ""}`} aria-hidden="true" />;
};
