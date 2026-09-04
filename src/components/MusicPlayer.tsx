import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useContent } from "../content/ContentContext";
import { EText } from "./Editable";
import type { SiteConfig } from "../content/types";

type Parsed =
  | { kind: "audio"; url: string }
  | { kind: "netease"; id: string; src: string } // 网易云歌曲页 → 官方外链播放器
  | { kind: "qq-short"; tag: string; src: string } // QQ App 分享短链 → 官方播放器 shorttag 直解
  | { kind: "qq"; mid: string } // QQ 歌曲页 songmid → 需转数字 songid
  | { kind: "ne-short"; url: string } // 网易云短链(163cn.tv 等) → 需代理解析
  | { kind: "unknown" }; // 认不出的链接类型

const AUDIO_EXT_RE = /\.(mp3|m4a|aac|ogg|wav|flac)([?#]|$)/i;
const QQ_OUTCHAIN = "https://i.y.qq.com/n2/m/outchain/player/index.html";

/** 是否 QQ/网易云 域名 */
function isQqOrNeteaseHost(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return /(^|\.)qq\.com$/.test(h) || /(^|\.)163\.com$/.test(h) || /(^|\.)163cn\.tv$/.test(h);
  } catch {
    return false;
  }
}

/**
 * 解析音乐配置:
 * - QQ音乐 App 分享短链(c6.y.qq.com/…?__=xxx) → 官方外链播放器 shorttag 直解(零代理)
 * - QQ音乐歌曲页链接(songmid / songDetail/xxx) → 需把 mid 转成数字 songid
 * - 网易云歌曲页链接 → 官方外链播放器
 * - 网易云短链(163cn.tv) → 需代理解析
 * - 其他音频直链(.mp3 等) → 内置磁带机播放
 * 输入可以是整段分享文案,会自动抠出里面的第一条链接。
 */
export function parseMusicUrl(raw: string): Parsed | null {
  let u = (raw || "").trim();
  if (!u) return null;

  // App 分享常带一堆文字,先抠出链接本体
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

  // QQ音乐: App 分享短链(?__=xxx),官方播放器原生支持 shorttag 直解
  const qs = u.match(/[?&]__=([A-Za-z0-9_-]+)/);
  if (qs && isQqOrNeteaseHost(u)) {
    const tag = qs[1];
    // QQ 官方 outchain 播放器:传 shorttag 它自己调接口解析短链
    return { kind: "qq-short", tag, src: `${QQ_OUTCHAIN}?shorttag=${tag}` };
  }

  // QQ音乐: 分享链接带 songmid=xxx / 歌曲页 songDetail/xxx
  const qm = u.match(/songmid=([A-Za-z0-9]+)/);
  if (qm) return { kind: "qq", mid: qm[1] };
  const qd = u.match(/y\.qq\.com\/[^\s]*?\/(?:songDetail|song)\/([A-Za-z0-9]+)/);
  if (qd) return { kind: "qq", mid: qd[1] };

  if (AUDIO_EXT_RE.test(u)) return { kind: "audio", url: u };

  if (/^https?:\/\//.test(u)) {
    // 网易云短链(163cn.tv)或 163 域下其他分享链接 → 交给代理解析
    if (isQqOrNeteaseHost(u) && /163cn\.tv|music\.163\.com/.test(u)) return { kind: "ne-short", url: u };
    // QQ/163 域名但认不出格式(如歌单页) → 给明确提示,别当直链播
    if (isQqOrNeteaseHost(u)) return { kind: "unknown" };
    return { kind: "audio", url: u };
  }
  return null;
}

/* ================= 短链/歌曲标识解析 ================= */

/** 从文本(代理返回的最终地址或页面内容)里提取歌曲链接 */
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

/** JSONP 调用(script 标签天然跨域,零代理依赖) */
function jsonp(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const cb = `__ftmusic${Date.now()}${Math.floor(Math.random() * 1e4)}`;
    const s = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 8000);
    const cleanup = () => {
      clearTimeout(timer);
      delete (window as any)[cb];
      s.remove();
    };
    (window as any)[cb] = (data: any) => {
      cleanup();
      resolve(data);
    };
    s.onerror = () => {
      cleanup();
      reject(new Error("script error"));
    };
    s.src = `${url}&callback=${cb}`;
    document.head.appendChild(s);
  });
}

/**
 * QQ音乐 songmid → 数字 songid。
 * 官方外链播放器只认 songid(数字)/shorttag,不认 songmid,
 * 通过 QQ 官方 musicu.fcg 的 JSONP 接口把 mid 换成 id,浏览器直调无需代理。
 */
