// The frame's «Buscar» (the desktop bar and the phone's header): the web's button (SearchLauncher: ⌘K / Ctrl K, the
// View Transition out of the button, the focus back), opening the sala's dialog (SalaSearchDialog, its own chunk,
// asked for on a hover, a focus or the opening). A dialog on the phone too (the sala has no /buscar), and «/» stays
// the screen's list search (shell/shortcuts).
import { SearchLauncher, type SearchDialogLoader } from "../../../components/celeste/SearchLauncher";

const salaDialog: SearchDialogLoader = () => import("./SalaSearchDialog").then((m) => m.SalaSearchDialog);

export function SalaSearch() {
  return <SearchLauncher loader={salaDialog} phoneRoute={false} slash={false} />;
}
