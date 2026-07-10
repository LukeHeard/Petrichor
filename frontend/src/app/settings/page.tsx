"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

interface KindleSettings {
  configured: boolean;
  has_cookies: boolean;
  has_device_token: boolean;
  source?: string | null;
}

export default function SettingsPage() {
  const [kindle, setKindle] = useState<KindleSettings | null>(null);
  const [cookies, setCookies] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API}/settings`);
      if (res.ok) {
        const data = await res.json();
        setKindle(data.kindle);
      }
    } catch {
      /* no-op */
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveKindle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookies.trim() || !deviceToken.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/settings/kindle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, device_token: deviceToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Save failed (${res.status})`);
      }
      setKindle(await res.json());
      setCookies("");
      setDeviceToken("");
      setMessage({ text: "Kindle credentials saved.", ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Save failed", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const clearKindle = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/settings/kindle`, { method: "DELETE" });
      if (res.ok) {
        setKindle(await res.json());
        setMessage({ text: "Saved credentials cleared.", ok: true });
      }
    } catch {
      setMessage({ text: "Could not clear credentials", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: "720px" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>
          Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Settings</span>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", letterSpacing: "0.02em" }}>
          Integrations & preferences
        </p>
      </header>

      <section className="settings-section" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <h2 style={{ fontSize: "1.25rem" }}>Kindle Sync</h2>
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: kindle?.configured ? "var(--accent)" : "var(--muted)",
            }}
          >
            {kindle?.configured
              ? `● Connected${kindle.source === "environment" ? " (via env)" : ""}`
              : "○ Not connected"}
          </span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
          Pull Whispersync reading progress from Amazon into your library. Copy these from a
          logged-in{" "}
          <a href="https://read.amazon.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            read.amazon.com
          </a>{" "}
          browser session (DevTools → Network). Credentials are stored on your server only and
          never shown again after saving. Runs inside the existing backend — no extra service.
        </p>

        <form onSubmit={saveKindle}>
          <div className="form-group">
            <label>
              Cookies{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                (needs ubid-main, at-main, x-main, session-id)
              </span>
            </label>
            <textarea
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder={
                kindle?.has_cookies
                  ? "•••••••• saved — paste again to replace"
                  : "ubid-main=…; at-main=…; x-main=…; session-id=…"
              }
              rows={3}
              style={{
                width: "100%",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                resize: "vertical",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "0.6rem",
                color: "var(--foreground)",
              }}
            />
          </div>

          <div className="form-group">
            <label>
              Device Token{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                (getDeviceToken request → serialNumber)
              </span>
            </label>
            <input
              type="text"
              value={deviceToken}
              onChange={(e) => setDeviceToken(e.target.value)}
              placeholder={kindle?.has_device_token ? "•••••••• saved — paste again to replace" : "your device token"}
              style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
            />
          </div>

          {message && (
            <p style={{ color: message.ok ? "var(--accent)" : "#c0554e", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {message.text}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn-primary" disabled={saving || !cookies.trim() || !deviceToken.trim()}>
              {saving ? "Saving…" : "Save Credentials"}
            </button>
            {kindle?.source === "saved" && (
              <button type="button" className="btn-ghost" onClick={clearKindle} disabled={saving}>
                Clear Saved
              </button>
            )}
            {kindle?.configured && (
              <Link href="/kindle" className="btn-ghost" style={{ marginLeft: "auto" }}>
                Open Kindle Library →
              </Link>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
