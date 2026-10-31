// Tú (TuCarta «Tú») — PLACEHOLDER until the Tú place agent builds it. Two parts, because the bar hangs between
// them: `TuStage` is the stage's right side (beside the shell's CardStage: who he is and «Lo que te toca»),
// `Tu` what goes under the bar (the next match · his form · the next thing for his card). Today: his identity,
// the pending items by title and the old «La carta» screen under the bar.
import type { PlaceProps } from "./types";
import { legacyProps } from "../screens/legacy";
import { Carta } from "../screens/Carta";

export function TuStage(p: PlaceProps & { name: string; line: string }) {
  const open = p.pending.items.filter((x) => !x.done);
  return (
    <div className="tc-id">
      <p className="tc-kick">Tu página</p>
      <h1 id="tc-name">{p.name}</h1>
      <p className="tc-id__line">{p.line}</p>
      {p.who.kind !== "fan" && (
        <>
          <div className="tc-todohead">
            <h2 id="tc-todo-h">Lo que te toca</h2>
          </div>
          {open.length ? (
            <ul className="tc-todo" aria-labelledby="tc-todo-h">
              {open.map((x) => (
                <li key={x.key} className="vd-glass tc-do">
                  <div className="tc-do__b">
                    <h3 className="tc-do__t">{"title" in x ? x.title : x.rival}</h3>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tc-calm">
              <span>
                <b>Estás al día.</b>
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Tu(p: PlaceProps) {
  return <Carta {...legacyProps(p)} cardNode={null} card={p.card.model} />;
}
