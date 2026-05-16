import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AuditEntry {
  id: string;
  timestamp: number;
  user: string; // For now, just "System" or could be actual user when multi-user is implemented
  action: string; // "created", "updated", "deleted", "restored"
  entity: string; // "rota", "staff", "config", "availability"
  entityId?: string;
  details: string;
  changes?: any; // Before/after snapshot
}

interface AuditContextType {
  entries: AuditEntry[];
  addAuditEntry: (entry: Omit<AuditEntry, "id" | "timestamp">) => void;
  getEntriesByEntity: (entity: string) => AuditEntry[];
  getEntriesByEntityId: (entityId: string) => AuditEntry[];
  clearAudit: () => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("warehouse-audit-trail");
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("warehouse-audit-trail", JSON.stringify(entries));
  }, [entries]);

  const addAuditEntry = (entry: Omit<AuditEntry, "id" | "timestamp">) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    // Keep only last 1000 entries to prevent storage bloat
    setEntries(prev => [newEntry, ...prev].slice(0, 1000));
  };

  const getEntriesByEntity = (entity: string) => {
    return entries.filter(e => e.entity === entity);
  };

  const getEntriesByEntityId = (entityId: string) => {
    return entries.filter(e => e.entityId === entityId);
  };

  const clearAudit = () => {
    setEntries([]);
  };

  return (
    <AuditContext.Provider value={{ entries, addAuditEntry, getEntriesByEntity, getEntriesByEntityId, clearAudit }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error("useAudit must be used within AuditProvider");
  }
  return context;
}