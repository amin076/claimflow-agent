import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { App } from './App.js';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0c6f73' },
    secondary: { main: '#e9a23b', contrastText: '#172326' },
    background: { default: '#f3f7f7', paper: '#ffffff' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h3: { fontSize: 'clamp(2rem, 5vw, 3rem)' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 750, minHeight: 42 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderColor: '#d9e2e3' },
      },
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element was not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
