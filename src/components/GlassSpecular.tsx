import { useEffect } from "react";

/**
 * 玻璃跟随光斑彩蛋:
 * 监听全局 pointermove,把鼠标位置写入最近 .glass 面板的 --mx/--my,
 * 由 global.css 的 .glass::after 渲染液态高光
 */
export default function GlassSpecular() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const el = target.closest?.(".glass") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return null;
}
