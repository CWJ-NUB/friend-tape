import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../content/ContentContext";

/** 实时天数:自相识日起,每秒刷新 */
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
  const { content } = useContent();
  const t = useDaysSince(content?.site.metDate ?? "2025-05-10");

  return (
    <div className="home">
      <div className="home-tag">OUR TAPE · SINCE {content?.site.metDate}</div>
      <h1 className="home-title iri-text">OUR TAPE</h1>
      <div className="home-subtitle">{content?.site.subtitle ?? "我们的胶片"}</div>

      <div className="home-quote glass">
        <div className="q">「 {content?.site.heroQuote} 」</div>
        <div className="note">{content?.site.heroNote}</div>
      </div>

      <div className="home-counter glass">
        <div className="home-counter-label">— 我们已并肩走过 —</div>
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
