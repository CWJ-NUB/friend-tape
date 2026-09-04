import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";

export default function Quotes() {
  const { content } = useContent();
  if (!content) return null;

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 04 · ECHOES</div>
      <h2 className="page-title">那些话</h2>
      <p className="page-sub">有些话说过就忘了,有些话记了很多年。这里收藏后者。</p>

      <div className="quotes-list">
        {content.quotes.map((q, i) => (
          <Reveal key={q.id} delay={i * 120}>
            <div className="quote-item glass no-spark">
              <div className="q-text">{q.text}</div>
              <div className="quote-meta">
                <span>—— {q.author} 说</span>
                <span>{q.date}</span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
