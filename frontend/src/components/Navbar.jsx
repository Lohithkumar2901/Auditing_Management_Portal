import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WheelsLogo from '../assets/WHEELS.png';

const BASE_LINKS = [
  { path: '/home',       label: 'Home' },
  { path: '/policies',   label: 'Policies' },
  { path: '/procedures', label: 'Procedures' },
  { path: '/formats',    label: 'Formats' },
  { path: '/trainings',  label: 'Trainings' },
  { path: '/dashboard',  label: 'Drills' },
];

const REVIEWER_LINKS = [
  { path: '/reviewer', label: 'Review Queue' },
];

const ADMIN_LINKS = [
  { path: '/admin-docs', label: 'Doc Approvals' },
  { path: '/admin',      label: 'Drill Admin' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = [
    ...BASE_LINKS,
    ...(user?.role === 'reviewer' || user?.role === 'admin' ? REVIEWER_LINKS : []),
    ...(user?.role === 'admin' ? ADMIN_LINKS : []),
  ];
  // auditor: same as base links only (read-only access)

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img
          src={WheelsLogo}
          alt="WIL"
          style={{ height: 38, width: 38, objectFit: 'contain', filter: 'brightness(0) invert(1)', flexShrink: 0 }}
        />
        <span>
          ISMS Compliance Portal</span>
      </div>

      <div className="navbar-links">
        {links.map((link, i) => {
          const showSep = i > 0 && link.path === '/reviewer';
          return (
            <React.Fragment key={link.path}>
              {showSep && <span className="nav-sep" />}
              <button
                className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="navbar-user">
        <div className="user-info">
          <span className="user-name">{user?.full_name}</span>
          <span className={`role-badge ${user?.role}`}>{user?.role}</span>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,.1)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
