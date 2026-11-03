import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import { initTheme } from './lib/theme';
import { ThemedToaster } from './components/layout/ThemedToaster';
import './index.css';

// 첫 화면을 그리기 전에 테마를 적용해 깜빡임을 막는다
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ThemedToaster />
    </QueryClientProvider>
  </StrictMode>
);
