import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./themes/base.css";
import "./themes/light.css";
import "./themes/dark.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
