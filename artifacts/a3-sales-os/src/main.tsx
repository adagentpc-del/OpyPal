import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installWorkspaceFetchInterceptor } from "./lib/fetch-interceptor";

installWorkspaceFetchInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
