import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Content } from "./types";
import { normalizeContent } from "./normalize";

interface ContentCtx {
  content: Content | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<ContentCtx>({ content: null, reload: async () => {} });

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`content.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then((raw) => { if (!cancelled) setContent(normalizeContent(raw)); })
      .catch(() => alert("内容加载失败,请刷新重试"));
    return () => { cancelled = true; };
  }, [version]);

  return (
    <Ctx.Provider value={{ content, reload: async () => setVersion((v) => v + 1) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useContent = () => useContext(Ctx);
