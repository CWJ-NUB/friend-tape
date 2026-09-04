import { useEffect, useRef, useState } from "react";
import { useContent } from "../content/ContentContext";

/** 复古磁带音乐播放器(曲目可在编辑中心更换) */
export default function MusicPlayer() {
  const { content } = useContent();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const url = content?.site.musicUrl ?? "";
  const title = content?.site.musicTitle ?? "背景音乐";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.load();
    setPlaying(false);
  }, [url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => alert("音乐播放失败:请检查音乐链接是否有效(可在编辑中心更换)"));
      setPlaying(true);
    }
  };

  if (!url) return null;

  return (
    <div className={`tape glass no-spark ${playing ? "playing" : ""}`} onClick={toggle} title="点击播放 / 暂停">
      <div className="tape-label">
        <b>SIDE A — OUR SONG</b>
        {title}
      </div>
      <div className="tape-window">
        <div className="tape-reel" />
        <div className="tape-tape-line" />
        <div className="tape-reel" />
      </div>
      <div className="tape-controls">
        <button className="tape-btn" onClick={(e) => { e.stopPropagation(); toggle(); }}>
          {playing ? "❚❚ PAUSE" : "▶ PLAY"}
        </button>
        <span className="tape-hint">CLICK TAPE TO {playing ? "PAUSE" : "PLAY"}</span>
      </div>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} loop />
    </div>
  );
}
