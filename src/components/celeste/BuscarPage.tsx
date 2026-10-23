// /buscar?q=: «Buscar» as an address (the phone's search, TU boards: «en el móvil es /buscar, así atrás lo
// cierra»): the whole screen on the phone, the same window on a wider screen (a direct link). The field lives in
// ?q= (replaced as you type, so «atrás» never walks
// through the letters); closing goes back to where it was opened (or to Inicio for a direct link); a chosen result
// replaces this address, so «atrás» from it skips the search.
import { useState } from "react";
import { useRouter, useSearch } from "@tanstack/react-router";
import { SearchDialog } from "./SearchDialog";
import "./search.css";

export function BuscarPage() {
  const router = useRouter();
  const search: { q?: string } = useSearch({ strict: false });
  const [first] = useState(() => search.q ?? "");
  const close = (refocus = true) => {
    // (a result was chosen: the dialog is already on its way there)
    if (!refocus) return;
    if (router.history.canGoBack()) router.history.back();
    else void router.navigate({ to: "/", replace: true });
  };
  return (
    <SearchDialog
      page
      onClose={close}
      initial={{ q: first, scope: "todo" }}
      onState={({ q }) => {
        const now = new URLSearchParams(location.search).get("q") ?? "";
        if (now === q || !location.pathname.startsWith("/buscar")) return;
        void router.navigate({ to: "/buscar", search: { q: q || undefined }, replace: true });
      }}
    />
  );
}
