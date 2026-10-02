import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createAgentSource } from "./services/createAgentSource";
import "./styles/tokens.css";
import "./styles/base.css";

const source = createAgentSource();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App source={source} />
  </StrictMode>,
);
