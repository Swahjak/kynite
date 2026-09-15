'use client';

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

type TodayFilterContextValue = {
  selected: string | null;
  setSelected: (id: string | null) => void;
  pastOpen: boolean;
  setPastOpen: Dispatch<SetStateAction<boolean>>;
};

const TodayFilterContext = createContext<TodayFilterContextValue | null>(null);

export function TodayFilterProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pastOpen, setPastOpen] = useState(false);

  return (
    <TodayFilterContext.Provider value={{ selected, setSelected, pastOpen, setPastOpen }}>
      {children}
    </TodayFilterContext.Provider>
  );
}

export function useTodayFilter() {
  return useContext(TodayFilterContext);
}
