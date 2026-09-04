import { useEffect, useState } from "react";
import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";
import type { LetterContent } from "../content/types";

/**
 * 信件墙:两人各写各的,一人一封。
 * 点击信封卡 → 玻璃信封弹层自动播放拆信动画(封蜡弹开 → 封口翻起 → 信纸升起)
 * → 玻璃信卡浮现正文。
 */
export default function Letter() {
  const { content } = useContent();
  const [active, setActive] = useState<LetterContent | null>(null);
  const [sheetOn, setSheetOn] = useState(false);

  // 拆开:动画时序与 letter.css 对齐(封蜡 0.4s 弹开 / 封口 0.35s 翻起 /
  // 信封 1.05s 淡出)→ 1.2s 后信卡浮现
  useEffect(() => {
    if (!active) return;
    setSheetOn(false);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => setSheetOn(true), 1200);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [active]);

  // ESC 关闭
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!content) return null;
  const letters = content.letters;

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 03 · LETTERS</div>
      <h2 className="page-title">信件墙</h2>
      <p className="page-sub">
        有些话当面说不出口,就写成信。这里一人一封——你写给他,他写给你,谁也不许赖账。
      </p>

      {letters.length === 0 ? (
        <div className="lw-empty glass">
          信墙还空着。打开「编辑中心 → 信件墙」,写下第一封信吧。
        </div>
      ) : (
        <div className="lw-grid">
          {letters.map((l, i) => (
            <Reveal key={l.id} delay={i * 120}>
              <div className="lcard glass glass-hover no-spark" onClick={() => setActive(l)}>
                <div className="lcard-top">
                  <div className="lcard-seal">{(l.from || "信").trim().charAt(0)}</div>
                  <div className="lcard-route">
                    FROM <b>{l.from || "—"}</b>
                    <br />
                    TO <b>{l.to || "—"}</b>
                  </div>
                </div>
                <div className="lcard-title">{l.title}</div>
                <div className="lcard-date">{l.date || "未注明日期"}</div>
                <div className="lcard-hint">TAP TO UNSEAL · 拆信</div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* 拆信弹层:动画自动播放 */}
      {active && (
        <div className="lmodal no-spark" onClick={() => setActive(null)}>
          <div className="lmodal-stage" onClick={(e) => e.stopPropagation()}>
            {/* 玻璃信封(只播一轮) */}
            <div className="envm" key={active.id}>
              <div className="envm-body" />
              <div className="envm-mini">
                <span>FOR {active.to.toUpperCase()}</span>
                <span>✉</span>
              </div>
              <div className="envm-flap" />
              <div className="envm-seal">{(active.from || "信").trim().charAt(0)}</div>
            </div>

            {/* 信卡 */}
            <article className={`lsheet glass ${sheetOn ? "on" : ""}`}>
              <div className="ls-route">
                FROM {active.from} → TO {active.to} {active.date && `· ${active.date}`}
              </div>
              <h3>{active.title}</h3>
              <div className="ls-body">{active.content}</div>
              <div className="ls-sign">
                —— {active.from}
                <small>EVER YOURS, FRAME BY FRAME</small>
              </div>
              <button className="ls-close" onClick={() => setActive(null)}>
                ✕ 收 起 这 封 信
              </button>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
