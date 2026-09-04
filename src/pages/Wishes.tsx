import { useEffect, useState } from "react";
import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";

/** 未来之约:勾选状态保存在当前浏览器;要永久保存,请在编辑中心修改 */
export default function Wishes() {
  const { content } = useContent();
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setLocalDone(JSON.parse(localStorage.getItem("ft-wishes") || "{}"));
    } catch { /* ignore */ }
  }, []);

  const toggle = (id: string) => {
    setLocalDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("ft-wishes", JSON.stringify(next));
      return next;
    });
  };

  if (!content) return null;
  const doneCount = content.wishes.filter((w) => w.done || localDone[w.id]).length;

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 05 · TO BE CONTINUED</div>
      <h2 className="page-title">未来之约</h2>
      <p className="page-sub">
        这卷胶片还没有拍完。下面这些事,我们说好了要一起做——
      </p>

      <div className="wishes-note">
        PROGRESS {doneCount} / {content.wishes.length} · 勾选保存在当前浏览器,想永久记录请到编辑中心
      </div>

      <div>
        {content.wishes.map((w, i) => {
          const done = w.done || localDone[w.id];
          return (
            <Reveal key={w.id} delay={i * 100}>
              <div className={`wish-item glass no-spark ${done ? "done" : ""}`} onClick={() => toggle(w.id)}>
                <div className="wish-check">{done ? "✓" : ""}</div>
                <div className="wish-text">{w.text}</div>
                {done && <div className="wish-stamp">已 兑 现</div>}
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
