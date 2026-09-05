import { useEffect } from "react";

/**
 * 液态玻璃引擎(Liquid Glass Engine)
 * 真正的液态玻璃 ≠ 毛玻璃模糊,核心是三层光学合成:
 * 1. 边缘折射:Canvas 生成径向透镜位移贴图(R/G 通道编码折射方向),
 *    经 SVG feDisplacementMap 让玻璃边缘真实弯折背后的内容(透镜感)
 * 2. 色散:R/B 通道反向微偏移,边缘出现细微彩虹色散(真玻璃的色散现象)
 * 3. 有机液感:feTurbulence 微扰,折射面如液体般微微流动
 * 配合 CSS 侧的镜面亮边(.glass::before)与惯性光斑(本组件注入 --mx/--my)。
 * Safari/Firefox 不支持 backdrop-filter 引用 SVG 滤镜,自动降级为毛玻璃。
 */

/** 透镜位移贴图:中心中性灰(128=不位移),边缘朝圆心方向采样 → 放大镜式折射 */
function makeLensMap(size = 256): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const inner = 0.72; // 折射起始圈(Chebyshev 距离,适配矩形面板)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const cheb = Math.max(Math.abs(nx), Math.abs(ny));
      let s = 0;
      if (cheb > inner) s = Math.pow((cheb - inner) / (1 - inner), 1.6);
      const len = Math.hypot(nx, ny) || 1;
      const dx = (-nx / len) * s; // 指向圆心 → 边缘呈现折射压缩
      const dy = (-ny / len) * s;
      const i = (y * size + x) * 4;
      d[i] = Math.max(0, Math.min(255, Math.round(128 + dx * 120)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 120)));
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export default function LiquidGlass() {
  useEffect(() => {
    /* ---- 折射支持检测:只有真正能解析 backdrop-filter 引用 SVG 滤镜的浏览器才开启。
       用精确的 supports 探测(而非仅 UA 猜测):老 Chromium 不支持 url() 时自动降级;
       Safari/Firefox 的实现与 feImage 组合不可靠,继续排除 ---- */
    let refract = false;
    try {
      const ua = navigator.userAgent;
      const safari = /safari/i.test(ua) && !/chrome|chromium|edg|android/i.test(ua);
      const firefox = /firefox/i.test(ua);
      refract =
        !safari &&
        !firefox &&
        typeof CSS !== "undefined" &&
        CSS.supports("backdrop-filter", "blur(1px) url(#lg-probe)");
    } catch {
      /* ignore */
    }

    let svg: SVGSVGElement | null = null;
    if (refract) {
      const map = makeLensMap();
      if (map) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("aria-hidden", "true");
        svg.style.cssText = "position:fixed;width:0;height:0;pointer-events:none;";
        svg.innerHTML = `<filter id="lg-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feImage href="${map}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lens"/>
          <feDisplacementMap in="SourceGraphic" in2="lens" scale="80" xChannelSelector="R" yChannelSelector="G" result="refr"/>
          <feColorMatrix in="refr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chR"/>
          <feOffset in="chR" dx="1.5" dy="0" result="chRo"/>
          <feColorMatrix in="refr" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chG"/>
          <feColorMatrix in="refr" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="chB"/>
          <feOffset in="chB" dx="-1.5" dy="0" result="chBo"/>
          <feBlend in="chRo" in2="chG" mode="screen" result="rg"/>
          <feBlend in="rg" in2="chBo" mode="screen" result="chroma"/>
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="turb"/>
          <feDisplacementMap in="chroma" in2="turb" scale="4" xChannelSelector="R" yChannelSelector="G"/>
        </filter>`;
        document.body.appendChild(svg);
        document.body.classList.add("lg-refract");
      }
    }

    /* ---- 鼠标跟随镜面高光(带惯性插值,光斑如液体拖尾流动) ---- */
    let cur: HTMLElement | null = null;
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".glass") as HTMLElement | null;
      if (!el) {
        cur = null;
        return;
      }
      const r = el.getBoundingClientRect();
      if (el !== cur) {
        // 换面板:直接吸附,避免光斑跨面板飞行
        cur = el;
        cx = tx = e.clientX - r.left;
        cy = ty = e.clientY - r.top;
        el.style.setProperty("--mx", `${cx}px`);
        el.style.setProperty("--my", `${cy}px`);
        return;
      }
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      raf = 0;
      if (!cur) return;
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      cur.style.setProperty("--mx", `${cx}px`);
      cur.style.setProperty("--my", `${cy}px`);
      if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      svg?.remove();
      document.body.classList.remove("lg-refract");
    };
  }, []);

  return null;
}
