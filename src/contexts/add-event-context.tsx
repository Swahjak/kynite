"use client";

import { createContext, useContext, useRef, type RefObject } from "react";

interface AddEventContextValue {
  addEventButtonRef: RefObject<HTMLButtonElement | null>;
}

const AddEventContext = createContext<AddEventContextValue | null>(null);

export function AddEventProvider({ children }: { children: React.ReactNode }) {
  const addEventButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <AddEventContext.Provider value={{ addEventButtonRef }}>
      {children}
    </AddEventContext.Provider>
  );
}

export function useAddEvent() {
  const context = useContext(AddEventContext);
  if (!context) {
    throw new Error("useAddEvent must be used within AddEventProvider");
  }
  return context;
}

export function useAddEventSafe() {
  return useContext(AddEventContext);
}
