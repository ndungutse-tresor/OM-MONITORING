"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) router.push("/dashboard");
    else setError((await res.json()).error || "Sign in failed");
    setBusy(false);
  }

  return (
    <div className="loginwrap">
      <div className="logincard">
        <h1>Old Mutual Insurance Rwanda</h1>
        <p>Sign in to the infrastructure monitor.</p>
        <form className="form" onSubmit={submit}>
          <label>Username
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <div className="msg err">{error}</div>}
          <button className="btn" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
