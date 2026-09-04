/** 液态转场:切换板块时全屏雾面玻璃 + 液态旋转环 */
export default function ProjectorTransition({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="projector-overlay no-spark" aria-hidden>
      <div className="projector-middle">
        <div className="projector-orb" />
        <div className="projector-reel">REWINDING</div>
        <div className="projector-msg">LIQUID TRANSITION…</div>
      </div>
    </div>
  );
}
