import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth.store';
import { useThemeStore } from './stores/theme.store';
import LoginPage from './pages/LoginPage';
import ChatLayout from './pages/ChatLayout';
import PrivateChatPage from './pages/PrivateChatPage';
import AgentChatPage from './pages/AgentChatPage';
import SettingsPage from './pages/SettingsPage';
import KnowledgePage from './pages/KnowledgePage';
import GroupManagementPage from './pages/GroupManagementPage';
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
        <Route path="agent" element={<AgentChatPage />} />
        <Route path="agent/:sessionId" element={<AgentChatPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="group/:sessionId" element={<GroupManagementPage />} />
      </Route>
    </Routes>
    </ToastProvider>
  );
}
