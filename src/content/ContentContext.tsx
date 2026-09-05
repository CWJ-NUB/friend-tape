import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Content } from "./types";
import { normalizeContent } from "./normalize";
import { fetchContent, loadAuth, pushContent, type GhAuth } from "../lib/github";

interface ContentCtx {
  content: Content | null;
  reload: () => Promise<void>;
  /** 直接替换内存中的内容(编辑中心保存后调用,避免读到线上尚未重建的旧版本) */
  applyContent: (c: Content) => void;
  /** 已保存的 GitHub 凭证(连接过编辑中心即存在) */
  auth: GhAuth | null;
  refreshAuth: () => void;
  /** 口令解锁状态(本浏览器会话内有效) */
  unlocked: boolean;
  /** 校验口令:与 content.json 中的 editPassHash 比对,通过即解锁本会话 */
  unlock: (pass: string) => Promise<boolean>;
  /** 锁定:清除本机会话解锁状态 */
  lock: () => void;
  /** 口令验证弹窗(全站共用) */
  gateOpen: boolean;
  gateDone: (() => void) | null;
  openGate: (done?: () => void) => void;
  closeGate: () => void;
  /** 行内编辑模式 */
  editing: boolean;
  dirty: boolean;
  startEditing: () => void;
  discardEditing: () => void;
  update: (fn: (c: Content) => Content) => void;
  save: () => Promise<void>;
}

const Ctx = createContext<ContentCtx>({} as ContentCtx);

const UNLOCK_KEY = "ft-edit-unlock";

async function sha256Hex(text: string): Promise<string> {
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Sync(text);
}

/** 纯 JS SHA-256 降级实现(crypto.subtle 仅在 https/localhost 可用) */
function sha256Sync(text: string): string {
  const rightRotate = (v: number, a: number) => (v >>> a) | (v << (32 - a));
  const maxWord = Math.pow(2, 32);
  // 先转 UTF-8 字节,支持非 ASCII 口令
  const bytes = Array.from(new TextEncoder().encode(text)).map((b) => String.fromCharCode(b)).join("");
  let ascii = bytes + "\x80";
  while (ascii.length % 64 !== 56) ascii += "\x00";
  const bitLen = bytes.length * 8;
  const words: number[] = [];
  for (let i = 0; i < ascii.length; i++) {
    words[i >> 2] = (words[i >> 2] || 0) | (ascii.charCodeAt(i) << ((3 - (i % 4)) * 8));
  }
  words[words.length] = (bitLen / maxWord) | 0;
  words[words.length] = bitLen;

  let result = "";
  const isComposite: Record<number, number> = {};
  let hash: number[] = [];
  const k: number[] = [];
  for (let candidate = 2, pc = 0; pc < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[pc] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[pc++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}
export { sha256Hex };

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content | null>(null);
  const [version, setVersion] = useState(0);
  const [auth, setAuth] = useState<GhAuth | null>(null);
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  /** 口令验证弹窗开关 + 验证通过后的回调 */
  const [gateOpen, setGateOpen] = useState(false);
  const [gateDone, setGateDone] = useState<(() => void) | null>(null);
  /** 开启编辑时的内容备份,用于「放弃修改」一键还原 */
  const backup = useRef<Content | null>(null);

  useEffect(() => {
    setAuth(loadAuth());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`content.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then((raw) => {
        if (!cancelled) setContent(normalizeContent(raw));
      })
      .catch(() => alert("内容加载失败,请刷新重试"));
    return () => {
      cancelled = true;
    };
  }, [version]);

  // 编辑模式标记到 body,控制删除/添加按钮等显隐
  useEffect(() => {
    document.body.classList.toggle("editing", editing);
    return () => document.body.classList.remove("editing");
  }, [editing]);

  const discardEditing = () => {
    if (backup.current) setContent(backup.current);
    backup.current = null;
    setDirty(false);
    setEditing(false);
  };

  const startEditing = () => {
    // 门禁:未通过口令验证不允许开启编辑
    if (!unlocked) return;
    backup.current = content ? (structuredClone(content) as Content) : null;
    setEditing(true);
  };

  /** 校验口令(SHA-256 比对,含纯 JS 降级),通过即解锁本浏览器会话 */
  const unlock = async (pass: string) => {
    const hash = content?.site.editPassHash?.trim().toLowerCase();
    if (!hash) return false;
    const h = await sha256Hex(pass);
    if (h !== hash) return false;
    try {
      sessionStorage.setItem(UNLOCK_KEY, "1");
    } catch {
      /* ignore */
    }
    setUnlocked(true);
    return true;
  };

  const lock = () => {
    try {
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch {
      /* ignore */
    }
    setUnlocked(false);
    if (editing) discardEditing();
  };

  const openGate = (done?: () => void) => {
    setGateDone(done ? () => done : null);
    setGateOpen(true);
  };
  const closeGate = () => setGateOpen(false);

  const update = (fn: (c: Content) => Content) => {
    setContent((c) => (c ? fn(c) : c));
    setDirty(true);
  };

  /** 保存:先取远端最新 sha(防止覆盖对方刚保存的修改),再推送当前内容 */
  const save = async () => {
    if (!auth || !content) throw new Error("尚未连接仓库,请先到编辑中心连接");
    const { sha } = await fetchContent(auth);
    const next = { ...content, site: { ...content.site, updatedAt: new Date().toISOString().slice(0, 10) } };
    await pushContent(auth, next, sha);
    setContent(next);
    backup.current = null;
    setDirty(false);
    setEditing(false);
  };

  return (
    <Ctx.Provider
      value={{
        content,
        reload: async () => setVersion((v) => v + 1),
        applyContent: (c) => setContent(c),
        auth,
        refreshAuth: () => setAuth(loadAuth()),
        unlocked,
        unlock,
        lock,
        gateOpen,
        gateDone,
        openGate,
        closeGate,
        editing,
        dirty,
        startEditing,
        discardEditing,
        update,
        save,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useContent = () => useContext(Ctx);
