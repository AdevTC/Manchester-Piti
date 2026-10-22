// /buscar: «Buscar» as an address (the phone's search, TU board), so «atrás» closes it. Today it is the same
// dialog the magnifier opens; closing it goes back to where it was opened (or to Inicio for a direct link),
// choosing a result goes there.
import { useRouter } from "@tanstack/react-router";
import { SearchDialog } from "./SearchDialog";
import "./search.css";

export function BuscarPage() {
  const router = useRouter();
  const close = (refocus = true) => {
    // (a result was chosen: the dialog is already on its way there)
    if (!refocus) return;
    if (router.history.canGoBack()) router.history.back();
    else void router.navigate({ to: "/", replace: true });
  };
  return <SearchDialog onClose={close} />;
}
