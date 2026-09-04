import { useState } from "react";
import { useContent } from "../content/ContentContext";
import { compressImage } from "../lib/github";

export const euid = () => Math.random().toString(36).slice(2, 9);

/* ---------------- 单行文字:点击即改 ---------------- */
export function EText({
  value,
  onChange,
  placeholder = "点击填写",
  fallback = "",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 非编辑且为空时显示的占位文字 */
  fallback?: string;
  className?: string;
}) {
  const { editing } = useContent();
  const [on, setOn] = useState(false);

  if (!editing) return <span className={className}>{value || fallback}</span>;
  if (on)
    return (
      <input
        className={`einput ${className}`}
        autoFocus
        value={value}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setOn(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") setOn(false);
        }}
      />
    );
  return (
    <span
      className={`etag ${className}`}
      title="点击修改"
      onClick={(e) => {
        e.stopPropagation();
        setOn(true);
      }}
    >
      {value || <em className="eempty">{placeholder}</em>}
    </span>
  );
}

/* ---------------- 多行文字 ---------------- */
export function ETextarea({
  value,
  onChange,
  placeholder = "点击填写",
  className = "",
  minHeight = 88,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}) {
  const { editing } = useContent();
  if (!editing) return <span className={className}>{value}</span>;
  return (
    <textarea
      className={`etextarea ${className}`}
      style={{ minHeight }}
      value={value}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ---------------- 日期 ---------------- */
export function EDate({
  value,
  onChange,
  fallback = "未注明日期",
}: {
  value: string;
  onChange: (v: string) => void;
  fallback?: string;
}) {
  const { editing } = useContent();
  if (!editing) return <span>{value || fallback}</span>;
  return (
    <input
      className="edate"
      type="date"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ---------------- 图片:点击更换(自动压缩) ---------------- */
export function EImage({
  src,
  onChange,
  alt = "",
  imgClassName = "",
}: {
  src: string;
  onChange: (dataUrl: string) => void;
  alt?: string;
  imgClassName?: string;
}) {
  const { editing } = useContent();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!editing) return src ? <img className={imgClassName} src={src} alt={alt} /> : null;

  const pick = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setErr("");
    try {
      onChange(await compressImage(f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="eimg-block">
      {src && <img className={imgClassName} src={src} alt={alt} />}
      <label className={`eimg-btn ${src ? "" : "eimg-add"}`} onClick={(e) => e.stopPropagation()}>
        {busy ? "处理中…" : src ? "更换图片" : "＋ 添加图片"}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
      {err && <span className="eimg-err">{err}</span>}
    </span>
  );
}

/* ---------------- 卡片删除按钮(仅编辑模式显示) ---------------- */
export function EDel({ onClick, title = "删除" }: { onClick: () => void; title?: string }) {
  return (
    <button
      className="edel no-spark"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      ✕
    </button>
  );
}

/* ---------------- 列表添加按钮(仅编辑模式显示) ---------------- */
export function EAdd({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="eadd no-spark" onClick={onClick}>
      {label}
    </button>
  );
}

/* ---------------- 全局编辑 UI:开关 FAB + 保存条 ---------------- */
export function EditUI() {
  const { auth, editing, dirty, startEditing, discardEditing, save } = useContent();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  if (!auth) return null;

  if (!editing) {
    return (
      <button className="efab glass no-spark" title="开启编辑模式" onClick={startEditing}>
        ✎
      </button>
    );
  }

  const exit = () => {
    if (dirty && !confirm("还有未保存的修改,退出将丢弃这些修改。确定退出?")) return;
    discardEditing();
    setErr("");
  };

  const doSave = async () => {
    setBusy(true);
    setErr("");
    try {
      await save();
      setToast("已保存 · 约 1 分钟后线上生效");
      setTimeout(() => setToast(""), 3500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="ebar glass no-spark">
        <span className="ebar-state">✎ 编辑模式{dirty ? " · 有未保存修改" : ""}</span>
        <button className="btn btn-iri" disabled={busy || !dirty} onClick={doSave}>
          {busy ? "保存中…" : "保存"}
        </button>
        <button className="btn" disabled={busy} onClick={exit}>
          退出
        </button>
      </div>
      {err && <div className="ebar-err">{err}</div>}
      {toast && <div className="etoast">{toast}</div>}
    </>
  );
}
