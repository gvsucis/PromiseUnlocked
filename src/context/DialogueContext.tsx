import React, { createContext, useContext, useMemo } from "react";

interface DialogueContextValue {
  reset: () => void;
}

const DialogueContext = createContext<DialogueContextValue>({
  reset: () => {},
});

export const dialogueResetTarget: { current: (() => void) | null } = {
  current: null,
};

export function DialogueProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const value = useMemo<DialogueContextValue>(
    () => ({ reset: () => dialogueResetTarget.current?.() }),
    []
  );

  return <DialogueContext.Provider value={value}>{children}</DialogueContext.Provider>;
}

export function useDialogue(): DialogueContextValue {
  return useContext(DialogueContext);
}
