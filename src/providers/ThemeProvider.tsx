import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTheme, type AppTheme, type ThemeMode } from '@/theme';

type ThemePreference = ThemeMode | 'system';

type ThemeContextValue = {
  theme: AppTheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'tajjd.theme.preference';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const resolvedMode: ThemeMode =
    preference === 'system'
      ? systemScheme === 'light'
        ? 'light'
        : 'dark'
      : preference;

  const theme = useMemo(() => createTheme(resolvedMode), [resolvedMode]);

  const toggleTheme = useCallback(() => {
    setPreference(resolvedMode === 'dark' ? 'light' : 'dark');
  }, [resolvedMode, setPreference]);

  const value = useMemo(
    () => ({ theme, preference, setPreference, toggleTheme }),
    [theme, preference, setPreference, toggleTheme]
  );

  // Always render children to avoid blank flash; preference hydrates async.
  void hydrated;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useAppTheme() {
  return useTheme().theme;
}
