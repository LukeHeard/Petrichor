"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

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

export default function KindlePage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [books, setBooks] = useState<KindleBook[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ synced: SyncedBook[]; errors: string[] } | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/kindle/status`);
        const data = await res.json();
        setConfigured(data.configured);
      } catch {
        setConfigured(false);
      }
    })();
    fetch(`${API}/works`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Work[]) =>
        setWorks([...data].sort((a, b) => a.title.localeCompare(b.title)))
      )
      .catch(() => {});
  }, []);

  const worksById = useMemo(() => {
    const map = new Map<number, Work>();
    works.forEach((w) => map.set(w.id, w));
    return map;
  }, [works]);

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
            // A Work links to one ASIN, so clear this work off any other book too.
            b.asin === asin
              ? { ...b, linked_work_id: parseInt(workId) }
              : b.linked_work_id === parseInt(workId)
              ? { ...b, linked_work_id: null }
              : b
          )
        );
      }
    } catch {
      /* no-op; UI stays unlinked */
    }
  };

  const unlinkBook = async (asin: string, workId: number) => {
    try {
      const res = await fetch(`${API}/kindle/link/${workId}`, { method: "DELETE" });
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) => (b.asin === asin ? { ...b, linked_work_id: null } : b))
        );
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>
          Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Kindle</span>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", letterSpacing: "0.02em" }}>
          Sync Whispersync reading progress into your library
        </p>
      </header>

      {configured === false && (
        <div className="kindle-card" style={{ padding: "1.5rem", lineHeight: 1.6 }}>
          <h3 style={{ marginBottom: "0.75rem" }}>Not connected</h3>
          <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
            Add your Kindle credentials on the{" "}
            <Link href="/settings" style={{ color: "var(--accent)" }}>
              Settings page
            </Link>{" "}
            to enable syncing. They come from a logged-in{" "}
            <a href="https://read.amazon.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              read.amazon.com
            </a>{" "}
            browser session.
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", opacity: 0.8 }}>
            This runs entirely inside the existing backend container — no extra service required.
          </p>
        </div>
      )}

      {configured && (
        <>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
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
              <span style={{ alignSelf: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                {linkedCount} of {books.length} linked
              </span>
            )}
          </div>

          {error && (
            <div
              className="kindle-card"
              style={{ padding: "1rem", marginBottom: "1.5rem", borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              {error}
            </div>
          )}

          {syncResult && (
            <div className="kindle-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
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
                      style={{ width: "44px", height: "66px", objectFit: "cover", borderRadius: "3px", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: "44px", height: "66px", background: "var(--border)", borderRadius: "3px", flexShrink: 0 }} />
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
            <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
              Load your Kindle library to link books and sync progress.
            </p>
          )}
        </>
      )}
    </div>
  );
}
