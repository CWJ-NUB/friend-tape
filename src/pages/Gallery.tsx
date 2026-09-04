import { useState } from "react";
import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";

export default function Gallery() {
  const { content } = useContent();
  const [filter, setFilter] = useState("全部");
  if (!content) return null;

  const groups = ["全部", ...Array.from(new Set(content.photos.map((p) => p.group)))];
  const photos = filter === "全部" ? content.photos : content.photos.filter((p) => p.group === filter);

  return (
    <div className="page">
      <div className="page-tag">CHAPTER 02 · MOMENTS</div>
      <h2 className="page-title">相册</h2>
      <p className="page-sub">那些一起按下快门的瞬间,都收在这面玻璃相框墙里。</p>

      <div className="gallery-filters">
        {groups.map((g) => (
          <button
            key={g}
            className={`gfilter ${filter === g ? "active" : ""}`}
            onClick={() => setFilter(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="gallery-grid">
        {photos.map((p, i) => (
          <Reveal key={p.id} delay={(i % 3) * 130}>
            <figure className="gallery-item glass">
              <img src={p.url} alt={p.title} loading="lazy" />
              <figcaption>
                <span>{p.title}</span>
                <span className="gtag">{p.group}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
