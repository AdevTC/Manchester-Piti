// The one «¿Salir sin guardar?» alertdialog behind useUnsavedGuard (guard.ts).
import { useCallback, useRef, useState, type ReactNode } from "react";
import { GuardContext, type Ask, type GuardAsk, type GuardChoice } from "./guard";
import { ConfirmModal } from "./layers";

interface Request extends GuardAsk {
  resolve: (choice: GuardChoice) => void;
}

export function GuardProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const current = useRef<Request | null>(null);
  const ask = useCallback<Ask>(
    (a) =>
      new Promise<GuardChoice>((resolve) => {
        current.current?.resolve("stay");
        const next = { ...a, resolve };
        current.current = next;
        setReq(next);
      }),
    [],
  );
  const done = (choice: GuardChoice) => {
    const r = current.current;
    current.current = null;
    setReq(null);
    r?.resolve(choice);
  };
  return (
    <GuardContext.Provider value={ask}>
      {children}
      <ConfirmModal
        open={!!req}
        onClose={() => done("stay")}
        role="alertdialog"
        kicker="Cambios sin guardar"
        title="¿Salir sin guardar?"
        lede={req ? `Hay cambios sin guardar en ${req.what} · si sales ahora, se pierden.` : undefined}
        cancelLabel="Seguir editando"
        confirmLabel="Descartar cambios"
        confirmTone="red"
        alt={req?.altLabel ? { label: req.altLabel, onClick: () => done("alt") } : undefined}
        onConfirm={() => done("discard")}
      />
    </GuardContext.Provider>
  );
}

