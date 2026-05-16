import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface UndoRedoState {
  past: any[];
  present: any;
  future: any[];
}

interface UndoRedoContextType {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushState: (state: any, action: string) => void;
  clear: () => void;
}

const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined);

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<UndoRedoState>({
    past: [],
    present: null,
    future: [],
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z / Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y / Cmd+Shift+Z for redo
      if (((e.ctrlKey || e.metaKey) && e.key === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history]);

  const pushState = useCallback((state: any, action: string) => {
    setHistory(prev => ({
      past: [...prev.past, { state: prev.present, action }].slice(-50), // Keep last 50 states
      present: state,
      future: [], // Clear future on new action
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;

      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

      // Restore to localStorage
      if (previous.state) {
        Object.keys(previous.state).forEach(key => {
          localStorage.setItem(key, JSON.stringify(previous.state[key]));
        });
        // Trigger storage event for other components
        window.dispatchEvent(new Event("storage"));
      }

      return {
        past: newPast,
        present: previous.state,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      // Restore to localStorage
      if (next) {
        Object.keys(next).forEach(key => {
          localStorage.setItem(key, JSON.stringify(next[key]));
        });
        // Trigger storage event
        window.dispatchEvent(new Event("storage"));
      }

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setHistory({
      past: [],
      present: null,
      future: [],
    });
  }, []);

  return (
    <UndoRedoContext.Provider
      value={{
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        undo,
        redo,
        pushState,
        clear,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error("useUndoRedo must be used within UndoRedoProvider");
  }
  return context;
}