import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for data fetching with loading and error states
 * Only shows loading on initial fetch, not on refreshes (prevents blink)
 */
export function useFetch(url, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedOnce = useRef(false);
  
  const refresh = () => {
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setError(null);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          let action = null;
          let message = null;
          let detail = null;
          try {
            const parsed = JSON.parse(text);
            if (parsed.action) action = parsed.action;
            if (parsed.message) message = parsed.message;
            if (parsed.detail) detail = parsed.detail;
          } catch {}
          
          if (action === "setup_required" || action === "credentials_required") {
            const err = new Error(message || "Database not initialized");
            err.action = action;
            err.detail = detail;
            throw err;
          }
          
          if (r.status === 403 && text.includes("Public access is not allowed for workspace")) {
            throw new Error("Not able to access Databricks workspace. Please enable VPN if applicable.");
          }
          
          throw new Error(`${r.status} ${r.statusText}: ${text || "Request failed"}`);
        }
        return r.json();
      })
      .then(d => setData(d))
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        setLoading(false);
        hasLoadedOnce.current = true;
      });
  };
  
  useEffect(refresh, deps);
  
  const clearError = () => setError(null);
  
  return { data, loading, error, refresh, clearError };
}

