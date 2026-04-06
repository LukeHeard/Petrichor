"use client";

export default function Home() {
  return (
    <div>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Home</span></h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Dashboard & Overview</p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="section-label">Currently Reading</h2>
        <div className="thin-divider" style={{ marginTop: 0 }} />

        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>You aren't reading anything right now.</p>
        </div>
      </section>

      <section style={{ marginTop: '3rem' }}>
        <h2 className="section-label">Recent Activity</h2>
        <div className="thin-divider" style={{ marginTop: 0 }} />
        <div style={{ padding: '1rem 0' }}>
          <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No recent activity to show.</p>
        </div>
      </section>
      
    </div>
  );
}
