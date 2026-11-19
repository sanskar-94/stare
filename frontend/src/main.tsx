import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ServerStatusProvider } from "./hooks/useServerStatus";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ServerStatusProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ServerStatusProvider>
    </BrowserRouter>
  </StrictMode>,
);
