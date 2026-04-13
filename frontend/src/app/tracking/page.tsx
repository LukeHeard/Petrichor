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

  // Form State
  const [selectedWorkId, setSelectedWorkId] = useState<string>("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [minutesRead, setMinutesRead] = useState("");

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

  const handleCoverClick = (e: React.MouseEvent, workId: number) => {
    e.stopPropagation();
    router.push(`?book_id=${workId}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Tracking</span></h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Reading Calendar & Goals</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            // Unique books read on this day
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
                          key={session.work_id} 
                          src={session.work_thumbnail_url} 
                          alt={session.work_title}
                          className="calendar-cover-thumb"
                          onClick={(e) => handleCoverClick(e, session.work_id)}
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
