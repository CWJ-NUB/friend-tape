import { useState } from "react";
import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";
import { EDate, EImage, EText, ETextarea } from "../components/Editable";
import type { Profile } from "../content/types";

/** 名片:头像可上传,所有字段行内可改 */
function ProfileCard({
  p, side, delay, edit,
}: {
  p: Profile;
  side: "A" | "B";
  delay: number;
  edit: (fn: (p: Profile) => Profile) => void;
}) {
  const { editing } = useContent();
  const [tagDraft, setTagDraft] = useState("");
  const set = (patch: Partial<Profile>) => edit((x) => ({ ...x, ...patch }));
  const addTag = () => {
    const t = tagDraft.trim();
    if (!t || p.tags.includes(t)) return;
    set({ tags: [...p.tags, t] });
    setTagDraft("");
  };

  return (
    <Reveal delay={delay}>
      <div className="pcard glass">
        <div className="pcard-side mono">SIDE {side}</div>

        <div className="pcard-avatar-wrap">
          <EImage src={p.avatar} alt={p.name} onChange={(url) => set({ avatar: url })} imgClassName="pcard-avatar" />
          {!p.avatar && !editing && (
            <div className="pcard-avatar pcard-avatar-empty mono">{(p.nickname || p.name || "?").charAt(0)}</div>
          )}
        </div>

        <div className="pcard-name">
          <EText value={p.nickname || p.name} onChange={(v) => set({ nickname: v })} placeholder="昵称" />
        </div>
        <div className="pcard-realname mono">
          <EText value={p.name} onChange={(v) => set({ name: v })} placeholder="真名" fallback=" " />
        </div>

        <div className="pcard-role">
          <EText value={p.role} onChange={(v) => set({ role: v })} placeholder="身份说明(如:写信的人)" />
        </div>

        <div className="pcard-sign">
          「 <EText value={p.signature} onChange={(v) => set({ signature: v })} placeholder="一句话签名" fallback="还没写下签名" /> 」
        </div>

        <div className="pcard-meta">
          <span className="mono">BIRTH</span>
          <EDate value={p.birthday} onChange={(v) => set({ birthday: v })} />
        </div>

        {p.tags.length > 0 || editing ? (
          <div className="pcard-tags">
            {p.tags.map((t) => (
              <span key={t} className="ptag no-spark">
                {t}
                {editing && (
                  <button title="删除标签" onClick={() => set({ tags: p.tags.filter((x) => x !== t) })}>✕</button>
                )}
              </span>
            ))}
            {editing && (
              <input
                className="ptag-input"
                value={tagDraft}
                placeholder="＋ 标签"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
              />
            )}
          </div>
        ) : null}

        <div className="pcard-about">
          <div className="pcard-about-label mono">ABOUT ME</div>
          <ETextarea
            value={p.about}
            onChange={(v) => set({ about: v })}
            placeholder="自我介绍:喜欢什么、讨厌什么、是个怎样的人…"
            minHeight={72}
            className="pcard-about-text"
          />
        </div>
      </div>
    </Reveal>
  );
}

/** 个人主页:两个人的名片,信件头像等信息都从这里调用 */
export default function ProfilePage() {
  const { content, update } = useContent();
  if (!content) return null;

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 00 · US</div>
      <h2 className="page-title">我们</h2>
      <p className="page-sub">
        两张名片,一份档案。头像和名字会自动用在信件墙上——所以记得上传一张好看的照片。
      </p>

      <div className="profile-page-grid">
        <ProfileCard
          p={content.me}
          side="A"
          delay={0}
          edit={(fn) => update((c) => ({ ...c, me: fn(c.me) }))}
        />
        <div className="profile-page-x mono">&amp;</div>
        <ProfileCard
          p={content.friend}
          side="B"
          delay={140}
          edit={(fn) => update((c) => ({ ...c, friend: fn(c.friend) }))}
        />
      </div>
    </div>
  );
}
