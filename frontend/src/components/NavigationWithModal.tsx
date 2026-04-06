"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AddWorkModal from "./AddWorkModal";

export default function NavigationWithModal() {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Helper function to dispatch event when work is added
  const handleWorkAdded = () => {
    window.dispatchEvent(new Event("petrichor:workAdded"));
    setIsModalOpen(false);
  };

  return (
    <>
      <nav className="bottom-nav">
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}>
          
          <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Home</span>
          </Link>
          
          <div className="nav-separator" />
          
          <Link href="/library" className={`nav-item ${pathname === '/library' ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
            <span>Library</span>
          </Link>

          {/* Center Plus Button with organic parenthesis curves */}
          <div className="nav-plus-wrapper">
            <svg style={{ color: 'var(--border)' }} xmlns="http://www.w3.org/2000/svg" width="12" height="32" viewBox="0 0 12 32">
              <path d="M 10 2 C 2 8, 2 24, 10 30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            
            <button className="nav-plus-btn" onClick={() => setIsModalOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
            
            <svg style={{ color: 'var(--border)' }} xmlns="http://www.w3.org/2000/svg" width="12" height="32" viewBox="0 0 12 32">
              <path d="M 2 2 C 10 8, 10 24, 2 30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          
          <Link href="/tracking" className={`nav-item ${pathname === '/tracking' ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            <span>Tracking</span>
          </Link>
          
          <div className="nav-separator" />
          
          <Link href="/stats" className={`nav-item ${pathname === '/stats' ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            <span>Stats</span>
          </Link>

        </div>
      </nav>

      {/* Global Add Book Modal */}
      <AddWorkModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onWorkAdded={handleWorkAdded} 
      />
    </>
  );
}
