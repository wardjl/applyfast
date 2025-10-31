import { useEffect, useState } from "react";

export function NudgeButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [dragTop, setDragTop] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    return window.innerHeight / 2;
  });
  const iconUrl =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("logo.png")
      : undefined;

  useEffect(() => {
    // Show immediately
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 0);

    // Listen for side panel state changes from background
    const handleMessage = (message: { type: string; isOpen?: boolean }) => {
      if (message.type === "SIDE_PANEL_STATE_CHANGED") {
        setIsPanelOpen(message.isOpen ?? false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Request current panel state
    chrome.runtime
      .sendMessage({ type: "GET_SIDE_PANEL_STATE" })
      .then((response: { isOpen: boolean }) => {
        if (response?.isOpen) {
          setIsPanelOpen(true);
        }
      })
      .catch(() => {
        // Ignore errors
      });

    return () => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setDragTop((prev) => {
        const fallback = window.innerHeight / 2;
        const currentTop = prev || fallback;
        const minTop = 60;
        const maxTop = window.innerHeight - 60;
        return Math.min(Math.max(currentTop, minTop), maxTop);
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleClick = () => {
    chrome.runtime
      .sendMessage({ type: "OPEN_SIDE_PANEL" })
      .catch((error) => {
        console.error("Failed to open side panel:", error);
      });
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleDragPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const fallbackTop = window.innerHeight / 2;
    const initialTop = dragTop || fallbackTop;
    const pointerId = event.pointerId;

    const clamp = (value: number) => {
      const minTop = 60;
      const maxTop = window.innerHeight - 60;
      return Math.min(Math.max(value, minTop), maxTop);
    };

    const handleMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const delta = moveEvent.clientY - startY;
      setDragTop(clamp(initialTop + delta));
    };

    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
      try {
        event.currentTarget.releasePointerCapture(pointerId);
      } catch {
        // Ignore errors from releasing pointer capture
      }
    };

    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      // Ignore failures to capture pointer
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
  };

  // Don't render if panel is open or not yet visible
  if (isPanelOpen || !isVisible || isDismissed) {
    return null;
  }

  const resolvedTop =
    dragTop || (typeof window !== "undefined" ? window.innerHeight / 2 : 0);

  return (
    <div
      className="applyfast-nudge-container"
      style={{ top: `${resolvedTop}px`, transform: "translateY(-50%)" }}
    >
      <div className="applyfast-nudge-main">
        <div
          className="applyfast-nudge-drag"
          role="presentation"
          aria-hidden="true"
          onPointerDown={handleDragPointerDown}
        />
        <button
          type="button"
          onClick={handleClick}
          className="applyfast-nudge-button applyfast-nudge-button--visible"
          aria-label="Open ApplyFast Copilot side panel"
        >
          {iconUrl ? (
            <span
              className="applyfast-nudge-button__icon"
              style={{ backgroundImage: `url(${iconUrl})` }}
              aria-hidden="true"
            />
          ) : null}
          <span className="applyfast-nudge-button__label">
            ApplyFast Copilot
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="applyfast-nudge-dismiss"
        aria-label="Hide ApplyFast Copilot nudge"
      >
        ×
      </button>
    </div>
  );
}
