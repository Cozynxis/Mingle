import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Admin from "./Admin";
import "./styles.css";
const root = document.getElementById("root");
if (root) createRoot(root).render(<React.StrictMode>{window.location.pathname.replace(/\/$/,"")==="/admin"?<Admin/>:<App/>}</React.StrictMode>);
