import { useEffect, useState } from "react";
import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";
import { EAdd, EDate, EDel, EText, ETextarea, euid } from "../components/Editable";
import type { Content, LetterContent, Profile } from "../content/types";

/** 按「寄件人」匹配名片:名字或昵称对上 → 返回头像,信封封蜡直接用 */
function findAvatar(content: Content, name: string): Profile | null {
  const n = (name || "").trim();
  if (!n) return null;
  const eq = (a: string) => (a || "").trim() === n;
  const hit = [content.me, content.friend].find((p) => eq(p.name) || eq(p.nickname));
  return hit?.avatar ? hit : null;
}

/**
 * 信件墙:两人各写各的,一人一封。
 * 点击信封卡 → 玻璃信封弹层自动播放拆信动画(封蜡弹开 → 封口翻起 → 信纸升起)
 * → 玻璃信卡浮现正文。
 * 编辑模式:卡片上的收发件人/标题/日期可直接改,点开信卡可改正文。
 * 寄件人在「我们」页上传过头像的,封蜡显示头像而非首字。
 */
export default function Letter() {
  const { content, update, editing } = useContent();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOn, setSheetOn] = useState(false);

  const active = content?.letters.find((l) => l.id === activeId) ?? null;

  // 拆开:动画时序与 letter.css 对齐(封蜡 0.4s 弹开 / 封口 0.35s 翻起 /
  // 信封 1.05s 淡出)→ 1.2s 后信卡浮现;编辑模式下跳过动画直接显示
  useEffect(() => {
    if (!active) return;
    setSheetOn(editing);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => setSheetOn(true), editing ? 0 : 1200);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [active, editing]);

  // ESC 关闭
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActiveId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!content) return null;

  const setLetters = (ls: LetterContent[]) => update((c) => ({ ...c, letters: ls }));
  const patchLetter = (id: string, p: Partial<LetterContent>) =>
    setLetters(content.letters.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const delLetter = (id: string) => {
    if (activeId === id) setActiveId(null);
    setLetters(content.letters.filter((l) => l.id !== id));
  };
  const addLetter = () =>
    setLetters([
      ...content.letters,
      {
        id: euid(),
        title: "新的一封信",
        content: "亲爱的…",
        from: "我",
        to: "你",
        date: new Date().toISOString().slice(0, 10),
      },
    ]);

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 03 · LETTERS</div>
      <h2 className="page-title">信件墙</h2>
      <p className="page-sub">
        有些话当面说不出口,就写成信。这里一人一封——你写给他,他写给你,谁也不许赖账。
      </p>

      {content.letters.length === 0 ? (
        <div className="lw-empty glass">
          信墙还空着。点右下角「✎」开启编辑,写下第一封信吧。
        </div>
      ) : (
        <div className="lw-grid">
          {content.letters.map((l, i) => (
            <Reveal key={l.id} delay={i * 120}>
              <div
                className={`lcard glass glass-hover no-spark ${editing ? "edel-host" : ""}`}
                onClick={() => setActiveId(l.id)}
              >
                <div className="lcard-top">
                  <div className="lcard-seal" title={l.from}>
                    {findAvatar(content, l.from) ? (
                      <img src={findAvatar(content, l.from)!.avatar} alt={l.from} />
                    ) : (
                      (l.from || "信").trim().charAt(0)
                    )}
                  </div>
                  <div className="lcard-route">
                    FROM <b><EText value={l.from} onChange={(v) => patchLetter(l.id, { from: v })} placeholder="寄件人" /></b>
                    <br />
                    TO <b><EText value={l.to} onChange={(v) => patchLetter(l.id, { to: v })} placeholder="收件人" /></b>
                  </div>
                </div>
                <div className="lcard-title">
                  <EText value={l.title} onChange={(v) => patchLetter(l.id, { title: v })} placeholder="信的标题" />
                </div>
                <div className="lcard-date">
                  <EDate value={l.date} onChange={(v) => patchLetter(l.id, { date: v })} />
                </div>
                <div className="lcard-hint">TAP TO UNSEAL · 拆信</div>
                <EDel onClick={() => delLetter(l.id)} title="删除这封信" />
              </div>
            </Reveal>
          ))}
          <EAdd label="＋ 写一封新信" onClick={addLetter} />
        </div>
      )}

      {/* 拆信弹层:阅读模式自动播放动画,编辑模式直接进信卡 */}
      {active && (
        <div className="lmodal no-spark" onClick={() => setActiveId(null)}>
          <div className="lmodal-stage" onClick={(e) => e.stopPropagation()}>
            {/* 玻璃信封(只播一轮;编辑模式下跳过) */}
            {!editing && (
              <div className="envm" key={active.id}>
                <div className="envm-body" />
                <div className="envm-mini">
                  <span>FOR {(active.to || "YOU").toUpperCase()}</span>
                  <span>✉</span>
                </div>
                <div className="envm-flap" />
                <div className="envm-seal">
                  {findAvatar(content, active.from) ? (
                    <img src={findAvatar(content, active.from)!.avatar} alt={active.from} />
                  ) : (
                    (active.from || "信").trim().charAt(0)
                  )}
                </div>
              </div>
            )}

            {/* 信卡 */}
            <article className={`lsheet glass ${sheetOn ? "on" : ""}`}>
              <div className="ls-route">
                FROM <EText value={active.from} onChange={(v) => patchLetter(active.id, { from: v })} placeholder="寄件人" />
                {" → "}
                TO <EText value={active.to} onChange={(v) => patchLetter(active.id, { to: v })} placeholder="收件人" />
                {" · "}
                <EDate value={active.date} onChange={(v) => patchLetter(active.id, { date: v })} />
              </div>
              <h3>
                <EText value={active.title} onChange={(v) => patchLetter(active.id, { title: v })} placeholder="信的标题" />
              </h3>
              <div className="ls-body">
                <ETextarea
                  value={active.content}
                  onChange={(v) => patchLetter(active.id, { content: v })}
                  placeholder="信的正文…"
                  minHeight={180}
                />
              </div>
              <div className="ls-sign">
                —— <EText value={active.from} onChange={(v) => patchLetter(active.id, { from: v })} placeholder="署名" />
                <small>EVER YOURS, FRAME BY FRAME</small>
              </div>
              <button className="ls-close" onClick={() => setActiveId(null)}>
                ✕ 收 起 这 封 信
              </button>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
