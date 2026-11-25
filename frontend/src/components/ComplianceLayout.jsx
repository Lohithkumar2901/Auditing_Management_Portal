import React from 'react';
import Navbar from './Navbar';

export default function ComplianceLayout({ children }) {
  return (
    <div className="page">
      <Navbar />
      {children}
    </div>
  );
}
