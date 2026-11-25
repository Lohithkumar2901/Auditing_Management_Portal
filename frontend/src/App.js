import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import ComplianceLayout from './components/ComplianceLayout';
import HomeDashboard from './pages/HomeDashboard';
import DocumentPage from './pages/DocumentPage';
import ReviewerDashboard from './pages/ReviewerDashboard';
import AdminDocuments from './pages/AdminDocuments';
import ChatWidget from './components/ChatWidget';

function ProtectedRoute({ children, roles = null }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/home" replace />;
  return children;
}

function AnimatedRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const defaultRedirect = user ? '/home' : '/login';

  return (
    <>
      <div key={location.pathname} className="page-transition">
        <Routes location={location}>
          <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin"     element={<ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>} />

          <Route path="/home" element={
            <ProtectedRoute>
              <ComplianceLayout><HomeDashboard /></ComplianceLayout>
            </ProtectedRoute>
          } />
          <Route path="/policies" element={
            <ProtectedRoute>
              <ComplianceLayout><DocumentPage title="Policies" docType="POLICY" /></ComplianceLayout>
            </ProtectedRoute>
          } />
          <Route path="/procedures" element={
            <ProtectedRoute>
              <ComplianceLayout><DocumentPage title="Procedures & SOPs" docType="PROCEDURE" /></ComplianceLayout>
            </ProtectedRoute>
          } />
          <Route path="/formats" element={
            <ProtectedRoute>
              <ComplianceLayout><DocumentPage title="Formats" docType="FORMAT" /></ComplianceLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainings" element={
            <ProtectedRoute>
              <ComplianceLayout><DocumentPage title="Trainings" docType="TRAINING" /></ComplianceLayout>
            </ProtectedRoute>
          } />
          <Route path="/reviewer" element={
            <ProtectedRoute roles={['reviewer', 'admin']}>
              <ComplianceLayout><ReviewerDashboard /></ComplianceLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin-docs" element={
            <ProtectedRoute roles={['admin']}>
              <ComplianceLayout><AdminDocuments /></ComplianceLayout>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
          <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
        </Routes>
      </div>

      {/* Chat widget — visible on all authenticated pages */}
      {user && <ChatWidget />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AnimatedRoutes />
      </Router>
    </AuthProvider>
  );
}
