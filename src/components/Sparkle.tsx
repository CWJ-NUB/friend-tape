import { useEffect } from "react";

const COLORS = ["#b9c7ab", "#d9d3bd", "#a9c4b2", "#e0d9c5", "#c2cbb4", "#e6e0cf"];

/** 点击玻璃珠彩蛋:全站点击处迸出柔彩玻璃小珠 */
export default function Sparkle() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, textarea, select, label, .no-spark")) return;
      const n = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const orb = document.createElement("span");
        orb.className = "orb";
        const size = 6 + Math.random() * 9;
        const c = COLORS[Math.floor(Math.random() * COLORS.length)];
        orb.style.width = `${size}px`;
        orb.style.height = `${size}px`;
        orb.style.left = `${e.clientX}px`;
        orb.style.top = `${e.clientY}px`;
        orb.style.setProperty("--c", c);
        orb.style.setProperty("--dx", `${(Math.random() - 0.5) * 170}px`);
        orb.style.setProperty("--dy", `${-40 + Math.random() * 180}px`);
        document.body.appendChild(orb);
        setTimeout(() => orb.remove(), 1250);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return null;
}
