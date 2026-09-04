import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useContent } from "../content/ContentContext";
import { EText } from "./Editable";
import type { SiteConfig } from "../content/types";

type Parsed =
  | { kind: "audio"; url: string }
  | { kind: "netease"; id: string; src: string }
  | { kind: "qq"; mid: string; src: string }
  | { kind: "short"; url: string };

const AUDIO_EXT_RE = /\.(mp3|m4a|aac|ogg|wav|flac)([?#]|$)/i;

/** 是否 QQ/网易云 域名下的链接(App 分享短链接都长在这些域名下) */
function isQqOrNeteaseLink(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return /(^|\.)qq\.com$/.test(h) || /(^|\.)163\.com$/.test(h) || /(^|\.)163cn\.tv$/.test(h);
  } catch {
    return false;
  }
}

/**
 * 解析音乐配置:
 * - 网易云歌曲页链接 → 官方外链播放器
 * - QQ音乐歌曲页/带 songmid 的分享链接 → 官方外链播放器
 * - QQ音乐/网易云 App 分享的短链接(c6.y.qq.com/…、163cn.tv/…) → 需异步解析
 * - 其他音频直链(.mp3 等) → 内置磁带机播放
 * 输入可以是整段分享文案,会自动抠出里面的第一条链接。
 */
export function parseMusicUrl(raw: string): Parsed | null {
  let u = (raw || "").trim();
  if (!u) return null;

  // QQ/网易云 App 分享常带一堆文字,先抠出链接本体
  const m = u.match(/https?:\/\/[^\s"'<>「」『』（）【】，。、；]*/);
  if (m) u = m[0];

  if (/^data:audio\//.test(u)) return { kind: "audio", url: u };

  // 网易云: music.163.com/song?id=xxx / #/song?id= / m/song?id= / song/123456
  const ne = u.match(/music\.163\.com\/(?:#\/)?(?:m\/)?song\/?\?id=(\d+)/);
  if (ne)
    return {
      kind: "netease",
      id: ne[1],
      src: `https://music.163.com/outchain/player?type=2&id=${ne[1]}&auto=0&height=66`,
    };
  const nep = u.match(/music\.163\.com\/(?:#\/)?(?:m\/)?song\/(\d+)/);
  if (nep)
    return {
      kind: "netease",
      id: nep[1],
      src: `https://music.163.com/outchain/player?type=2&id=${nep[1]}&auto=0&height=66`,
    };

  // QQ音乐: 分享链接带 songmid=xxx
  const qm = u.match(/songmid=([A-Za-z0-9]+)/);
  if (qm)
    return {
      kind: "qq",
      mid: qm[1],
      src: `https://i.y.qq.com/n2/m/outchain/player/index.html?songmid=${qm[1]}&songtype=0`,
    };
  // QQ音乐: 歌曲页 /n/ryqq/songDetail/xxx(含 ryqq_v2)
  const qd = u.match(/y\.qq\.com\/[^\s]*?\/(?:songDetail|song)\/([A-Za-z0-9]+)/);
  if (qd)
    return {
      kind: "qq",
      mid: qd[1],
      src: `https://i.y.qq.com/n2/m/outchain/player/index.html?songmid=${qd[1]}&songtype=0`,
    };

  if (AUDIO_EXT_RE.test(u)) return { kind: "audio", url: u };
  if (/^https?:\/\//.test(u) && isQqOrNeteaseLink(u)) return { kind: "short", url: u };
  if (/^https?:\/\//.test(u)) return { kind: "audio", url: u };
  return null;
}

/* ================= 短链接解析 ================= */

/** 从文本(代理返回的最终地址或页面内容)里提取歌曲标识 */
function extractSongLink(text: string): string | null {
  if (!text) return null;
  const q1 = text.match(/songmid=([A-Za-z0-9]+)/);
  if (q1) return `https://y.qq.com/n/ryqq/songDetail/${q1[1]}`;
  const q2 = text.match(/y\.qq\.com\/[^\s"'<>]*?\/(?:songDetail|song)\/([A-Za-z0-9]+)/);
  if (q2) return `https://y.qq.com/n/ryqq/songDetail/${q2[1]}`;
  const n = text.match(/music\.163\.com\/[^\s"'<>]*?song\/?\?id=(\d+)/);
  if (n) return `https://music.163.com/song?id=${n[1]}`;
  return null;
}

/** 老浏览器没有 AbortSignal.timeout 时返回 undefined,让请求自然结束 */
function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
}

/**
 * 解析分享短链接:短链接会 302 到带 songmid 的完整歌曲页,
 * 但浏览器跨域读不到跳转地址,只能借公共代理通道跟随跳转。
 * 三条通道并行,谁先拿到有效结果用谁。
 */
async function resolveShortLink(shortUrl: string): Promise<string | null> {
  const tasks: Array<Promise<string | null>> = [
    // allorigins:返回 JSON,status.url 是最终跳转地址
    (async () => {
      try {
        const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(shortUrl)}`, {
          signal: timeoutSignal(8000),
        });
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        const final = j?.status?.url;
        if (typeof final === "string" && final) return final;
        return typeof j?.contents === "string" ? extractSongLink(j.contents) : null;
      } catch {
        return null;
      }
    })(),
    // codetabs:返回最终页面 HTML,从内容里抓 songmid/歌曲 id
    (async () => {
      try {
        const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(shortUrl)}`, {
          signal: timeoutSignal(8000),
        });
        if (!r.ok) return null;
        return extractSongLink(await r.text());
      } catch {
        return null;
      }
    })(),
    // r.jina.ai:返回的文本头部带 "URL Source: 最终地址"
    (async () => {
      try {
        const r = await fetch(`https://r.jina.ai/${shortUrl}`, { signal: timeoutSignal(8000) });
        if (!r.ok) return null;
        const t = await r.text();
        const m = t.match(/URL Source:\s*(\S+)/);
        return m ? m[1] : extractSongLink(t);
      } catch {
        return null;
      }
    })(),
  ];

  const results = await Promise.all(tasks);
  for (const final of results) {
    if (final && extractSongLink(final)) return final;
  }
  return null;
}

/* ---------- 解析结果缓存:同一短链接不用反复走代理 ---------- */

const RESOLVE_CACHE_KEY = "ft-music-resolve";

function readResolveCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(RESOLVE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeResolveCache(shortUrl: string, finalUrl: string) {
  try {
    const map = readResolveCache();
    map[shortUrl] = finalUrl;
    localStorage.setItem(RESOLVE_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* 隐私模式写不进就算了 */
  }
}

/** 音乐:右下角小圆钮,点开是玻璃面板(外链播放器/磁带机/编辑链接) */
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

  // 短链接解析
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [resolveFailed, setResolveFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const url = content?.site.musicUrl ?? "";
  const direct = parseMusicUrl(url);
  const isShort = direct?.kind === "short";
  const parsed = isShort ? (resolvedUrl ? parseMusicUrl(resolvedUrl) : null) : direct;
  const isEmbed = parsed?.kind === "netease" || parsed?.kind === "qq";
  const showFab = !!direct || editing;

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

  // 短链接 → 异步解析成完整歌曲链接(带缓存)。
  // 用 useLayoutEffect:缓存命中时在首帧 painted 前就写入结果,不闪「识别中」
  useLayoutEffect(() => {
    if (parseMusicUrl(url)?.kind !== "short") {
      setResolveFailed(false);
      setResolvedUrl("");
      return;
    }
    const cached = readResolveCache()[url];
    if (cached) {
      setResolvedUrl(cached);
      setResolveFailed(false);
      return;
    }
    let alive = true;
    setResolveFailed(false);
    setResolvedUrl("");
    resolveShortLink(url).then((final) => {
      if (!alive) return;
      if (final) {
        writeResolveCache(url, final);
        setResolvedUrl(final);
      } else {
        setResolveFailed(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [url, retryTick]);

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
        .catch(() =>
          setErr("直链播放失败:链接可能无效或禁止跨域。如果这是 QQ音乐/网易云 的分享链接,请粘贴歌曲页的完整链接")
        );
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
              <label className="mp-edit-label">
                歌曲链接 · 支持 QQ音乐/网易云 的歌曲页或 App 分享链接(短链接自动识别),也支持 mp3 直链
              </label>
              <input
                className="input"
                value={url}
                placeholder="在 QQ音乐/网易云 分享歌曲,把链接直接粘贴到这里…"
                onChange={(e) => setSite({ musicUrl: e.target.value })}
              />
            </div>
          )}

          {isShort && !parsed ? (
            resolveFailed ? (
              <div className="mp-fail">
                <p>
                  这是 QQ音乐/网易云 App 的<b>分享短链接</b>,刚才自动识别没有成功(公共代理通道不稳定)。
                </p>
                <p>
                  可以点「重试」;或者先用浏览器打开这个短链接,等它跳到歌曲页后,把地址栏里的
                  <b>完整链接</b>复制回来粘贴。
                </p>
                <div className="mp-fail-ops">
                  <button className="mp-retry no-spark" onClick={() => setRetryTick((t) => t + 1)}>
                    ↻ 重试识别
                  </button>
                  <a className="mp-openlink" href={url} target="_blank" rel="noreferrer">
                    打开这个链接 ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="mp-empty mp-loading">⟳ 正在识别分享链接里的歌曲…</div>
            )
          ) : !parsed ? (
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
