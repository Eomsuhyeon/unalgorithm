import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import { Report } from "./Report";

function App() {
  const [screen, setScreen] = useState<"popup" | "report">("popup");

  if (screen === "report") {
    return <Report onBack={() => setScreen("popup")} />;
  }
  return <Popup onNavigateToReport={() => setScreen("report")} />;
}

const container = document.getElementById("root")!;
createRoot(container).render(<App />);
