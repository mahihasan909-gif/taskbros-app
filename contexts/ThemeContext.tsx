import {
  createContext, useContext, useEffect, useState, type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ColorScheme = "dark" | "light";

const STORAGE_KEY = "taskbros-color-scheme";

type ThemeContextValue = {
  scheme: ColorScheme;
  toggle: () => void;
  setScheme: (s: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  scheme: "dark",
  toggle: () => {},
  setScheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [scheme, setSchemeState] = useState<ColorScheme>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setSchemeState(saved);
    });
  }, []);

  function setScheme(s: ColorScheme) {
    setSchemeState(s);
    AsyncStorage.setItem(STORAGE_KEY, s);
  }

  function toggle() {
    setScheme(scheme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ scheme, toggle, setScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
