import Giscus from "../components/Giscus";

export default function Guestbook() {
  return (
    <div className="page">
      <div className="page-tag">CHAPTER 06 · GUESTBOOK</div>
      <h2 className="page-title">留言板</h2>
      <p className="page-sub">
        这里留给来访的你,和任何被这卷胶片感动的人。想说的话,别憋着。
        <br />
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.15em" }}>
          登录 GITHUB 即可留言
        </span>
      </p>
      <Giscus />
    </div>
  );
}
