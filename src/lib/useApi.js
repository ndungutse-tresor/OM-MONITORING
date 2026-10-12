"use client";
import { useCallback, useEffect, useState } from "react";

// Fetches JSON, sends the user to /login on 401, and re-polls every `every` ms.
export async function api(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Not signed in");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function usePoll(url, every = 10000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      setData(await api(url));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [url]);
  useEffect(() => {
    load();
    if (!every) return;
    const t = setInterval(load, every);
    return () => clearInterval(t);
  }, [load, every]);
  return { data, error, reload: load };
}
