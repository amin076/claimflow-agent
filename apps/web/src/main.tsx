import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { App } from './App.js';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#08727a',
      dark: '#055660',
      light: '#dff4f3',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0f9f97',
      dark: '#08746f',
      light: '#e0f6f2',
      contrastText: '#ffffff',
    },
    success: { main: '#168657', light: '#e4f5ed', dark: '#0f6843' },
    warning: { main: '#ea7b18', light: '#fff1df', dark: '#ae5207' },
    error: { main: '#c8404a', light: '#fdebed', dark: '#962d36' },
    info: { main: '#2f74c8', light: '#e8f2ff', dark: '#24589a' },
    background: { default: '#f5f8fa', paper: '#ffffff' },
    text: { primary: '#10243b', secondary: '#607086' },
    divider: '#e3eaf0',
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily:
      'Inter, "SF Pro Text", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    h3: {
      fontSize: 'clamp(2rem, 3.2vw, 2.75rem)',
      lineHeight: 1.08,
      letterSpacing: '-0.045em',
      fontWeight: 800,
    },
    h4: { fontWeight: 800, letterSpacing: '-0.035em' },
    h5: { fontWeight: 780, letterSpacing: '-0.025em' },
    h6: { fontWeight: 760, letterSpacing: '-0.018em' },
    button: { fontWeight: 750, letterSpacing: '-0.01em' },
    body1: { lineHeight: 1.58 },
    body2: { lineHeight: 1.55 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(circle at 76% 0%, rgba(8,114,122,.055), transparent 30%), linear-gradient(180deg, #f8fafb 0%, #f3f7f9 100%)',
          backgroundAttachment: 'fixed',
        },
        '::selection': { background: '#ccebea', color: '#073e45' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderColor: '#e3eaf0',
          backgroundImage: 'none',
          boxShadow: '0 10px 30px rgba(17, 42, 67, 0.055)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 750,
          minHeight: 42,
          borderRadius: 11,
          paddingInline: 18,
        },
        contained: {
          boxShadow: '0 7px 18px rgba(8, 114, 122, .18)',
          '&:hover': { boxShadow: '0 9px 22px rgba(8, 114, 122, .24)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 780, letterSpacing: '-0.01em' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: '1px solid',
          borderColor: 'rgba(58, 89, 116, .10)',
          alignItems: 'center',
        },
        standardInfo: { backgroundColor: '#eaf4ff', color: '#194f82' },
        standardSuccess: { backgroundColor: '#e7f6ef', color: '#155f40' },
        standardWarning: { backgroundColor: '#fff4e6', color: '#884707' },
        standardError: { backgroundColor: '#fff0f1', color: '#8e3038' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#ffffff',
          transition: 'box-shadow .18s ease, border-color .18s ease',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#a8bdc7' },
          '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(8, 114, 122, .09)' },
        },
        notchedOutline: { borderColor: '#dbe5ea' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 6, backgroundColor: '#e9eff2' },
        bar: { borderRadius: 999 },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: '#e7edf1' } } },
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
