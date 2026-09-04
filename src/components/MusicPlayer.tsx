import { useEffect, useRef, useState } from "react";
import { useContent } from "../content/ContentContext";
import { EText } from "./Editable";
import type { SiteConfig } from "../content/types";

type Parsed =
  | { kind: "audio"; url: string }
  | { kind: "netease"; id: string; src: string }
  | { kind: "qq"; mid: string; src: string };

/**
 * 解析音乐配置:
 * - 网易云歌曲页链接 → 官方外链播放器
 * - QQ音乐歌曲页/分享链接 → 官方外链播放器
 * - 其他 http(s) 链接 → 当作音频直链,用内置磁带机播放
 */
export function parseMusicUrl(raw: string): Parsed | null {
  const u = (raw || "").trim();
  if (!u) return null;

  // 网易云: music.163.com/song?id=xxx / #/song?id= / m/song?id=
  const ne = u.match(/music\.163\.com\/(?:#\/)?(?:m\/)?song\/?\?id=(\d+)/);
  if (ne)
    return {
      kind: "netease",
      id: ne[1],
      src: `https://music.163.com/outchain/player?type=2&id=${ne[1]}&auto=0&height=66`,
    };

  // QQ音乐: 分享链接带 songmid=xxx
  const qm = u.match(/songmid=([A-Za-z0-9]+)/);
  if (qm)
    return {
      kind: "qq",
      mid: qm[1],
      src: `https://i.y.qq.com/n2/m/outchain/player/index.html?songmid=${qm[1]}&songtype=0`,
    };
  // QQ音乐: 歌曲页 /n/ryqq/songDetail/xxx 或 /n/yqq/song/xxx.html
  const qd = u.match(/y\.qq\.com\/[^\s]*?\/(?:songDetail|song)\/([A-Za-z0-9]+)/);
  if (qd)
    return {
      kind: "qq",
      mid: qd[1],
      src: `https://i.y.qq.com/n2/m/outchain/player/index.html?songmid=${qd[1]}&songtype=0`,
    };

  if (/^https?:\/\//.test(u) || /^data:audio\//.test(u)) return { kind: "audio", url: u };
  return null;
}

/** 音乐:右下角小圆钮,点开是玻璃面板(磁带机/外链播放器/编辑链接) */
export default function MusicPlayer() {
  const { content, update, editing } = useContent();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(() => {
    const v = Number(localStorage.getItem("ft-music-vol"));
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 60;
  });
  const [err, setErr] = useState("");

  const url = content?.site.musicUrl ?? "";
  const parsed = parseMusicUrl(url);
  const isEmbed = parsed?.kind === "netease" || parsed?.kind === "qq";
  const showFab = !!parsed || editing;

  const setSite = (p: Partial<SiteConfig>) =>
    update((c) => ({ ...c, site: { ...c.site, ...p } }));

  // 音量即时生效并记忆
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol / 100;
  }, [vol]);

  // 换歌时重置状态
  useEffect(() => {
    setPlaying(false);
    setErr("");
  }, [url]);

  // 点击面板外关闭
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!document.querySelector(".music-panel")?.contains(t) && !document.querySelector(".music-fab")?.contains(t))
        setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setErr("直链播放失败:链接可能无效或禁止跨域。建议换用 网易云/QQ音乐 的歌曲链接,由官方播放器播放"));
    }
  };

  const changeVol = (v: number) => {
    setVol(v);
    localStorage.setItem("ft-music-vol", String(v));
  };

  return (
    <>
      {showFab && (
        <button
          className={`music-fab glass no-spark ${playing ? "on" : ""}`}
          onClick={() => setOpen((o) => !o)}
          title={open ? "收起音乐" : "播放音乐"}
        >
          <span className="music-fab-note">♪</span>
        </button>
      )}

      {open && (
        <div className={`music-panel glass no-spark ${playing ? "playing" : ""}`}>
          <div className="mp-head">
            <span className="mp-label">SIDE A · OUR SONG</span>
            <b className="mp-title">
              <EText
                value={content?.site.musicTitle ?? ""}
                onChange={(v) => setSite({ musicTitle: v })}
                placeholder="歌名"
                fallback="OUR SONG"
              />
            </b>
          </div>

          {editing && (
            <div className="mp-edit">
              <label className="mp-edit-label">歌曲链接 · 支持 QQ音乐 / 网易云 歌曲链接,或 mp3 直链</label>
              <input
                className="input"
                value={url}
                placeholder="在 QQ音乐/网易云 打开歌曲,复制链接粘贴到这里…"
                onChange={(e) => setSite({ musicUrl: e.target.value })}
              />
            </div>
          )}

          {!parsed ? (
            <div className="mp-empty">
              {editing ? "粘贴链接后,这里会出现播放器" : "还没有设置背景音乐"}
            </div>
          ) : isEmbed ? (
            <iframe className="mp-embed" src={parsed.src} title="音乐" allow="autoplay; encrypted-media" />
          ) : (
            <>
              <div className="mp-body">
                <div className="mp-reels">
                  <span className="mp-reel" />
                  <span className="mp-line" />
                  <span className="mp-reel" />
                </div>
              </div>
              <div className="mp-row">
                <button className="mp-play no-spark" onClick={toggle}>
                  {playing ? "❚❚" : "▶"}
                </button>
                <span className="mp-vol-icon">♪</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={vol}
                  aria-label="音量"
                  onChange={(e) => changeVol(Number(e.target.value))}
                />
              </div>
              {err && <div className="mp-err">{err}</div>}
            </>
          )}
        </div>
      )}

      {/* 直链音频:面板收起后继续播放 */}
      {parsed?.kind === "audio" && (
        <audio ref={audioRef} src={parsed.url} loop onEnded={() => setPlaying(false)} />
      )}
    </>
  );
}
