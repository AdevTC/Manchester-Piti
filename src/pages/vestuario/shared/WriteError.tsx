/** A refused write, next to the control that made it (useWrite's error). */
export function WriteError({ text }: { text: string }) {
  return text ? (
    <p className="ma-error" role="alert">
      {text}
    </p>
  ) : null;
}
