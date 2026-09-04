import { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/profile", label: "我们" },
  { to: "/story", label: "时间线" },
  { to: "/gallery", label: "相册" },
  { to: "/letter", label: "信件墙" },
  { to: "/quotes", label: "那些话" },
  { to: "/wishes", label: "未来之约" },
  { to: "/guestbook", label: "留言板" },
];

/** 桌面悬浮胶囊 + 移动端底部 Dock(更多 → 玻璃抽屉) */
export default function Navbar() {
  const [sheet, setSheet] = useState(false);
  const loc = useLocation();

  return (
    <>
      {/* 桌面胶囊 */}
      <nav className="nav-pill glass no-spark">
        <Link to="/" className="nav-brand">
          <span className="nav-brand-dot" />
          <span>
            <b>OUR TAPE</b>
            <span>我们的胶片</span>
          </span>
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
            编辑
          </NavLink>
        </div>
      </nav>

      {/* 移动端品牌胶囊 */}
      <Link to="/" className="nav-chip glass no-spark">
        <span className="nav-brand-dot" />
        <b>OUR TAPE</b>
      </Link>

      {/* 移动端 Dock */}
      <nav className="nav-dock glass no-spark">
        <div className="nav-dock-inner">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            首页
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? "active" : "")}>
            我们
          </NavLink>
          <NavLink to="/story" className={({ isActive }) => (isActive ? "active" : "")}>
            时间线
          </NavLink>
          <NavLink to="/gallery" className={({ isActive }) => (isActive ? "active" : "")}>
            相册
          </NavLink>
          <NavLink to="/letter" className={({ isActive }) => (isActive ? "active" : "")}>
            信件
          </NavLink>
          <button onClick={() => setSheet(true)} aria-label="更多">
            更多 ⋯
          </button>
        </div>
      </nav>

      {/* 更多面板 */}
      {sheet && (
        <div className="nav-sheet no-spark" onClick={() => setSheet(false)}>
          <div className="nav-sheet-panel glass" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">MORE · 更多板块</div>
            {LINKS.slice(4).map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setSheet(false)}>
                {l.label}
                <span className="mono">{loc.pathname === l.to ? "● 当前" : "→"}</span>
              </Link>
            ))}
            <Link to="/admin" onClick={() => setSheet(false)}>
              编辑中心
              <span className="mono">⚙</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
