import { useState } from "react";
import { useContent } from "../content/ContentContext";
import Reveal from "../components/Reveal";
import { EAdd, EDel, EImage, EText, euid } from "../components/Editable";
import type { Photo } from "../content/types";

export default function Gallery() {
  const { content, update, editing } = useContent();
  const [filter, setFilter] = useState("全部");
  if (!content) return null;

  const setPhotos = (ps: Photo[]) => update((c) => ({ ...c, photos: ps }));
  const patchPhoto = (id: string, p: Partial<Photo>) =>
    setPhotos(content.photos.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const delPhoto = (id: string) => setPhotos(content.photos.filter((x) => x.id !== id));
  const addPhoto = () =>
    setPhotos([
      ...content.photos,
      {
        id: euid(),
        url: "/photos/ph-1.svg",
        title: "新照片",
        group: filter === "全部" ? "日常" : filter,
      },
    ]);

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
            <figure className={`gallery-item glass ${editing ? "edel-host" : ""}`}>
              <EImage src={p.url} alt={p.title} onChange={(url) => patchPhoto(p.id, { url })} />
              <figcaption>
                <span>
                  <EText value={p.title} onChange={(v) => patchPhoto(p.id, { title: v })} placeholder="照片标题" />
                </span>
                <span className="gtag">
                  <EText value={p.group} onChange={(v) => patchPhoto(p.id, { group: v })} placeholder="分类" />
                </span>
              </figcaption>
              <EDel onClick={() => delPhoto(p.id)} title="删除这张照片" />
            </figure>
          </Reveal>
        ))}
        <EAdd label="＋ 添加一张照片" onClick={addPhoto} />
      </div>
    </div>
  );
}
