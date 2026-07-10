"use client";

import { useEffect, useState, useMemo } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface KindleSettings {
  configured: boolean;
  has_ubid_main: boolean;
  has_at_main: boolean;
  has_x_main: boolean;
  has_session_id: boolean;
  has_device_token: boolean;
  source?: string | null;
}

interface Work {
  id: number;
  title: string;
  status: string;
  page_count: number;
  current_page: number;
}

interface KindleBook {
  asin: string;
  title: string;
  authors: string[];
  cover_url?: string;
  linked_work_id?: number | null;
}

interface SyncedBook {
  work_id: number;
  work_title: string;
  asin: string;
  percentage: number | null;
  old_page: number;
  new_page: number;
  session_created: boolean;
  note?: string | null;
}

export default function SettingsPage() {
  const [kindle, setKindle] = useState<KindleSettings | null>(null);
  const [works, setWorks] = useState<Work[]>([]);

  // Credential form (one field per cookie)
  const [ubidMain, setUbidMain] = useState("");
  const [atMain, setAtMain] = useState("");
  const [xMain, setXMain] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Library / sync
  const [books, setBooks] = useState<KindleBook[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ synced: SyncedBook[]; errors: string[] } | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});

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
    fetch(`${API}/works`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Work[]) => setWorks([...data].sort((a, b) => a.title.localeCompare(b.title))))
      .catch(() => {});
  }, []);

  const worksById = useMemo(() => {
    const map = new Map<number, Work>();
    works.forEach((w) => map.set(w.id, w));
    return map;
  }, [works]);

  const saveKindle = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!ubidMain.trim()) missing.push("ubid-main");
    if (!atMain.trim()) missing.push("at-main");
    if (!xMain.trim()) missing.push("x-main");
    if (!sessionId.trim()) missing.push("session-id");
    if (!deviceToken.trim()) missing.push("device token");
    if (missing.length) {
      setMessage({ text: `Please fill in: ${missing.join(", ")}`, ok: false });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/settings/kindle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ubid_main: ubidMain,
          at_main: atMain,
          x_main: xMain,
          session_id: sessionId,
          device_token: deviceToken,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Save failed (HTTP ${res.status})`);
      }
      setKindle(await res.json());
      setUbidMain("");
      setAtMain("");
      setXMain("");
      setSessionId("");
      setDeviceToken("");
      setMessage({ text: "Credentials saved ✓", ok: true });
    } catch (err) {
      // Network failures (proxy/backend down) land here with a TypeError.
      setMessage({
        text: err instanceof Error ? err.message : "Save failed — is the backend running?",
        ok: false,
      });
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
        setBooks([]);
        setSyncResult(null);
        setMessage({ text: "Saved credentials cleared.", ok: true });
      }
    } catch {
      setMessage({ text: "Could not clear credentials", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const loadLibrary = async () => {
    setLoadingLibrary(true);
    setError(null);
    try {
      const res = await fetch(`${API}/kindle/library`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setBooks(data.books);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Kindle library");
    } finally {
      setLoadingLibrary(false);
    }
  };

  const linkBook = async (asin: string, workId: string) => {
    if (!workId) return;
    try {
      const res = await fetch(`${API}/kindle/link/${workId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin }),
      });
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) =>
            b.asin === asin
              ? { ...b, linked_work_id: parseInt(workId) }
              : b.linked_work_id === parseInt(workId)
              ? { ...b, linked_work_id: null }
              : b
          )
        );
      }
    } catch {
      /* no-op */
    }
  };

  const unlinkBook = async (asin: string, workId: number) => {
    try {
      const res = await fetch(`${API}/kindle/link/${workId}`, { method: "DELETE" });
      if (res.ok) {
        setBooks((prev) => prev.map((b) => (b.asin === asin ? { ...b, linked_work_id: null } : b)));
      }
    } catch {
      /* no-op */
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch(`${API}/kindle/sync`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Sync failed (${res.status})`);
      }
      setSyncResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const linkedCount = books.filter((b) => b.linked_work_id).length;

  const cookieFields: { label: string; value: string; set: (v: string) => void; saved?: boolean }[] = [
    { label: "ubid-main", value: ubidMain, set: setUbidMain, saved: kindle?.has_ubid_main },
    { label: "at-main", value: atMain, set: setAtMain, saved: kindle?.has_at_main },
    { label: "x-main", value: xMain, set: setXMain, saved: kindle?.has_x_main },
    { label: "session-id", value: sessionId, set: setSessionId, saved: kindle?.has_session_id },
  ];

  const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: "0.8rem" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: "760px" }}>
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
            {kindle?.source === "mock"
              ? "● Demo mode (KINDLE_MOCK)"
              : kindle?.configured
              ? `● Connected${kindle.source === "environment" ? " (via env)" : ""}`
              : "○ Not connected"}
          </span>
        </div>

        {kindle?.source === "mock" && (
          <div
            style={{
              padding: "0.6rem 0.9rem",
              marginBottom: "1rem",
              borderRadius: "8px",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              fontSize: "0.82rem",
              lineHeight: 1.5,
            }}
          >
            <strong>Demo mode is on.</strong> KINDLE_MOCK is set, so the library and sync return
            fake data and any credentials you save here are ignored. Remove KINDLE_MOCK from your
            .env and restart the backend to use real Kindle data.
          </div>
        )}
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
          Pull Whispersync reading progress from Amazon into your library. Grab these from a
          logged-in{" "}
          <a href="https://read.amazon.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            read.amazon.com
          </a>{" "}
          browser session (DevTools → Application → Cookies for the four cookies; Network →{" "}
          <code>getDeviceToken</code> → <code>serialNumber</code> for the token). Take them all from
          the same session. Values are stored on your server only and never shown again after saving.
        </p>

        <form onSubmit={saveKindle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "0.75rem 1rem",
              marginBottom: "1rem",
            }}
          >
            {cookieFields.map((f) => (
              <div className="form-group" key={f.label} style={{ marginBottom: 0 }}>
                <label>Cookie · {f.label}</label>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.saved ? "•••••• saved — paste to replace" : `${f.label} value`}
                  style={mono}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ))}
          </div>

          <div className="form-group">
            <label>
              Device Token{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                (getDeviceToken → serialNumber)
              </span>
            </label>
            <input
              type="text"
              value={deviceToken}
              onChange={(e) => setDeviceToken(e.target.value)}
              placeholder={kindle?.has_device_token ? "•••••• saved — paste to replace" : "device token"}
              style={mono}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {message && (
            <p style={{ color: message.ok ? "var(--accent)" : "#c0554e", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {message.text}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save Credentials"}
            </button>
            {kindle?.source === "saved" && (
              <button type="button" className="btn-ghost" onClick={clearKindle} disabled={saving}>
                Clear Saved
              </button>
            )}
            {(kindle?.has_at_main || kindle?.has_device_token) && (
              <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                Saved on server — fields stay blank for security.
              </span>
            )}
          </div>
        </form>

        {/* Library & sync — only once credentials work */}
        {kindle?.configured && (
          <div style={{ marginTop: "1.75rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn-primary" onClick={loadLibrary} disabled={loadingLibrary}>
                {loadingLibrary ? "Loading…" : books.length ? "Reload Library" : "Load Kindle Library"}
              </button>
              <button
                className="btn-ghost"
                onClick={runSync}
                disabled={syncing || linkedCount === 0}
                title={linkedCount === 0 ? "Link at least one book first" : "Pull progress for linked books"}
              >
                {syncing ? "Syncing…" : "Sync Progress Now"}
              </button>
              {books.length > 0 && (
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {linkedCount} of {books.length} linked
                </span>
              )}
            </div>

            {error && (
              <div style={{ padding: "0.75rem 1rem", marginBottom: "1.25rem", border: "1px solid var(--accent)", borderRadius: "8px", color: "var(--accent)" }}>
                {error}
              </div>
            )}

            {syncResult && (
              <div className="kindle-card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
                <h3 style={{ marginBottom: "0.75rem" }}>Sync results</h3>
                {syncResult.synced.length === 0 && syncResult.errors.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>No linked books to sync.</p>
                )}
                {syncResult.synced.map((s) => (
                  <div
                    key={s.asin}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{s.work_title}</span>
                    <span style={{ color: s.session_created ? "var(--accent)" : "var(--muted)", fontSize: "0.85rem", textAlign: "right" }}>
                      {s.session_created
                        ? `+${s.new_page - s.old_page}p (now p${s.new_page}${s.percentage != null ? `, ${s.percentage}%` : ""})`
                        : s.note || "No change"}
                    </span>
                  </div>
                ))}
                {syncResult.errors.map((e, i) => (
                  <div key={i} style={{ color: "var(--accent)", fontSize: "0.85rem", paddingTop: "0.5rem" }}>
                    {e}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {books.map((book) => {
                const linkedWork = book.linked_work_id ? worksById.get(book.linked_work_id) : null;
                return (
                  <div
                    key={book.asin}
                    className="kindle-card"
                    style={{ display: "flex", gap: "1rem", padding: "0.75rem 1rem", alignItems: "center" }}
                  >
                    {book.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        style={{ width: "40px", height: "60px", objectFit: "cover", borderRadius: "3px", flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: "40px", height: "60px", background: "var(--border)", borderRadius: "3px", flexShrink: 0 }} />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {book.title}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {book.authors.join(", ")}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {linkedWork ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 600 }}>
                            ✓ {linkedWork.title}
                          </span>
                          <button
                            className="btn-ghost"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => unlinkBook(book.asin, linkedWork.id)}
                          >
                            Unlink
                          </button>
                        </div>
                      ) : (
                        <select
                          value={linkChoice[book.asin] || ""}
                          onChange={(e) => {
                            setLinkChoice((prev) => ({ ...prev, [book.asin]: e.target.value }));
                            linkBook(book.asin, e.target.value);
                          }}
                          style={{ maxWidth: "220px" }}
                        >
                          <option value="">Link to book…</option>
                          {works.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {books.length === 0 && !loadingLibrary && (
              <p style={{ color: "var(--muted)" }}>
                Load your Kindle library to link books and sync progress.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
