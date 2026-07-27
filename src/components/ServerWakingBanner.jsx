import { useEffect, useState } from "react";
import { onServerWaking } from "../services/apiRetry";

// Shown whenever any in-flight API request is being retried against a
// sleeping backend. Global rather than per-page, because the cold start
// affects whatever screen the visitor happens to land on first — the
// dashboard, the student list, or the login form.
function ServerWakingBanner() {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => onServerWaking(setIsWaking), []);

  if (!isWaking) return null;

  return (
    <div className="server-waking-banner" role="status" aria-live="polite">
      <span className="server-waking-spinner" aria-hidden="true" />
      <span>
        Waking the server — this takes up to 60 seconds on the free tier.
        Retrying automatically.
      </span>
    </div>
  );
}

export default ServerWakingBanner;
