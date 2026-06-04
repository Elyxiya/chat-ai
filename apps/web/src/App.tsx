import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth.store';
import { useThemeStore } from './stores/theme.store';
import LoginPage from './pages/LoginPage';
import ChatLayout from './pages/ChatLayout';
import PrivateChatPage from './pages/PrivateChatPage';
import EnhancedAgentPage from './pages/EnhancedAgentPage';
import SettingsPage from './pages/SettingsPage';
import KnowledgePage from './pages/KnowledgePage';
import GroupManagementPage from './pages/GroupManagementPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import ChannelDiscoveryPage from './pages/ChannelDiscoveryPage';
import ChannelSettingsPage from './pages/ChannelSettingsPage';
import { ToastProvider } from './components/Toast/ToastContainer';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ThemeInitializer() {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Enable transitions after initial render to avoid flash
    requestAnimationFrame(() => root.classList.add('theme-ready'));
  }, [resolvedTheme]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeInitializer />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<PrivateChatPage />} />
        <Route path="chat/:sessionId" element={<PrivateChatPage />} />
        <Route path="channel/:sessionId" element={<PrivateChatPage />} />
        <Route path="channels/:sessionId/settings" element={<ChannelSettingsPage />} />
        <Route path="channels/discover" element={<ChannelDiscoveryPage />} />
        <Route path="agent" element={<EnhancedAgentPage />} />
        <Route path="agent/:sessionId" element={<EnhancedAgentPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="group/:sessionId" element={<GroupManagementPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
    </ToastProvider>
  );
}
