import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../content/ContentContext";
import { EDate, EText } from "../components/Editable";
import type { Content } from "../content/types";

/** 实时天数:自出生日起,每秒刷新 */
function useDaysSince(metDate: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const met = new Date(metDate + "T00:00:00");
  if (isNaN(met.getTime())) return null;
  const diff = Math.max(0, now.getTime() - met.getTime());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    mins: Math.floor(diff / 60000) % 60,
    secs: Math.floor(diff / 1000) % 60,
  };
}

export default function Home() {
  const { content, update } = useContent();
  const t = useDaysSince(content?.site.metDate ?? "2009-03-04");
  if (!content) return null;

  const s = content.site;
  const setSite = (p: Partial<Content["site"]>) =>
    update((c) => ({ ...c, site: { ...c.site, ...p } }));

  return (
    <div className="home">
      <div className="home-tag">
        MY SPACE · SINCE <EDate value={s.metDate} onChange={(v) => setSite({ metDate: v })} />
      </div>
      <h1 className="home-title iri-text">
        <EText value={s.title} onChange={(v) => setSite({ title: v })} placeholder="MY SPACE" />
      </h1>
      <div className="home-subtitle">
        <EText value={s.subtitle} onChange={(v) => setSite({ subtitle: v })} placeholder="副标题" fallback="我的个人空间" />
      </div>

      <div className="home-quote glass">
        <div className="q">
          「 <EText value={s.heroQuote} onChange={(v) => setSite({ heroQuote: v })} placeholder="一句开场的话" /> 」
        </div>
        <div className="note">
          <EText value={s.heroNote} onChange={(v) => setSite({ heroNote: v })} placeholder="开场说明" />
        </div>
      </div>

      <div className="home-counter glass">
        <div className="home-counter-label">— 我来到这世界 —</div>
        <div className="home-days iri-text">
          {t ? t.days : "—"}
          <span className="home-days-unit">天</span>
        </div>
        {t && (
          <div className="home-hms">
            {String(t.hours).padStart(2, "0")} 小时 {String(t.mins).padStart(2, "0")} 分{" "}
            {String(t.secs).padStart(2, "0")} 秒
          </div>
        )}
        <div className="home-live">REAL-TIME · 此刻仍在继续</div>
      </div>

      <div className="home-actions">
        <Link to="/story" className="btn btn-iri no-spark">从头看这卷胶片</Link>
        <Link to="/letter" className="btn no-spark">直达信件墙</Link>
      </div>
    </div>
  );
}
