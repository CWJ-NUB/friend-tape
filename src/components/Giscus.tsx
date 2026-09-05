import { useEffect, useRef } from "react";
import { useContent } from "../content/ContentContext";

/** giscus 留言板:配置可在编辑中心填写(需仓库开启 Discussions) */
export default function Giscus() {
  const { content } = useContent();
  const ref = useRef<HTMLDivElement>(null);
  const g = content?.site.giscus;

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    if (!g || !g.repo || !g.repoId || !g.categoryId) return;

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", g.repo);
    script.setAttribute("data-repo-id", g.repoId);
    script.setAttribute("data-category", g.category || "Announcements");
    script.setAttribute("data-category-id", g.categoryId);
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", "light");
    script.setAttribute("data-lang", "zh-CN");
    ref.current.appendChild(script);
  }, [g]);

  const ready = g && g.repo && g.repoId && g.categoryId;

  return (
    <div>
      {ready ? (
        <div ref={ref} className="no-spark" />
      ) : (
        <div className="glass no-spark" style={{ textAlign: "center", padding: "46px 24px" }}>
          <div className="mono" style={{ color: "var(--ink-3)", fontSize: 12, letterSpacing: "0.3em", marginBottom: 14 }}>
            COMMENT SYSTEM OFFLINE
          </div>
          <p style={{ color: "var(--ink-2)", lineHeight: 2, fontSize: 15 }}>
            留言板还没有接通。<br />
            部署到 GitHub 后,到「编辑中心 → 全站设置」填写 giscus 配置即可启用,<br />
            你和来访的朋友就都能在这里留下想说的话。
          </p>
          <a
            className="mono"
            href="https://giscus.app/zh-CN"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--accent)", fontSize: 12, letterSpacing: "0.2em" }}
          >
            → 前往 giscus.app 获取配置
          </a>
        </div>
      )}
    </div>
  );
}
