import React from "react";
import { createRoot } from "react-dom/client";
import { NudgeButton } from "./nudge-button";
import { initializeLinkedInManualCapture } from "../shared/linkedin-parser";

if (typeof document !== "undefined" && document.body) {
  // Remove any stale containers from previous injections
  const existingContainer = document.getElementById(
    "applyfast-nudge-button-container"
  );
  if (existingContainer?.parentNode) {
    existingContainer.parentNode.removeChild(existingContainer);
  }

  // Create a container for our React app
  const container = document.createElement("div");
  container.id = "applyfast-nudge-button-container";

  // Use shadow DOM to isolate our styles from LinkedIn's styles
  const shadowRoot = container.attachShadow({ mode: "open" });

  // Create the root element inside shadow DOM
  const reactRoot = document.createElement("div");
  reactRoot.id = "applyfast-react-root";
  shadowRoot.appendChild(reactRoot);

  // Inject component-specific styles into the shadow DOM
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .applyfast-nudge-container {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      transform-origin: right center;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      pointer-events: auto;
      padding-right: 2px;
    }

    .applyfast-nudge-main {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      pointer-events: auto;
    }

    .applyfast-nudge-button {
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0px;
      padding: 8px 6px;
      background: rgba(255, 255, 255, 0.9);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      border-left: 1px solid rgba(255, 255, 255, 0.8);
      border-top: 1px solid rgba(255, 255, 255, 0.7);
      border-bottom: 1px solid rgba(255, 255, 255, 0.7);
      border-right: none;
      border-radius: 10px 0 0 10px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
      cursor: pointer;
      transform-origin: right center;
      transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease;
      opacity: 0;
      color: rgb(17, 24, 39);
      font: 600 12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      user-select: none;
      position: relative;
      background-image: none;
    }

    .applyfast-nudge-button--visible {
      animation: applyfast-nudge-fade-in 220ms ease-out forwards;
    }

    .applyfast-nudge-button:hover {
      transform: translateX(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .applyfast-nudge-button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35), 0 10px 24px rgba(0, 0, 0, 0.22);
    }

    .applyfast-nudge-button__icon {
      width: 20px;
      height: 28px;
      border-radius: 6px;
      background-position: center;
      background-repeat: no-repeat;
      background-size: contain;
      margin-bottom: 6px;
      transform: rotate(90deg);
      transform-origin: center;
      overflow: hidden;
    }

    .applyfast-nudge-button__label {
      text-align: center;
      pointer-events: none;
      line-height: 1.2;
    }

    .applyfast-nudge-drag {
      width: 6px;
      height: 44px;
      border-radius: 4px;
      background-image: radial-gradient(rgb(189, 189, 189) 1px, transparent 1px);
      background-size: 4px 4px;
      background-position: center center;
      cursor: ns-resize;
      opacity: 0.6;
      pointer-events: auto;
    }

    .applyfast-nudge-dismiss {
      pointer-events: none;
      order: -1;
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.92);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.78);
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16);
      color: rgba(17, 24, 39, 0.65);
      font: 700 11px/1 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 150ms ease, box-shadow 150ms ease, color 150ms ease, background 150ms ease, opacity 150ms ease;
      opacity: 0;
      transform: translateY(-4px);
      margin: 6px;
    }

    .applyfast-nudge-container:hover .applyfast-nudge-dismiss,
    .applyfast-nudge-container:focus-within .applyfast-nudge-dismiss {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .applyfast-nudge-dismiss:hover,
    .applyfast-nudge-dismiss:focus-visible {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
      color: rgba(17, 24, 39, 0.85);
      outline: none;
    }

    @keyframes applyfast-nudge-fade-in {
      from {
        opacity: 0;
        transform: translateX(16px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @media (max-width: 768px) {
      .applyfast-nudge-container {
        display: none;
      }
    }
  `;
  shadowRoot.appendChild(styleElement);

  // Append the container to the page
  document.body.appendChild(container);

  // Render the React component
  const root = createRoot(reactRoot);
  root.render(
    <React.StrictMode>
      <NudgeButton />
    </React.StrictMode>
  );

  initializeLinkedInManualCapture();

  // Cleanup on unload
  window.addEventListener("beforeunload", () => {
    root.unmount();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
}
