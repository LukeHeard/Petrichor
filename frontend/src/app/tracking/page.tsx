"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Work {
  id: number;
  title: string;
  status: string;
  page_count: number;
}

interface ReadingSession {
  id: number;
  date: string;
  start_page: number;
  end_page: number;
  minutes_read: number;
  work_id: number;
  work_title: string;
  work_thumbnail_url?: string;
}

export default function Tracking() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewSession, setViewSession] = useState<ReadingSession | null>(null);

  // Form State (New Session)
  const [selectedWorkId, setSelectedWorkId] = useState<string>("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [minutesRead, setMinutesRead] = useState("");

  // Edit State
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editStartPage, setEditStartPage] = useState("");
  const [editEndPage, setEditEndPage] = useState("");
  const [editMinutesRead, setEditMinutesRead] = useState("");
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const fetchTrackingData = async () => {
    try {
      const [sessRes, worksRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`)
      ]);
      let lastWorkId = null;
      if (sessRes.ok) {
        const data: ReadingSession[] = await sessRes.json();
        setSessions(data);
        if (data.length > 0) {
          const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          lastWorkId = String(sorted[0].work_id);
        }
      }
      if (worksRes.ok) {
        const worksData = await worksRes.json();
        worksData.sort((a: Work, b: Work) => {
          if (a.status === "Currently Reading" && b.status !== "Currently Reading") return -1;
          if (b.status === "Currently Reading" && a.status !== "Currently Reading") return 1;
          return a.title.localeCompare(b.title);
        });
        setWorks(worksData);
        if (lastWorkId) {
          setSelectedWorkId(lastWorkId);
        } else if (worksData.length > 0) {
          setSelectedWorkId(String(worksData[0].id));
        }
      }
    } catch (err) {
      console.error("Failed to fetch tracking data", err);
    }
  };

  useEffect(() => {
    fetchTrackingData();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const currentMonthDate = new Date();
  const isCurrentMonthView = currentDate.getFullYear() === currentMonthDate.getFullYear() && 
                             currentDate.getMonth() === currentMonthDate.getMonth();

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkId || !startPage || !endPage) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_id: parseInt(selectedWorkId),
          date: logDate,
          start_page: parseInt(startPage),
          end_page: parseInt(endPage),
          minutes_read: minutesRead ? parseInt(minutesRead) : 0
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setStartPage("");
        setEndPage("");
        setMinutesRead("");
        fetchTrackingData();
      }
    } catch (err) {
      console.error("Failed to log reading session", err);
    }
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    const firstDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  }, [currentDate]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaySessions = (dateValue: Date) => {
    const dateStr = dateValue.toISOString().split('T')[0];
    return sessions.filter(s => s.date === dateStr);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const handleDayClick = (dateStr: string) => {
    setLogDate(dateStr);
    setIsModalOpen(true);
  };

  const handleCoverClick = (e: React.MouseEvent, session: ReadingSession) => {
    e.stopPropagation();
    setViewSession(session);
    setIsEditingSession(false);
    setIsDeletingSession(false);
    setEditDate(session.date);
    setEditStartPage(String(session.start_page));
    setEditEndPage(String(session.end_page));
    setEditMinutesRead(String(session.minutes_read));
  };

  const handleUpdateSession = async () => {
    if (!viewSession) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions/${viewSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editDate,
          start_page: parseInt(editStartPage),
          end_page: parseInt(editEndPage),
          minutes_read: parseInt(editMinutesRead)
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setViewSession(updated);
        setIsEditingSession(false);
        fetchTrackingData();
      }
    } catch (err) {
      console.error("Failed to update session", err);
    }
  };

  const handleDeleteSession = async () => {
    if (!viewSession) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions/${viewSession.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setViewSession(null);
        fetchTrackingData();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Tracking</span></h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Reading Calendar & Goals</p>
        </div>
        <button className="btn-primary" onClick={() => {
          setIsModalOpen(true);
          setLogDate(new Date().toISOString().split('T')[0]);
        }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>+</span> Log Reading
        </button>
      </header>

      <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem' }}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={handlePrevMonth}>&larr;</button>
            <button 
              className={isCurrentMonthView ? "btn-ghost" : "btn-primary"} 
              style={{ padding: '0.4rem 0.8rem', opacity: isCurrentMonthView ? 0.5 : 1 }} 
              disabled={isCurrentMonthView}
              onClick={() => setCurrentDate(new Date())}
            >
              Current
            </button>
            <button className="btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={handleNextMonth}>&rarr;</button>
          </div>
        </div>

        <div className="calendar-grid">
          {dayNames.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {calendarDays.map((dayObj, i) => {
            const dateStr = dayObj.date.toISOString().split('T')[0];
            const daySessions = getDaySessions(dayObj.date);
            const totalPages = daySessions.reduce((acc, s) => acc + (s.end_page - s.start_page), 0);
            const isToday = dateStr === todayStr;

            // Unique sessions having thumbnails (to show cover)
            const booksRead = Array.from(new Map(daySessions.filter(s => s.work_thumbnail_url).map(s => [s.work_id, s])).values());

            return (
              <div 
                key={i} 
                className={`calendar-cell ${!dayObj.isCurrentMonth ? 'is-outside-month' : ''} ${isToday ? 'is-today' : ''} ${totalPages > 0 ? 'has-activity' : ''}`}
                onClick={() => handleDayClick(dateStr)}
                style={{ cursor: 'pointer' }}
              >
                <div className="calendar-date-number">{dayObj.date.getDate()}</div>
                
                {totalPages > 0 && (
                  <div className="calendar-pages-count">
                    {totalPages}p
                  </div>
                )}
                
                <div className="calendar-activity-summary">
                  {booksRead.length > 0 && (
                    <div className="calendar-book-covers">
                      {booksRead.map(session => (
                        <img 
                          key={session.id} 
                          src={session.work_thumbnail_url} 
                          alt={session.work_title}
                          className="calendar-cover-thumb"
                          onClick={(e) => handleCoverClick(e, session)}
                          title={session.work_title}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {viewSession && (
        <div className="modal-overlay" onClick={() => { setViewSession(null); setIsEditingSession(false); setIsDeletingSession(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
              {isEditingSession && (
                <button 
                  onClick={() => {
                    if (isDeletingSession) handleDeleteSession();
                    else setIsDeletingSession(true);
                  }}
                  onMouseLeave={() => setIsDeletingSession(false)}
                  style={{
                    background: isDeletingSession ? '#ff4444' : 'none',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: isDeletingSession ? 'white' : 'var(--muted)',
                    padding: isDeletingSession ? '2px 8px' : '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    transition: 'all 0.2s ease'
                  }}
                  title="Delete session"
                >
                  {isDeletingSession ? "CONFIRM?" : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                  )}
                </button>
              )}
              
              <button 
                onClick={() => {
                  if (isEditingSession) {
                    handleUpdateSession();
                  } else {
                    setIsEditingSession(true);
                  }
                  setIsDeletingSession(false);
                }}
                style={{
                  background: isEditingSession ? 'var(--accent)' : 'none',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: isEditingSession ? 'var(--accent-foreground)' : 'var(--muted)',
                  padding: isEditingSession ? '2px 8px' : '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
                title={isEditingSession ? "Save changes" : "Edit session"}
              >
                {isEditingSession ? "SAVE" : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              {viewSession.work_thumbnail_url && (
                <img 
                  src={viewSession.work_thumbnail_url} 
                  alt={viewSession.work_title}
                  style={{ width: '100px', cursor: 'pointer', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  onClick={() => router.push(`?book_id=${viewSession.work_id}`)}
                  title="Click to see details"
                />
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: '1rem', lineHeight: 1.2, paddingRight: '4rem' }}>{viewSession.work_title}</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</span>
                    {isEditingSession ? (
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', width: '130px', outline: 'none' }} />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{viewSession.date}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Started</span>
                    {isEditingSession ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Page</span>
                        <input type="number" value={editStartPage} onChange={e => setEditStartPage(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', width: '60px', outline: 'none' }} />
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600 }}>Page {viewSession.start_page}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Finished</span>
                    {isEditingSession ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Page</span>
                        <input type="number" value={editEndPage} onChange={e => setEditEndPage(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', width: '60px', outline: 'none' }} />
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600 }}>Page {viewSession.end_page}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages Read</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {isEditingSession ? (parseInt(editEndPage) - parseInt(editStartPage)) || 0 : viewSession.end_page - viewSession.start_page}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Read</span>
                    {isEditingSession ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input type="number" value={editMinutesRead} onChange={e => setEditMinutesRead(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', width: '50px', outline: 'none' }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>min</span>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{viewSession.minutes_read} min</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions" style={{ marginTop: '2rem' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ width: '100%' }}
                onClick={() => setViewSession(null)}
              >
                {isEditingSession ? "Cancel" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>Log Reading</h3>
            <form onSubmit={handleLogSubmit}>
              <div className="form-group">
                <label>Book</label>
                <select value={selectedWorkId} onChange={e => setSelectedWorkId(e.target.value)} required>
                  {works.map(w => (
                    <option key={w.id} value={w.id}>{w.title} {w.status === 'Currently Reading' ? '(Reading)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Page Started</label>
                  <input type="number" min="0" value={startPage} onChange={e => setStartPage(e.target.value)} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Page Finished</label>
                  <input type="number" min="0" value={endPage} onChange={e => setEndPage(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label>Minutes Read (Optional)</label>
                <input type="number" min="0" value={minutesRead} onChange={e => setMinutesRead(e.target.value)} />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Session</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
