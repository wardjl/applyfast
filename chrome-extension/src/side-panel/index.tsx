import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ConvexProvider } from "./lib/convex";
import { JobsLookupProvider } from "./lib/JobsLookupContext";
import { ScoringContextProvider } from "./lib/ScoringContextProvider";
import "../../../app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider>
      <JobsLookupProvider>
        <ScoringContextProvider>
          <App />
        </ScoringContextProvider>
      </JobsLookupProvider>
    </ConvexProvider>
  </React.StrictMode>
);
