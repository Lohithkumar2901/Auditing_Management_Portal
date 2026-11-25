import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/home',       label: 'Home Dashboard',    icon: '⊞' },
  { path: '/policies',   label: 'Policies',           icon: '📋' },
  { path: '/procedures', label: 'Procedures & SOPs',  icon: '📝' },
  { path: '/formats',    label: 'Formats',            icon: '📊' },
  { path: '/trainings',  label: 'Trainings',          icon: '🎓' },
];

const DRILL_ITEM  = { path: '/dashboard',  label: 'Drill Management', icon: '🔧' };
const REVIEW_ITEM = { path: '/reviewer',   label: 'Review Queue',     icon: '🔍' };
const ADMINDOC    = { path: '/admin-docs', label: 'Doc Approvals',    icon: '✅' };
const ADMINDRILL  = { path: '/admin',      label: 'Drill Approvals',  icon: '⚙️' };

export default function ComplianceSidebar({ collapsed }) {
  const { user } = useAuth();

  const allItems = [
    ...NAV_ITEMS,
    DRILL_ITEM,
    ...(user?.role === 'reviewer' || user?.role === 'admin' ? [REVIEW_ITEM] : []),
    ...(user?.role === 'admin' ? [ADMINDOC, ADMINDRILL] : []),
  ];

  return (
    <aside className={`cp-sidebar ${collapsed ? 'cp-sidebar--collapsed' : ''}`}>
      <div className="cp-sidebar__brand">
        <span className="cp-sidebar__logo">🛡️</span>
        {!collapsed && (
          <span className="cp-sidebar__title">ISO 27001<br /><small>Compliance Portal</small></span>
        )}
      </div>

      <nav className="cp-sidebar__nav">
        {allItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `cp-sidebar__link ${isActive ? 'cp-sidebar__link--active' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="cp-sidebar__icon">{item.icon}</span>
            {!collapsed && <span className="cp-sidebar__label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="cp-sidebar__footer">
        {!collapsed && (
          <div className="cp-sidebar__user-info">
            <span className="cp-sidebar__role-badge" data-role={user?.role}>{user?.role}</span>
            <span className="cp-sidebar__username">{user?.full_name}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
