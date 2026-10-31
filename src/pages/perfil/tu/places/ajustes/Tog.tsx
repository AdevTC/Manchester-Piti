// The kit's toggle (tk-tog): a pressed button with its label, its state also in words for a screen reader.
export function Tog({ on, onFlip, children, id, dis }: { on: boolean; onFlip: () => void; children: string; id?: string; dis?: boolean }) {
  return (
    <button type="button" className="tk-tog" id={id} aria-pressed={on} aria-disabled={dis || undefined} onClick={onFlip}>
      <span className="tk-tog__t" aria-hidden="true" />
      {children}
    </button>
  );
}
