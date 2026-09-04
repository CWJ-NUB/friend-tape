import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";
import { EAdd, EDate, EDel, EText, ETextarea, euid } from "../components/Editable";
import type { Quote } from "../content/types";

export default function Quotes() {
  const { content, update, editing } = useContent();
  if (!content) return null;

  const setQuotes = (qs: Quote[]) => update((c) => ({ ...c, quotes: qs }));
  const patchQuote = (id: string, p: Partial<Quote>) =>
    setQuotes(content.quotes.map((q) => (q.id === id ? { ...q, ...p } : q)));
  const delQuote = (id: string) => setQuotes(content.quotes.filter((q) => q.id !== id));
  const addQuote = () =>
    setQuotes([
      ...content.quotes,
      { id: euid(), text: "新收藏的一句话…", author: "谁说的", date: new Date().toISOString().slice(0, 10) },
    ]);

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 04 · ECHOES</div>
      <h2 className="page-title">那些话</h2>
      <p className="page-sub">有些话说过就忘了,有些话记了很多年。这里收藏后者。</p>

      <div className="quotes-list">
        {content.quotes.map((q, i) => (
          <Reveal key={q.id} delay={i * 120}>
            <div className={`quote-item glass no-spark ${editing ? "edel-host" : ""}`}>
              <div className="q-text">
                <ETextarea value={q.text} onChange={(v) => patchQuote(q.id, { text: v })} placeholder="那句话" minHeight={60} />
              </div>
              <div className="quote-meta">
                <span>
                  —— <EText value={q.author} onChange={(v) => patchQuote(q.id, { author: v })} placeholder="谁说的" /> 说
                </span>
                <span>
                  <EDate value={q.date} onChange={(v) => patchQuote(q.id, { date: v })} />
                </span>
              </div>
              <EDel onClick={() => delQuote(q.id)} title="删除这句话" />
            </div>
          </Reveal>
        ))}
        <EAdd label="＋ 收藏一句话" onClick={addQuote} />
      </div>
    </div>
  );
}
