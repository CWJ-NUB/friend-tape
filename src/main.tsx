import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import "./styles/projector.css";
import "./styles/navbar.css";
import "./styles/home.css";
import "./styles/story.css";
import "./styles/gallery.css";
import "./styles/letter.css";
import "./styles/pages.css";
import "./styles/music-player.css";
import "./styles/admin.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
