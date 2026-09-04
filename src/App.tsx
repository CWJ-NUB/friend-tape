import { useEffect, useRef, useState } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { ContentProvider } from "./content/ContentContext";
import Navbar from "./components/Navbar";
import ProjectorTransition from "./components/ProjectorTransition";
import Sparkle from "./components/Sparkle";
import MusicPlayer from "./components/MusicPlayer";
import Home from "./pages/Home";
import Story from "./pages/Story";
import Gallery from "./pages/Gallery";
import Letter from "./pages/Letter";
import Quotes from "./pages/Quotes";
import Wishes from "./pages/Wishes";
import Guestbook from "./pages/Guestbook";
import Admin from "./pages/Admin";

function Shell() {
  const location = useLocation();
  const [displayLoc, setDisplayLoc] = useState(location);
  const [transitioning, setTransitioning] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (location.pathname === displayLoc.pathname) return;
    setTransitioning(true);
    const t = setTimeout(() => {
      setDisplayLoc(location);
      setTransitioning(false);
      window.scrollTo(0, 0);
    }, 700);
    return () => clearTimeout(t);
  }, [location, displayLoc]);

  return (
    <>
      <Navbar />
      <Routes location={displayLoc}>
        <Route path="/" element={<Home />} />
        <Route path="/story" element={<Story />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/letter" element={<Letter />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/wishes" element={<Wishes />} />
        <Route path="/guestbook" element={<Guestbook />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <ProjectorTransition active={transitioning} />
      <MusicPlayer />
      <Sparkle />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ContentProvider>
        <Shell />
      </ContentProvider>
    </HashRouter>
  );
}
