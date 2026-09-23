import React from "react";
import { WarningIcon } from "./Icons.js";

interface ErrorPanelProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className="error-panel-container" role="alert">
      <div className="error-card">
        <span className="error-icon" aria-hidden="true"><WarningIcon /></span>
        <h2>SOMETHING WENT WRONG</h2>
        <p className="error-message">{message}</p>
        {onRetry && (
          <button type="button" className="retry-btn" onClick={onRetry} id="btn-retry">
            TRY AGAIN
          </button>
        )}
      </div>
    </div>
  );
}

export function LoadingScreen({ message = "LOADING RARE FRIENDS..." }: { message?: string }) {
  return (
    <div className="loading-screen-container" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <h2>{message}</h2>
      <p>Synchronizing mine shafts & checking Rare Friends eligibility...</p>
    </div>
  );
}
