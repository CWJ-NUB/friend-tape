import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";

export default function Story() {
  const { content } = useContent();
  if (!content) return null;

  const events = [...content.timeline].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 01 · OUR STORY</div>
      <h2 className="page-title">时间线</h2>
      <p className="page-sub">一卷胶片,从初识那一格开始。每一帧,都是我们一起拍下的画面。</p>

      <div className="profiles">
        <Reveal className="profile-card glass glass-hover">
          <img className="profile-avatar" src={content.me.avatar} alt={content.me.name} />
          <div className="profile-info">
            <b>{content.me.name}</b>
            <span className="role">{content.me.role}</span>
            <p>{content.me.signature}</p>
          </div>
        </Reveal>
        <div className="profiles-x">×</div>
        <Reveal className="profile-card glass glass-hover" delay={150}>
          <div className="profile-info">
            <b>{content.friend.name}</b>
            <span className="role">{content.friend.role}</span>
            <p>{content.friend.signature}</p>
          </div>
          <img className="profile-avatar" src={content.friend.avatar} alt={content.friend.name} />
        </Reveal>
      </div>

      <div className="timeline">
        <div className="timeline-axis" />
        {events.map((ev, i) => (
          <div className={`tl-event ${i % 2 === 1 ? "right" : ""}`} key={ev.id}>
            <div className="tl-dot" />
            <Reveal delay={i % 2 === 1 ? 120 : 0}>
              <div className="tl-frame glass glass-hover">
                <div className="tl-date">{ev.date}</div>
                <div className="tl-title">{ev.title}</div>
                <p className="tl-content">{ev.content}</p>
                {ev.photo && <img className="tl-photo" src={ev.photo} alt={ev.title} loading="lazy" />}
              </div>
            </Reveal>
          </div>
        ))}
      </div>
    </div>
  );
}
