import { useEffect, useState } from "react";
import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";
import { EAdd, EDel, EText, euid } from "../components/Editable";
import type { Wish } from "../content/types";

/** 未来之约:勾选状态保存在当前浏览器;要永久保存,请到编辑中心修改 */
export default function Wishes() {
  const { content, update, editing } = useContent();
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setLocalDone(JSON.parse(localStorage.getItem("ft-wishes") || "{}"));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (id: string) => {
    setLocalDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("ft-wishes", JSON.stringify(next));
      return next;
    });
  };

  if (!content) return null;

  const setWishes = (ws: Wish[]) => update((c) => ({ ...c, wishes: ws }));
  const delWish = (id: string) => setWishes(content.wishes.filter((w) => w.id !== id));
  const addWish = () => setWishes([...content.wishes, { id: euid(), text: "说好要一起做的事…", done: false }]);

  const doneCount = content.wishes.filter((w) => w.done || localDone[w.id]).length;

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 05 · TO BE CONTINUED</div>
      <h2 className="page-title">未来之约</h2>
      <p className="page-sub">
        这卷胶片还没有拍完。下面这些事,说好了要去做——
      </p>

      <div className="wishes-note">
        PROGRESS {doneCount} / {content.wishes.length} · 勾选保存在当前浏览器,想永久记录请在编辑模式下勾选
      </div>

      <div>
        {content.wishes.map((w, i) => {
          const done = w.done || localDone[w.id];
          return (
            <Reveal key={w.id} delay={i * 100}>
              <div
                className={`wish-item glass no-spark ${done ? "done" : ""} ${editing ? "edel-host" : ""}`}
                onClick={() => toggle(w.id)}
              >
                <div className="wish-check">{done ? "✓" : ""}</div>
                <div className="wish-text">
                  <EText value={w.text} onChange={(v) => setWishes(content.wishes.map((x) => (x.id === w.id ? { ...x, text: v } : x)))} placeholder="约定内容" />
                </div>
                {done && <div className="wish-stamp">已 兑 现</div>}
                <EDel onClick={() => delWish(w.id)} title="删除这个约定" />
              </div>
            </Reveal>
          );
        })}
        <EAdd label="＋ 许一个新约定" onClick={addWish} />
      </div>
    </div>
  );
}
