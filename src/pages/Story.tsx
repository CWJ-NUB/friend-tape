import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";
import { EAdd, EDate, EDel, EImage, EText, ETextarea, euid } from "../components/Editable";
import type { Profile, TimelineEvent } from "../content/types";

export default function Story() {
  const { content, update, editing } = useContent();
  if (!content) return null;

  const setProfile = (who: "me" | "friend", p: Partial<Profile>) =>
    update((c) => ({ ...c, [who]: { ...c[who], ...p } }) as typeof c);

  const setEvents = (tl: TimelineEvent[]) => update((c) => ({ ...c, timeline: tl }));
  const patchEvent = (id: string, p: Partial<TimelineEvent>) =>
    setEvents(content.timeline.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const delEvent = (id: string) => setEvents(content.timeline.filter((e) => e.id !== id));
  const addEvent = () =>
    setEvents([
      ...content.timeline,
      {
        id: euid(),
        date: new Date().toISOString().slice(0, 10),
        title: "新的时刻",
        content: "写下那天发生了什么…",
        photo: "",
      },
    ]);

  const events = [...content.timeline].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 01 · OUR STORY</div>
      <h2 className="page-title">时间线</h2>
      <p className="page-sub">一卷胶片,从初识那一格开始。每一帧,都是我们一起拍下的画面。</p>

      <div className="profiles">
        <Reveal className="profile-card glass glass-hover">
          <EImage
            imgClassName="profile-avatar"
            src={content.me.avatar}
            alt={content.me.name}
            onChange={(url) => setProfile("me", { avatar: url })}
          />
          <div className="profile-info">
            <b>
              <EText value={content.me.name} onChange={(v) => setProfile("me", { name: v })} placeholder="名字" />
            </b>
            <span className="role">
              <EText value={content.me.role} onChange={(v) => setProfile("me", { role: v })} placeholder="角色" />
            </span>
            <p>
              <EText value={content.me.signature} onChange={(v) => setProfile("me", { signature: v })} placeholder="一句话签名" />
            </p>
          </div>
        </Reveal>
        <div className="profiles-x">×</div>
        <Reveal className="profile-card glass glass-hover" delay={150}>
          <div className="profile-info">
            <b>
              <EText value={content.friend.name} onChange={(v) => setProfile("friend", { name: v })} placeholder="名字" />
            </b>
            <span className="role">
              <EText value={content.friend.role} onChange={(v) => setProfile("friend", { role: v })} placeholder="角色" />
            </span>
            <p>
              <EText value={content.friend.signature} onChange={(v) => setProfile("friend", { signature: v })} placeholder="一句话签名" />
            </p>
          </div>
          <EImage
            imgClassName="profile-avatar"
            src={content.friend.avatar}
            alt={content.friend.name}
            onChange={(url) => setProfile("friend", { avatar: url })}
          />
        </Reveal>
      </div>

      <div className="timeline">
        <div className="timeline-axis" />
        {events.map((ev, i) => (
          <div className={`tl-event ${i % 2 === 1 ? "right" : ""}`} key={ev.id}>
            <div className="tl-dot" />
            <Reveal delay={i % 2 === 1 ? 120 : 0}>
              <div className={`tl-frame glass glass-hover ${editing ? "edel-host" : ""}`}>
                <div className="tl-date">
                  <EDate value={ev.date} onChange={(v) => patchEvent(ev.id, { date: v })} />
                </div>
                <div className="tl-title">
                  <EText value={ev.title} onChange={(v) => patchEvent(ev.id, { title: v })} placeholder="标题" />
                </div>
                <p className="tl-content">
                  <ETextarea value={ev.content} onChange={(v) => patchEvent(ev.id, { content: v })} placeholder="那天发生了什么…" />
                </p>
                <EImage src={ev.photo} alt={ev.title} onChange={(url) => patchEvent(ev.id, { photo: url })} />
                <EDel onClick={() => delEvent(ev.id)} title="删除这个时刻" />
              </div>
            </Reveal>
          </div>
        ))}
        <EAdd label="＋ 添加一个时刻" onClick={addEvent} />
      </div>
    </div>
  );
}
