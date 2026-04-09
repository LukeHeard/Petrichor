"use client";

export default function More() {
  return (
    <div>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>More</span></h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Insights & Settings</p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="thin-divider" style={{ marginTop: 0 }} />

        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Advanced reading statistics coming soon.</p>
        </div>
      </section>
    </div>
  );
}