async function qqMidToSongid(mid: string): Promise<string | null> {
  const data = encodeURIComponent(
    JSON.stringify({
      req_0: {
        module: "track_info.UniformRuleCtrlServer",
        method: "GetTrackInfo",
        param: { mids: [mid], types: [0], singer_pmid: 1 },
      },
    })
  );
  try {
    const res = await jsonp(`https://u.y.qq.com/cgi-bin/musicu.fcg?format=jsonp&data=${data}`);
    const t = res?.req_0?.data?.tracks?.[0];
    return t?.id ? String(t.id) : null;
  } catch {
    return null;
  }
}

/**
 * 解析网易云分享短链:短链会 302 到完整歌曲页,
 * 浏览器跨域读不到跳转地址,只能借公共代理通道跟随跳转。
 */
async function resolveNeteaseShort(shortUrl: string): Promise<string | null> {
  const tasks: Array<Promise<string | null>> = [
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

/* ---------- 解析结果缓存:同一链接不用反复解析 ---------- */

const RESOLVE_CACHE_KEY = "ft-music-resolve";

function readResolveCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(RESOLVE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeResolveCache(key: string, embedSrc: string) {
  try {
    const map = readResolveCache();
    map[key] = embedSrc;
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

  // 需异步解析的链接(qq mid / 网易云短链)的解析结果:最终 iframe src
  const [resolvedSrc, setResolvedSrc] = useState("");
  const [resolveFailed, setResolveFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const url = content?.site.musicUrl ?? "";
  const direct = parseMusicUrl(url);
  // 是否需要异步解析(qq mid 转数字 id / 网易云短链跳转)
  const needsResolve = direct?.kind === "qq" || direct?.kind === "ne-short";
  const embedSrc =
    direct?.kind === "netease" || direct?.kind === "qq-short" ? direct.src : resolvedSrc || null;
  const isEmbed = !!embedSrc;
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

  // 链接解析:QQ songmid → JSONP 换数字 id;网易云短链 → 代理跟随跳转。
  // useLayoutEffect:缓存命中时不闪「识别中」
  useLayoutEffect(() => {
    if (!needsResolve) {
      setResolveFailed(false);
      setResolvedSrc("");
      return;
    }
    const key = direct!.kind === "qq" ? `mid:${direct!.mid}` : direct!.url;
    const cached = readResolveCache()[key];
    if (cached) {
      setResolvedSrc(cached);
      setResolveFailed(false);
      return;
    }
    let alive = true;
    setResolveFailed(false);
    setResolvedSrc("");
    const job: Promise<string | null> =
      direct!.kind === "qq"
        ? qqMidToSongid(direct!.mid).then((id) =>
            id ? `${QQ_OUTCHAIN}?songid=${id}` : null
          )
        : resolveNeteaseShort(direct!.url).then((link) => {
            if (!link) return null;
            const p = parseMusicUrl(link);
            return p?.kind === "netease" ? p.src : null;
          });
    job.then((src) => {
      if (!alive) return;
      if (src) {
        writeResolveCache(key, src);
        setResolvedSrc(src);
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
        .catch(() => setErr("直链播放失败:链接可能无效或禁止跨域。建议换用 QQ音乐/网易云 的歌曲链接"));
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
                歌曲链接 · 支持 QQ音乐/网易云 的歌曲链接或 App 分享链接,也支持 mp3 直链
              </label>
              <input
                className="input"
                value={url}
                placeholder="在 QQ音乐/网易云 分享歌曲,把链接直接粘贴到这里…"
                onChange={(e) => setSite({ musicUrl: e.target.value })}
              />
            </div>
          )}

          {direct?.kind === "unknown" ? (
            <div className="mp-fail">
              <p>
                这是 QQ音乐/网易云 的链接,但<b>不是单曲分享链接</b>(可能是歌单、专辑或电台页)。
                目前只支持单曲:请在 App 里打开这首歌 → 点「分享」→ 复制链接再粘贴。
              </p>
            </div>
          ) : needsResolve && !embedSrc ? (
            resolveFailed ? (
              <div className="mp-fail">
                <p>自动识别没有成功(网络通道不稳定),点「重试」再试一次。</p>
                <p>
                  也可以直接用 QQ音乐 App:打开这首歌 → 点「分享」→「复制链接」,把
                  <b>短链接</b>粘贴过来,官方播放器能直接识别。
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
          ) : !direct ? (
            <div className="mp-empty">
              {editing ? "粘贴链接后,这里会出现播放器" : "还没有设置背景音乐"}
            </div>
          ) : isEmbed ? (
            <iframe className="mp-embed" src={embedSrc!} title="音乐" allow="autoplay; encrypted-media" />
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
      {direct?.kind === "audio" && (
        <audio ref={audioRef} src={direct.url} loop onEnded={() => setPlaying(false)} />
      )}
    </>
  );
}
