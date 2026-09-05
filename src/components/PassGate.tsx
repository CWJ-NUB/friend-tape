import { useState, type FormEvent } from "react";
import { useContent } from "../content/ContentContext";

/** 口令验证卡片:overlay=全屏弹窗(导航/编辑按钮触发) inline=页面内嵌(编辑中心) */
export function PassGateForm({ onDone, autoFocus = true }: { onDone?: () => void; autoFocus?: boolean }) {
  const { unlock } = useContent();
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pass.trim() || busy) return;
    setBusy(true);
    setErr("");
    const ok = await unlock(pass.trim());
    setBusy(false);
    if (ok) {
      setPass("");
      onDone?.();
    } else {
      setErr("口令不正确,再试一次。");
    }
  };

  return (
    <form className="gate-card glass no-spark" onSubmit={submit}>
      <div className="gate-tag mono">ACCESS · 身份验证</div>
      <h3 className="gate-title">这是我的私人空间</h3>
      <p className="gate-sub">编辑内容需要口令验证,请输入访问口令。</p>
      <input
        className="gate-input"
        type="password"
        value={pass}
        autoFocus={autoFocus}
        placeholder="请输入口令"
        onChange={(e) => setPass(e.target.value)}
      />
      {err && <div className="gate-err">{err}</div>}
      <button className="btn btn-iri gate-btn" type="submit" disabled={busy || !pass.trim()}>
        {busy ? "验证中…" : "验证进入"}
      </button>
      <div className="gate-hint mono">口令错误多次?口令由空间主人在编辑中心管理</div>
    </form>
  );
}

/** 全站口令验证弹窗(挂载在 App 根,由 openGate 触发) */
export default function PassGate() {
  const { gateOpen, gateDone, closeGate } = useContent();
  if (!gateOpen) return null;
  return (
    <div className="gate-overlay no-spark" onClick={closeGate}>
      <div onClick={(e) => e.stopPropagation()}>
        <PassGateForm
          onDone={() => {
            closeGate();
            gateDone?.();
          }}
        />
      </div>
    </div>
  );
}
