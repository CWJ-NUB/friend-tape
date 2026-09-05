import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useContent } from "../content/ContentContext";

const LINKS = [
  { to: "/profile", label: "关于我" },
  { to: "/story", label: "时间线" },
  { to: "/gallery", label: "相册" },
  { to: "/letter", label: "信件墙" },
  { to: "/quotes", label: "那些话" },
  { to: "/wishes", label: "未来之约" },
  { to: "/guestbook", label: "留言板" },
];

/** Dock 上常驻的四个入口(其余进「更多」) */
const DOCK_LINKS = [
  { to: "/", label: "首页", end: true },
  { to: "/profile", label: "关于我", end: false },
  { to: "/story", label: "时间线", end: false },
  { to: "/gallery", label: "相册", end: false },
];

/** 滑动切页的顺序(与叙事顺序一致) */
const SWIPE_ORDER = ["/", "/profile", "/story", "/gallery", "/letter", "/quotes", "/wishes", "/guestbook"];

/** 桌面悬浮胶囊 + 移动端液态玻璃 Dock(弹簧滑块 + 拖拽/滑动切页 + 更多抽屉) */
export default function Navbar() {
  const [sheet, setSheet] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const { unlocked, openGate } = useContent();

  /* ---------- 弹簧滑块 ---------- */
  const innerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const firstMeasure = useRef(true);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  /** 拖拽中的水平偏移(null=不在拖拽):ref 同步可读,state 驱动渲染 */
  const [dragDx, setDragDx] = useState<number | null>(null);
  const dragDxRef = useRef<number | null>(null);
  const dragStartX = useRef(0);

  const measure = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const active = inner.querySelector<HTMLElement>(".nav-dock-item.active");
    if (!active) {
      setPill(null);
      return;
    }
    setPill({ left: active.offsetLeft, width: active.offsetWidth });
  }, []);

  // 路由变化/尺寸变化时测量滑块位置;首次测量不做动画
  useLayoutEffect(() => {
    measure();
    const el = pillRef.current;
    if (el && firstMeasure.current) {
      el.style.transition = "none";
      requestAnimationFrame(() => requestAnimationFrame(() => (el.style.transition = "")));
      firstMeasure.current = false;
    }
  }, [loc.pathname, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  /* ---------- 拖拽滑块切页(按住 Dock 左右拖,松手吸附最近页) ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("button")) return; // 「更多」按钮不参与拖拽
    dragStartX.current = e.clientX;
    dragDxRef.current = 0;
    setDragDx(0);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有真实 pointerId,忽略 */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragDxRef.current === null || !pill || !innerRef.current) return;
    const innerW = innerRef.current.offsetWidth;
    const dx = e.clientX - dragStartX.current;
    // 夹在 Dock 范围内
    const clamped = Math.max(-pill.left, Math.min(innerW - pill.left - pill.width, dx));
    dragDxRef.current = clamped;
    setDragDx(clamped);
  };

  const onPointerUp = () => {
    const dx = dragDxRef.current;
    dragDxRef.current = null;
    if (dx === null || !pill || !innerRef.current) {
      setDragDx(null);
      return;
    }
    const inner = innerRef.current;
    const pillCenter = pill.left + dx + pill.width / 2;
    const items = Array.from(inner.querySelectorAll<HTMLElement>(".nav-dock-item"));
    let best = -1;
    let bestDist = Infinity;
    items.forEach((el, i) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - pillCenter);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    const target = DOCK_LINKS[best];
    if (target && loc.pathname !== target.to) nav(target.to);
    setDragDx(null);
  };

  /* ---------- 页面左右滑动切页(内容区手势) ---------- */
  useEffect(() => {
    let sx = 0;
    let sy = 0;
    let st = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      // Dock 自带拖拽;滑动条/编辑器等交互控件不拦截
      const el = e.target;
      if (el instanceof Element && el.closest(".nav-dock, input, textarea, [contenteditable], .mp-row")) return;
      const touch = e.touches[0];
      sx = touch.clientX;
      sy = touch.clientY;
      st = Date.now();
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - sx;
      const dy = touch.clientY - sy;
      const dt = Date.now() - st;
      // 快速横向轻扫:水平位移够大、垂直位移不大、时间短
      if (dt > 700 || Math.abs(dx) < 72 || Math.abs(dy) > Math.abs(dx) * 0.9) return;
      const idx = SWIPE_ORDER.indexOf(loc.pathname);
      if (idx === -1) return;
      const next = dx < 0 ? idx + 1 : idx - 1;
      if (next < 0 || next >= SWIPE_ORDER.length) return;
      nav(SWIPE_ORDER[next]);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [loc.pathname, nav]);

  /** 编辑中心入口:未通过口令验证先弹验证,通过后自动跳转 */
  const goAdmin = () => {
    if (unlocked) nav("/admin");
    else openGate(() => nav("/admin"));
  };

  return (
    <>
      {/* 桌面胶囊 */}
      <nav className="nav-pill glass no-spark">
        <Link to="/" className="nav-brand">
          <span className="nav-brand-dot" />
          <span>
            <b>MY SPACE</b>
            <span>个人空间</span>
          </span>
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
          <button className="nav-edit-btn" onClick={goAdmin}>
            编辑
          </button>
        </div>
      </nav>

      {/* 移动端品牌胶囊 */}
      <Link to="/" className="nav-chip glass no-spark">
        <span className="nav-brand-dot" />
        <b>MY SPACE</b>
      </Link>

      {/* 移动端:液态玻璃 Dock(弹簧滑块 + 可拖拽) */}
      <nav
        className={`nav-dock glass no-spark ${dragDx !== null ? "dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="nav-dock-inner" ref={innerRef}>
          {pill && (
            <span
              ref={pillRef}
              className="nav-dock-pill"
              style={{ left: pill.left + (dragDx ?? 0), width: pill.width }}
            />
          )}
          {DOCK_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-dock-item ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
          <button className="nav-dock-more" onClick={() => setSheet(true)} aria-label="更多">
            更多 ⋯
          </button>
        </div>
      </nav>

      {/* 更多面板 */}
      {sheet && (
        <div className="nav-sheet no-spark" onClick={() => setSheet(false)}>
          <div className="nav-sheet-panel glass" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">MORE · 更多板块</div>
            {LINKS.slice(3).map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setSheet(false)}>
                {l.label}
                <span className="mono">{loc.pathname === l.to ? "● 当前" : "→"}</span>
              </Link>
            ))}
            <button
              className="nav-sheet-edit"
              onClick={() => {
                setSheet(false);
                goAdmin();
              }}
            >
              编辑中心
              <span className="mono">⚙</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
