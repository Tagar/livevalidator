import { useState, useEffect } from 'react';

/**
 * Custom hook for data fetching with loading and error states
 */
export function useFetch(url, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const refresh = () => {
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`${r.status} ${r.statusText}: ${text || "Request failed"}`);
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };
  
  useEffect(refresh, deps);
  
  const clearError = () => setError(null);
  
  return { data, loading, error, refresh, clearError };
}

