import type { Content } from "../content/types";

export interface GhAuth {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

const API = "https://api.github.com";
const CONTENT_PATH = "public/content.json";

/** 从当前站点地址自动推断 GitHub 仓库(如 xxx.github.io/repo) */
export function inferGhTarget(): { owner: string; repo: string } | null {
  const { host, pathname } = window.location;
  const m = host.match(/^([^.]+)\.github\.io$/);
  if (!m) return null;
  const owner = m[1];
  const seg = pathname.split("/").filter(Boolean)[0];
  // 用户站点(owner.github.io 仓库)没有路径段;项目站点首段即仓库名
  const repo = seg ? decodeURIComponent(seg) : host;
  return { owner, repo };
}

export function loadAuth(): GhAuth | null {
  try {
    const raw = localStorage.getItem("ft-gh-auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth: GhAuth | null) {
  if (auth) localStorage.setItem("ft-gh-auth", JSON.stringify(auth));
  else localStorage.removeItem("ft-gh-auth");
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function gh(path: string, auth: GhAuth, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
  });
  return res;
}

/** 只带 Token 的裸请求(用于登录前的自动识别) */
async function ghRaw(path: string, token: string) {
  return fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

/**
 * 用 Token 自动定位网站仓库:读用户名 → 列仓库 → 找含 content.json 的那个。
 * 本地预览/任意环境都能用,用户不需要知道用户名仓库名这些概念。
 */
export async function locateRepoByToken(token: string): Promise<{ owner: string; repo: string } | null> {
  const uRes = await ghRaw("/user", token);
  if (!uRes.ok) {
    throw new Error(uRes.status === 401 ? "Token 无效或已过期,请重新生成一个" : `无法读取 GitHub 用户信息(HTTP ${uRes.status})`);
  }
  const owner: string = (await uRes.json()).login;
  const rRes = await ghRaw(`/users/${owner}/repos?per_page=100&sort=updated`, token);
  if (!rRes.ok) throw new Error(`无法读取仓库列表(HTTP ${rRes.status})`);
  const repos: { name: string; fork: boolean }[] = await rRes.json();
  const names = repos.filter((r) => !r.fork).slice(0, 15).map((r) => r.name);

  // 并行检查哪些仓库里有本站数据文件
  const hits = await Promise.all(
    names.map(async (name) => {
      try {
        const res = await ghRaw(`/repos/${owner}/${name}/contents/${CONTENT_PATH}`, token);
        return res.ok ? name : null;
      } catch {
        return null;
      }
    })
  );
  const found = hits.filter(Boolean) as string[];
  if (found.length === 0) return null;
  return { owner, repo: found[0] };
}

/** 拉取仓库中的 content.json */
export async function fetchContent(auth: GhAuth): Promise<{ content: Content; sha: string }> {
  const res = await gh(
    `/repos/${auth.owner}/${auth.repo}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(auth.branch)}&t=${Date.now()}`,
    auth
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      res.status === 404
        ? `仓库 ${auth.owner}/${auth.repo}(${auth.branch} 分支)中没有找到 ${CONTENT_PATH}。`
        : body.message || `GitHub 返回 ${res.status}`
    );
  }
  const data = await res.json();
  return { content: JSON.parse(base64ToUtf8(data.content)), sha: data.sha };
}

/** 保存 content.json 到仓库(图片以 dataURL 内嵌其中,随保存一并同步) */
export async function pushContent(auth: GhAuth, content: Content, sha: string): Promise<string> {
  const res = await gh(`/repos/${auth.owner}/${auth.repo}/contents/${CONTENT_PATH}`, auth, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `✏️ 网站内容更新(编辑模式 ${new Date().toLocaleString("zh-CN")})`,
      content: utf8ToBase64(JSON.stringify(content, null, 2)),
      sha,
      branch: auth.branch,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `保存失败(HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.content.sha as string;
}

/**
 * 图片压缩:选完文件自动缩放+压缩,返回 dataURL 直接嵌入内容数据。
 * 长边限制 1200px、JPEG 78 质量,单图约 80-180KB,保存时随内容一键同步。
 * SVG(体积小、可缩放)不压缩直接内嵌。
 */
export function compressImage(file: File, maxSide = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) {
      reject(new Error("请选择图片文件"));
      return;
    }
    if (file.type === "image/svg+xml") {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("文件读取失败"));
      r.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("浏览器不支持图片处理"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败,请换一张试试"));
    };
    img.src = url;
  });
}
