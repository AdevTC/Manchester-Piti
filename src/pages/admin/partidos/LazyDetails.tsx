// A <details> that renders its content only while open (B-ACTA-03): the narration's closed blocks (the JSON of each
// observation, the advanced edit, the history's revisions) were still laid out under the rows they follow, so the
// readers and the layout checks found their text piled on top of the list. The first child is the <summary>.
import { Children, useState, type ReactNode } from "react";

export function LazyDetails({ children, className, open: initial = false }: { children: ReactNode; className?: string; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  const [summary, ...rest] = Children.toArray(children);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {summary}
      {open && rest}
    </details>
  );
}
