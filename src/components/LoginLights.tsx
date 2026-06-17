import React, { useEffect, useRef } from "react";

/**
 * Cinematic stadium floodlights for the login. The beam origins are read from
 * the real `.lg-pylon` rigs in the DOM each resize, so the shafts always emanate
 * from the rigs at ANY screen size. Two corner rigs strike on with a buzz-flicker
 * and throw soft VOLUMETRIC beams that cross over the centre, with a camera-flash
 * at full ignition, lens streaks, and atmospheric dust drifting up through the
 * light. The light field renders into a low-res blurred buffer (cheap, genuinely
 * soft) composited additively over the navy; dust is drawn sharp.
 *
 * Honors prefers-reduced-motion (single lit static frame, no flicker/flash/dust
 * motion), pauses off-screen, caps DPR.
 */
interface Source {
  x: number; y: number;   // apex in CSS px (relative to the stage)
  dx: number; dy: number; // aim (unit vector toward the focal point)
  strike: number;         // ms after start when it lights
  tint: string;
  fill?: boolean;         // a soft ambient wash rather than a hard shaft
}

interface Mote { x: number; y: number; r: number; vx: number; vy: number; a: number; }

export const LoginLights: React.FC<{ className?: string }> = ({ className }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LSCALE = 0.4;

    const lr = document.createElement("canvas");
    const lctx = lr.getContext("2d");
    if (!lctx) return;

    let w = 0, h = 0, ls = 0, raf = 0, running = false, start = 0;
    let motes: Mote[] = [];
    let sources: Source[] = [];

    const computeSources = () => {
      const prect = parent.getBoundingClientRect();
      const focal = { x: w * 0.46, y: h * 0.62 };
      const rigs = Array.from(parent.querySelectorAll<HTMLElement>(".lg-pylon"));
      sources = [];
      rigs.forEach((el, idx) => {
        const r = el.getBoundingClientRect();
        const sx = r.left - prect.left + r.width / 2;
        const sy = r.top - prect.top + r.height * 0.42;
        const dx = focal.x - sx, dy = focal.y - sy;
        const m = Math.hypot(dx, dy) || 1;
        sources.push({ x: sx, y: sy, dx: dx / m, dy: dy / m, strike: idx === 0 ? 220 : 470, tint: "150, 200, 245" });
      });
      if (rigs.length === 0) {
        // fallback if the rigs aren't mounted yet
        sources.push(
          { x: w * 0.1, y: h * 0.06, dx: 0.4, dy: 0.92, strike: 220, tint: "150, 200, 245" },
          { x: w * 0.9, y: h * 0.06, dx: -0.4, dy: 0.92, strike: 470, tint: "150, 200, 245" },
        );
      }
      // top-centre ambient fill
      sources.push({ x: w * 0.5, y: -0.12 * h, dx: 0, dy: 1, strike: 120, tint: "108, 171, 221", fill: true });
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ls = dpr * LSCALE;
      lr.width = Math.max(1, Math.floor(w * ls));
      lr.height = Math.max(1, Math.floor(h * ls));
      const count = Math.max(50, Math.min(150, Math.round(w / 11)));
      motes = Array.from({ length: count }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(0.5, 2.4),
        vx: rand(-0.06, 0.06), vy: rand(-0.34, -0.08), a: rand(0.05, 0.55),
      }));
      computeSources();
    };

    // Per-rig ignition: a hard strike, a couple of buzz dips, an overshoot, settle.
    const strikeEnv = (t: number, strike: number) => {
      const dt = t - strike;
      if (dt < 0) return 0;
      if (dt < 60) return (dt / 60) * 0.9;
      if (dt < 110) return 0.9 - ((dt - 60) / 50) * 0.7;
      if (dt < 185) return 0.2 + ((dt - 110) / 75) * 1.05;
      if (dt < 280) return 1.25 - ((dt - 185) / 95) * 0.25;
      return 1;
    };

    const drawLight = (t: number, breathe: number) => {
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lr.width, lr.height);
      lctx.globalCompositeOperation = "lighter";
      lctx.filter = `blur(${Math.max(2, 2.6 * ls)}px)`;

      const half = Math.min(w * 0.17, 360) * ls;
      for (const L of sources) {
        const env = (reduce ? 1 : strikeEnv(t, L.strike)) * breathe;
        if (env <= 0.001) continue;
        const lx = L.x * ls, ly = L.y * ls;
        const len = 1.5 * h * ls;
        const ex = lx + L.dx * len, ey = ly + L.dy * len;
        const px = -L.dy, py = L.dx;

        const cone = (halfW: number, a0: number, a1: number) => {
          const g = lctx.createLinearGradient(lx, ly, ex, ey);
          g.addColorStop(0, `rgba(${L.tint}, ${a0 * env})`);
          g.addColorStop(0.5, `rgba(${L.tint}, ${a1 * env})`);
          g.addColorStop(1, `rgba(${L.tint}, 0)`);
          lctx.fillStyle = g;
          lctx.beginPath();
          lctx.moveTo(lx + px * halfW * 0.16, ly + py * halfW * 0.16);
          lctx.lineTo(ex + px * halfW, ey + py * halfW);
          lctx.lineTo(ex - px * halfW, ey - py * halfW);
          lctx.lineTo(lx - px * halfW * 0.16, ly - py * halfW * 0.16);
          lctx.closePath();
          lctx.fill();
        };
        if (L.fill) {
          cone(half * 1.5, 0.14, 0.06);
        } else {
          cone(half, 0.5, 0.2);          // soft outer halo
          cone(half * 0.5, 1.0, 0.42);   // hot inner shaft
        }

        // bloom + (rigs only) lens streaks
        const br = (0.21 * Math.min(w, h)) * ls;
        const bg = lctx.createRadialGradient(lx, ly, 0, lx, ly, br);
        bg.addColorStop(0, `rgba(240, 247, 255, ${(L.fill ? 0.34 : 1.0) * env})`);
        bg.addColorStop(0.36, `rgba(${L.tint}, ${0.4 * env})`);
        bg.addColorStop(1, `rgba(${L.tint}, 0)`);
        lctx.fillStyle = bg;
        lctx.beginPath();
        lctx.arc(lx, ly, br, 0, Math.PI * 2);
        lctx.fill();

        if (!L.fill && env > 0.55) {
          const s = (env - 0.55) / 0.45;
          const streak = (wdt: number, hgt: number) => {
            const sg = lctx.createLinearGradient(lx - wdt, ly, lx + wdt, ly);
            sg.addColorStop(0, "rgba(210,232,255,0)");
            sg.addColorStop(0.5, `rgba(220, 238, 255, ${0.32 * s})`);
            sg.addColorStop(1, "rgba(210,232,255,0)");
            lctx.fillStyle = sg;
            lctx.fillRect(lx - wdt, ly - hgt / 2, wdt * 2, hgt);
          };
          streak(br * 1.7, Math.max(1.4 * ls, 2));        // horizontal flare
          lctx.save();
          lctx.translate(lx, ly); lctx.rotate(Math.PI / 2);
          lctx.translate(-lx, -ly);
          streak(br * 1.1, Math.max(1.4 * ls, 2));        // vertical flare
          lctx.restore();
        }
      }
      lctx.filter = "none";
    };

    const beamBoost = (mx: number, my: number) => {
      let b = 0;
      for (const L of sources) {
        if (L.fill) continue;
        const len = 1.5 * h;
        const vx = L.dx * len, vy = L.dy * len;
        const wx = mx - L.x, wy = my - L.y;
        const tproj = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
        const cxp = L.x + vx * tproj, cyp = L.y + vy * tproj;
        const d = Math.hypot(mx - cxp, my - cyp);
        const halfPx = Math.min(w * 0.17, 360) * (0.35 + tproj);
        if (d < halfPx) b += (1 - d / halfPx) * 0.9;
      }
      return Math.min(1, b);
    };

    const composite = (t: number) => {
      const ignite = reduce ? 1 : Math.min(1, t / 1500);
      const breathe = reduce ? 1 : 1 + Math.sin(t / 1400) * 0.05 * ignite;
      drawLight(t, breathe);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(lr, 0, 0, lr.width, lr.height, 0, 0, w, h);

      // camera-flash pop as the rigs reach full burn
      if (!reduce) {
        const flash = Math.max(0, 1 - Math.abs(t - 1350) / 320);
        if (flash > 0) {
          ctx.fillStyle = `rgba(224, 238, 255, ${0.16 * flash})`;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // dust in the beams
      for (const m of motes) {
        const lit = 0.22 + beamBoost(m.x, m.y);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(216, 233, 252, ${Math.min(0.95, m.a * lit) * ignite})`;
        ctx.fill();
        if (!reduce) {
          m.x += m.vx; m.y += m.vy;
          if (m.y < -12) { m.y = h + 12; m.x = rand(0, w); }
          if (m.x < -12) m.x = w + 12; else if (m.x > w + 12) m.x = -12;
        }
      }
      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    requestAnimationFrame(() => { resize(); }); // re-sync once layout/fonts settle

    if (reduce) {
      composite(9999);
      const onResize = () => { resize(); composite(9999); };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const frame = (now: number) => {
      if (!start) start = now;
      composite(now - start);
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); }
        else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
      }
    }, { threshold: 0 });
    io.observe(canvas);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={`lg-lights ${className ?? ""}`} aria-hidden="true" />;
};
