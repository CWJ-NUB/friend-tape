import { useEffect, useRef, useState } from "react";
import { useContent } from "../content/ContentContext";
import type { Content, LetterContent, Photo, Profile, Quote, TimelineEvent, Wish } from "../content/types";
import { compressImage, fetchContent, inferGhTarget, loadAuth, locateRepoByToken, pushContent, saveAuth, type GhAuth } from "../lib/github";

type Tab = "site" | "me" | "friend" | "timeline" | "photos" | "quotes" | "wishes" | "letters";

const TABS: { id: Tab; label: string }[] = [
  { id: "site", label: "01 · 全站设置" },
  { id: "me", label: "02 · 我的名片" },
  { id: "friend", label: "03 · 哥的名片" },
  { id: "timeline", label: "04 · 时间线" },
  { id: "photos", label: "05 · 照片墙" },
  { id: "quotes", label: "06 · 那些话" },
  { id: "wishes", label: "07 · 未来之约" },
  { id: "letters", label: "08 · 信件墙" },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function Admin() {
  const { reload } = useContent();
  const [auth, setAuth] = useState<GhAuth | null>(null);
  const [sha, setSha] = useState("");
  const [draft, setDraft] = useState<Content | null>(null);
  const [tab, setTab] = useState<Tab>("site");
  const [status, setStatus] = useState<{ type: "ok" | "err" | "info"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const firstLoad = useRef(true);

  // 登录表单:Token 必填;用户名/仓库名全自动识别,极端情况才手填
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [locating, setLocating] = useState(false);
  const inferred = useRef(inferGhTarget());

  useEffect(() => {
    if (!firstLoad.current) return;
    firstLoad.current = false;

    // 邀请链接自动登录:支持 网址?t=xxx#/admin 或 网址#/admin?t=xxx 两种写法
    let t = "";
    try {
      t = new URLSearchParams(window.location.search).get("t") || "";
      if (!t && window.location.hash.includes("?")) {
        t = new URLSearchParams(window.location.hash.split("?")[1]).get("t") || "";
      }
    } catch {
      /* ignore */
    }

    if (t) {
      // 立刻把 Token 从地址栏清掉,避免留在浏览器历史里
      window.history.replaceState(null, "", window.location.pathname + window.location.hash.split("?")[0]);
      setToken(t);
      const target = inferGhTarget();
      if (target) {
        connect({ token: t, owner: target.owner, repo: target.repo, branch: "main" });
        return;
      }
      // 本地预览等无法识别仓库的环境:填入 Token 等待手动补仓库名
      setStatus({ type: "info", msg: "已收到邀请凭证,请补上用户名和仓库名后点「连接」。" });
      return;
    }

    const saved = loadAuth();
    if (saved) {
      setToken(saved.token);
      connect(saved);
    }
  }, []);

  /** 连接:分支自动尝试 main → master,用户不用关心 */
  async function connect(a: GhAuth) {
    setBusy(true);
    setStatus({ type: "info", msg: "正在连接 GitHub 仓库…" });
    const base = { token: a.token.trim(), owner: a.owner.trim(), repo: a.repo.trim() };
    let lastErr: unknown = null;
    try {
      for (const branch of ["main", "master"]) {
        try {
          const r = await fetchContent({ ...base, branch });
          const next: GhAuth = { ...base, branch };
          setAuth(next);
          setSha(r.sha);
          setDraft(r.content);
          setDirty(false);
          saveAuth(next);
          setStatus({ type: "ok", msg: `已连接 ${next.owner}/${next.repo},内容已载入,可以开始编辑。` });
          return;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({
        type: "err",
        msg: inferred.current
          ? msg
          : `${msg}。另外注意:本地预览时无法自动识别仓库,请确认上方填写的用户名/仓库名正确。`,
      });
    } finally {
      setBusy(false);
    }
  }

  /** 一键连接:贴 Token 即可。先从网址识别仓库,识别不到就用 Token 向 GitHub 自动定位。 */
  async function autoConnect() {
    const t = token.trim();
    if (!t) return;

    // 优先级:网址识别 > 手动填写 > Token 自动定位
    let target = inferred.current ?? (owner.trim() && repo.trim() ? { owner: owner.trim(), repo: repo.trim() } : null);
    if (!target) {
      setBusy(true);
      setLocating(true);
      setStatus({ type: "info", msg: "正在自动识别你的仓库…" });
      try {
        target = await locateRepoByToken(t);
      } catch (e) {
        setStatus({ type: "err", msg: e instanceof Error ? e.message : String(e) });
        setBusy(false);
        setLocating(false);
        return;
      }
      setLocating(false);
      if (!target) {
        setBusy(false);
        setShowManual(true);
        setStatus({ type: "err", msg: "在你的仓库里没找到本站数据。请展开下方手动填写,填上用户名和仓库名再点连接。" });
        return;
      }
      setOwner(target.owner);
      setRepo(target.repo);
      setStatus({ type: "ok", msg: `已自动识别仓库 ${target.owner}/${target.repo},正在连接…` });
    }
    await connect({ token: t, owner: target.owner, repo: target.repo, branch: "main" });
  }

  async function pull() {
    if (!auth) return;
    if (dirty && !confirm("你有未保存的修改,拉取最新内容会覆盖它们。确定继续?")) return;
    setBusy(true);
    try {
      const r = await fetchContent(auth);
      setSha(r.sha);
      setDraft(r.content);
      setDirty(false);
      setStatus({ type: "ok", msg: "已拉取仓库最新内容。" });
    } catch (e) {
      setStatus({ type: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!auth || !draft) return;
    setBusy(true);
    setStatus({ type: "info", msg: "正在保存到 GitHub…" });
    try {
      const next = { ...draft, site: { ...draft.site, updatedAt: new Date().toISOString().slice(0, 10) } };
      const newSha = await pushContent(auth, next, sha);
      setDraft(next);
      setSha(newSha);
      setDirty(false);
      await reload();
      setStatus({ type: "ok", msg: "保存成功!约 1 分钟后 GitHub Pages 会自动更新,刷新网站即可看到。" });
    } catch (e) {
      setStatus({ type: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    saveAuth(null);
    setAuth(null);
    setDraft(null);
    setDirty(false);
    setStatus({ type: "info", msg: "已断开连接(Token 仍保留在本机输入框,清空即可移除)。" });
  }

  const edit = (fn: (d: Content) => Content) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
  };

  // 邀请:把当前 Token 做成链接,朋友点开即自动登录,无需任何操作
  const [invite, setInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const inviteUrl = auth
    ? `${window.location.origin}${window.location.pathname}?t=${encodeURIComponent(auth.token)}#/admin`
    : "";
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用时手动选中复制 */
    }
  };

  if (!auth || !draft) {
    return (
      <div className="page admin-login">
        <div className="page-tag">CONTROL ROOM · EDIT MODE</div>
        <h2 className="page-title">编辑中心</h2>
        <p className="page-sub">
          你和哥都可以在这里修改网站的任何内容,改完点「保存」即可,约一分钟后网站自动更新。
        </p>

        <div className="glass no-spark" style={{ padding: 26 }}>
          <div className="admin-steps">
            <b>首次使用只需一步:</b>
            点{" "}
            <a
              href="https://github.com/settings/tokens/new?description=OUR-TAPE&scopes=repo"
              target="_blank"
              rel="noreferrer"
            >
              <b>这里打开 GitHub Token 页</b>
            </a>
            (所需权限已自动勾好),拉到底点 <code>Generate token</code>,把生成的一串字符粘贴到下面,点「连接」就完成了。
            用户名、仓库名这些都不用管,会自动识别。
            <br />
            <span className="admin-steps-sub">(哥如果收到了你发的邀请链接,直接点开链接就能编辑,跳过以上所有步骤。)</span>
          </div>

          <div className="admin-form-row">
            <div className="full">
              <label className="field">GITHUB TOKEN(仅保存在你的浏览器本地)</label>
              <input
                className="input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && autoConnect()}
                placeholder="点上面链接生成,粘贴到这里…"
              />
            </div>
            <div className="full">
              <button
                className="btn btn-iri"
                style={{ width: "100%" }}
                disabled={busy || !token.trim()}
                onClick={autoConnect}
              >
                {busy ? (locating ? "正在识别仓库…" : "连接中…") : "连 接"}
              </button>
            </div>
          </div>

          <button className="admin-manual-toggle mono" onClick={() => setShowManual((v) => !v)}>
            {showManual ? "▾ 收起手动填写" : "▸ 连不上?手动填写用户名/仓库名"}
          </button>
          {showManual && (
            <div className="admin-form-row">
              <div>
                <label className="field">GITHUB 用户名</label>
                <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="例如 chenweijia" />
              </div>
              <div>
                <label className="field">仓库名</label>
                <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="例如 friend-tape" />
              </div>
            </div>
          )}
        </div>

        {status && <div className={`admin-status ${status.type}`}>{status.msg}</div>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-tag">CONTROL ROOM · CONNECTED</div>
      <h2 className="page-title">编辑中心</h2>

      <div className="admin-topbar glass no-spark">
        <div className="conn">
          ▣ <b>{auth.owner}/{auth.repo}</b> @ {auth.branch} · {dirty ? <span style={{ color: "var(--accent)" }}>有未保存修改</span> : "无未保存修改"}
        </div>
        <button className="btn btn-iri" disabled={busy || !dirty} onClick={save}>
          {busy ? "保存中…" : "✓ 保存到 GitHub"}
        </button>
        <button className="btn" disabled={busy} onClick={pull}>↻ 拉取最新</button>
        <button className="btn" onClick={() => setInvite(true)}>✉ 邀请</button>
        <button className="btn" onClick={disconnect}>断开</button>
      </div>

      {invite && (
        <div className="invite-modal no-spark" onClick={() => setInvite(false)}>
          <div className="invite-panel glass" onClick={(e) => e.stopPropagation()}>
            <h3>邀请哥一起编辑</h3>
            <p className="invite-desc">
              把下面这条链接发给他(微信/QQ 都行)。<b>他点开链接就会直接进入编辑模式</b>,
              不需要注册、不需要 Token、不需要任何设置——改完点「保存到 GitHub」即可。
            </p>
            <div className="invite-url mono">{inviteUrl}</div>
            <div className="invite-ops">
              <button className="btn btn-iri" onClick={copyInvite}>{copied ? "✓ 已复制" : "复制邀请链接"}</button>
              <button className="btn" onClick={() => setInvite(false)}>关闭</button>
            </div>
            <p className="invite-note">
              安全提示:链接里含有编辑凭证,只发给他本人,别发到群里。万一泄露,
              到 GitHub → Settings → Developer settings → Tokens 里删除这个 Token 再重新生成一个即可。
            </p>
          </div>
        </div>
      )}

      {status && <div className={`admin-status ${status.type}`}>{status.msg}</div>}

      <div className="admin-shell">
        <div className="admin-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-section glass no-spark">
          {tab === "site" && <SiteForm d={draft} edit={edit} />}
          {tab === "me" && <ProfileForm title="我的名片" hint="你的个人信息,展示在时间线页顶部。" p={draft.me} edit={(fn) => edit((d) => ({ ...d, me: fn(d.me) }))} />}
          {tab === "friend" && <ProfileForm title="哥的名片" hint="王怀章的个人信息,同样展示在时间线页顶部。" p={draft.friend} edit={(fn) => edit((d) => ({ ...d, friend: fn(d.friend) }))} />}
          {tab === "timeline" && <TimelineForm d={draft} edit={edit} />}
          {tab === "photos" && <PhotosForm d={draft} edit={edit} />}
          {tab === "quotes" && <QuotesForm d={draft} edit={edit} />}
          {tab === "wishes" && <WishesForm d={draft} edit={edit} />}
          {tab === "letters" && <LettersForm d={draft} edit={edit} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- 表单:全站设置 ---------- */
function SiteForm({ d, edit }: { d: Content; edit: (fn: (d: Content) => Content) => void }) {
  const s = d.site;
  const set = (patch: Partial<typeof s>) => edit((x) => ({ ...x, site: { ...x.site, ...patch } }));
  return (
    <>
      <h3>全站设置</h3>
      <p className="hint">标题、开场白、纪念日、背景音乐、留言板等全站配置。</p>
      <div className="admin-form-row">
        <div className="full">
          <label className="field">网站大标题(开场页)</label>
          <input className="input" value={s.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div className="full">
          <label className="field">副标题</label>
          <input className="input" value={s.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
        </div>
        <div className="full">
          <label className="field">开场引言(一句话)</label>
          <input className="input" value={s.heroQuote} onChange={(e) => set({ heroQuote: e.target.value })} />
        </div>
        <div className="full">
          <label className="field">开场说明</label>
          <textarea className="textarea" value={s.heroNote} onChange={(e) => set({ heroNote: e.target.value })} />
        </div>
        <div>
          <label className="field">相识日期(天数从此起算)</label>
          <input className="input" type="date" value={s.metDate} onChange={(e) => set({ metDate: e.target.value })} />
        </div>
        <div>
          <label className="field">音乐标题(显示在磁带上)</label>
          <input className="input" value={s.musicTitle} onChange={(e) => set({ musicTitle: e.target.value })} />
        </div>
        <div className="full">
          <label className="field">音乐链接(mp3 直链,可换成对你们有意义的歌)</label>
          <input className="input" value={s.musicUrl} onChange={(e) => set({ musicUrl: e.target.value })} />
        </div>
      </div>

      <h3 style={{ marginTop: 34 }}>留言板(giscus)</h3>
      <p className="hint">
        前往 <b>giscus.app</b>,填入仓库名生成配置,把 repo / repoId / category / categoryId 抄到这里,留言板即启用(仓库需开启 Discussions)。
      </p>
      <div className="admin-form-row">
        <div>
          <label className="field">REPO(如 owner/repo)</label>
          <input className="input" value={s.giscus.repo} onChange={(e) => set({ giscus: { ...s.giscus, repo: e.target.value } })} placeholder="chenweijia/friend-tape" />
        </div>
        <div>
          <label className="field">CATEGORY</label>
          <input className="input" value={s.giscus.category} onChange={(e) => set({ giscus: { ...s.giscus, category: e.target.value } })} />
        </div>
        <div>
          <label className="field">REPO ID</label>
          <input className="input" value={s.giscus.repoId} onChange={(e) => set({ giscus: { ...s.giscus, repoId: e.target.value } })} />
        </div>
        <div>
          <label className="field">CATEGORY ID</label>
          <input className="input" value={s.giscus.categoryId} onChange={(e) => set({ giscus: { ...s.giscus, categoryId: e.target.value } })} />
        </div>
      </div>
    </>
  );
}

/* ---------- 表单:名片 ---------- */
function ProfileForm({
  title, hint, p, edit,
}: {
  title: string;
  hint: string;
  p: Profile;
  edit: (fn: (p: Profile) => Profile) => void;
}) {
  const set = (patch: Partial<Profile>) => edit((x) => ({ ...x, ...patch }));
  return (
    <>
      <h3>{title}</h3>
      <p className="hint">{hint}</p>
      <div className="admin-form-row">
        <div>
          <label className="field">姓名</label>
          <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className="field">昵称</label>
          <input className="input" value={p.nickname} onChange={(e) => set({ nickname: e.target.value })} />
        </div>
        <div>
          <label className="field">身份说明(如:写信的人)</label>
          <input className="input" value={p.role} onChange={(e) => set({ role: e.target.value })} />
        </div>
        <div>
          <label className="field">生日(可不填)</label>
          <input className="input" type="date" value={p.birthday} onChange={(e) => set({ birthday: e.target.value })} />
        </div>
        <div className="full">
          <label className="field">签名一句话</label>
          <input className="input" value={p.signature} onChange={(e) => set({ signature: e.target.value })} />
        </div>
        <div className="full">
          <label className="field">头像</label>
          <PhotoInput value={p.avatar} onChange={(url) => set({ avatar: url })} />
        </div>
      </div>
    </>
  );
}

/* ---------- 表单:时间线 ---------- */
function TimelineForm({ d, edit }: { d: Content; edit: (fn: (d: Content) => Content) => void }) {
  const list = [...d.timeline].sort((a, b) => a.date.localeCompare(b.date));
  const setList = (tl: TimelineEvent[]) => edit((x) => ({ ...x, timeline: tl }));
  const patch = (id: string, p: Partial<TimelineEvent>) => setList(list.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const arr = [...list];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setList(arr);
  };
  return (
    <>
      <h3>时间线</h3>
      <p className="hint">你们的故事节点。按日期排序展示,可增删改、调整顺序、配照片。</p>
      {list.map((e, i) => (
        <div className="admin-item" key={e.id}>
          <div className="admin-item-top">
            <span className="idx">SCENE {String(i + 1).padStart(2, "0")}</span>
            <div className="admin-item-ops">
              <button className="mini-btn" onClick={() => move(i, -1)}>↑ 上移</button>
              <button className="mini-btn" onClick={() => move(i, 1)}>↓ 下移</button>
              <button className="mini-btn danger" onClick={() => setList(list.filter((x) => x.id !== e.id))}>✕ 删除</button>
            </div>
          </div>
          <div className="admin-form-row">
            <div>
              <label className="field">日期</label>
              <input className="input" type="date" value={e.date} onChange={(ev) => patch(e.id, { date: ev.target.value })} />
            </div>
            <div>
              <label className="field">标题</label>
              <input className="input" value={e.title} onChange={(ev) => patch(e.id, { title: ev.target.value })} />
            </div>
            <div className="full">
              <label className="field">内容</label>
              <textarea className="textarea" value={e.content} onChange={(ev) => patch(e.id, { content: ev.target.value })} />
            </div>
            <div className="full">
              <label className="field">配图</label>
              <PhotoInput value={e.photo} onChange={(url) => patch(e.id, { photo: url })} />
            </div>
          </div>
        </div>
      ))}
      <button
        className="btn admin-add"
        onClick={() => setList([...list, { id: uid(), date: new Date().toISOString().slice(0, 10), title: "新的节点", content: "写下这一天发生的故事…", photo: "" }])}
      >
        ＋ 添加时间线节点
      </button>
    </>
  );
}

/* ---------- 表单:照片墙 ---------- */
function PhotosForm({ d, edit }: { d: Content; edit: (fn: (d: Content) => Content) => void }) {
  const setList = (ps: Photo[]) => edit((x) => ({ ...x, photos: ps }));
  const patch = (id: string, p: Partial<Photo>) => setList(d.photos.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <>
      <h3>照片墙</h3>
      <p className="hint">显影室里的照片。支持直接上传本地图片(≤1.5MB),会自动存进仓库;也可以填外链。</p>
      {d.photos.map((p, i) => (
        <div className="admin-item" key={p.id}>
          <div className="admin-item-top">
            <span className="idx">FRAME {String(i + 1).padStart(2, "0")}</span>
            <button className="mini-btn danger" onClick={() => setList(d.photos.filter((x) => x.id !== p.id))}>✕ 删除</button>
          </div>
          <div className="admin-form-row">
            <div className="full">
              <label className="field">图片</label>
              <PhotoInput value={p.url} onChange={(url) => patch(p.id, { url })} />
            </div>
            <div>
              <label className="field">照片标题</label>
              <input className="input" value={p.title} onChange={(e) => patch(p.id, { title: e.target.value })} />
            </div>
            <div>
              <label className="field">分组(用于筛选)</label>
              <input className="input" value={p.group} onChange={(e) => patch(p.id, { group: e.target.value })} placeholder="日常 / 出行 / 节日…" />
            </div>
          </div>
        </div>
      ))}
      <button className="btn admin-add" onClick={() => setList([...d.photos, { id: uid(), url: "", title: "新照片", group: "日常" }])}>
        ＋ 添加照片
      </button>
    </>
  );
}

/* ---------- 表单:那些话 ---------- */
function QuotesForm({ d, edit }: { d: Content; edit: (fn: (d: Content) => Content) => void }) {
  const setList = (qs: Quote[]) => edit((x) => ({ ...x, quotes: qs }));
  const patch = (id: string, p: Partial<Quote>) => setList(d.quotes.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <>
      <h3>那些话</h3>
      <p className="hint">值得记很多年的话:金句、口头禅、只有你们懂的梗。</p>
      {d.quotes.map((q, i) => (
        <div className="admin-item" key={q.id}>
          <div className="admin-item-top">
            <span className="idx">TAKE {String(i + 1).padStart(2, "0")}</span>
            <button className="mini-btn danger" onClick={() => setList(d.quotes.filter((x) => x.id !== q.id))}>✕ 删除</button>
          </div>
          <div className="admin-form-row">
            <div className="full">
              <label className="field">内容</label>
              <textarea className="textarea" value={q.text} onChange={(e) => patch(q.id, { text: e.target.value })} />
            </div>
            <div>
              <label className="field">谁说的</label>
              <input className="input" value={q.author} onChange={(e) => patch(q.id, { author: e.target.value })} />
            </div>
            <div>
              <label className="field">日期</label>
              <input className="input" value={q.date} onChange={(e) => patch(q.id, { date: e.target.value })} />
            </div>
          </div>
        </div>
      ))}
      <button className="btn admin-add" onClick={() => setList([...d.quotes, { id: uid(), text: "新的一句话…", author: "哥", date: "" }])}>
        ＋ 添加一句话
      </button>
    </>
  );
}

/* ---------- 表单:未来之约 ---------- */
function WishesForm({ d, edit }: { d: Content; edit: (fn: (d: Content) => Content) => void }) {
  const setList = (ws: Wish[]) => edit((x) => ({ ...x, wishes: ws }));
  const patch = (id: string, p: Partial<Wish>) => setList(d.wishes.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <>
      <h3>未来之约</h3>
      <p className="hint">说好要一起做的事。这里的勾选状态会永久保存(不像访客端只存在浏览器)。</p>
      {d.wishes.map((w, i) => (
        <div className="admin-item" key={w.id}>
          <div className="admin-item-top">
            <span className="idx">PACT {String(i + 1).padStart(2, "0")}</span>
            <button className="mini-btn danger" onClick={() => setList(d.wishes.filter((x) => x.id !== w.id))}>✕ 删除</button>
          </div>
          <div className="admin-form-row">
            <div>
              <label className="field">要做的事</label>
              <input className="input" value={w.text} onChange={(e) => patch(w.id, { text: e.target.value })} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label className="admin-check">
                <input type="checkbox" checked={w.done} onChange={(e) => patch(w.id, { done: e.target.checked })} />
                已兑现
              </label>
            </div>
          </div>
        </div>
      ))}
      <button className="btn admin-add" onClick={() => setList([...d.wishes, { id: uid(), text: "新的约定…", done: false }])}>
        ＋ 添加约定
      </button>
    </>
  );
}

/* ---------- 表单:信件墙(双向信) ---------- */
function LettersForm({ d, edit }: { d: Content; edit: (fn: (d: Content) => Content) => void }) {
  const list = d.letters;
  const setList = (ls: LetterContent[]) => edit((x) => ({ ...x, letters: ls }));
  const patch = (id: string, p: Partial<LetterContent>) => setList(list.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const arr = [...list];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setList(arr);
  };
  return (
    <>
      <h3>信件墙</h3>
      <p className="hint">
        双向的信:一人一封,各写各的。换行会原样保留——像真的信纸一样,该分段就分段。
      </p>
      {list.map((l, i) => (
        <div className="admin-item" key={l.id}>
          <div className="admin-item-top">
            <span className="idx">LETTER {String(i + 1).padStart(2, "0")} · {l.from || "未署名"} → {l.to || "?"}</span>
            <div className="admin-item-ops">
              <button className="mini-btn" onClick={() => move(i, -1)}>↑ 上移</button>
              <button className="mini-btn" onClick={() => move(i, 1)}>↓ 下移</button>
              <button className="mini-btn danger" onClick={() => setList(list.filter((x) => x.id !== l.id))}>✕ 删除</button>
            </div>
          </div>
          <div className="admin-form-row">
            <div className="full">
              <label className="field">信件标题</label>
              <input className="input" value={l.title} onChange={(e) => patch(l.id, { title: e.target.value })} />
            </div>
            <div>
              <label className="field">写信人(落款)</label>
              <input className="input" value={l.from} onChange={(e) => patch(l.id, { from: e.target.value })} />
            </div>
            <div>
              <label className="field">收信人</label>
              <input className="input" value={l.to} onChange={(e) => patch(l.id, { to: e.target.value })} />
            </div>
            <div className="full">
              <label className="field">日期</label>
              <input className="input" type="date" value={l.date} onChange={(e) => patch(l.id, { date: e.target.value })} />
            </div>
            <div className="full">
              <label className="field">正文</label>
              <textarea className="textarea" style={{ minHeight: 300 }} value={l.content} onChange={(e) => patch(l.id, { content: e.target.value })} />
            </div>
          </div>
        </div>
      ))}
      <button
        className="btn admin-add"
        onClick={() => setList([...list, { id: uid(), title: "新的一封信", content: "", from: "", to: "", date: new Date().toISOString().slice(0, 10) }])}
      >
        ＋ 添加一封信
      </button>
    </>
  );
}

/* ---------- 图片输入:选文件即完成(自动压缩内嵌) ---------- */
function PhotoInput({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const pick = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setErr("");
    try {
      onChange(await compressImage(f));
      setShowUrl(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="photo-input">
      {value && <img src={value} alt="预览" />}
      <div>
        <div className="photo-input-actions">
          <label className="btn" style={{ display: "inline-block", padding: "8px 16px" }}>
            {busy ? "处理中…" : value ? "📷 更换图片" : "📷 选择图片"}
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
          <button className="mini-btn" onClick={() => setShowUrl((v) => !v)}>使用图片链接</button>
          {err && <span className="err-text">{err}</span>}
        </div>
        <p className="photo-input-hint">选完即自动压缩保存,点顶部「保存到 GitHub」同步,无需其他操作。</p>
        {showUrl && (
          <input
            className="input"
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://图片链接"
            style={{ marginTop: 8 }}
          />
        )}
      </div>
    </div>
  );
}
