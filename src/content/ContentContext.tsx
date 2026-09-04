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
  /** 行内编辑模式 */
  editing: boolean;
  dirty: boolean;
  startEditing: () => void;
  discardEditing: () => void;
  update: (fn: (c: Content) => Content) => void;
  save: () => Promise<void>;
}

const Ctx = createContext<ContentCtx>({} as ContentCtx);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content | null>(null);
  const [version, setVersion] = useState(0);
  const [auth, setAuth] = useState<GhAuth | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
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

  const startEditing = () => {
    backup.current = content ? (structuredClone(content) as Content) : null;
    setEditing(true);
  };

  const discardEditing = () => {
    if (backup.current) setContent(backup.current);
    backup.current = null;
    setDirty(false);
    setEditing(false);
  };

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
