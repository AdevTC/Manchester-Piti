// «El palco»: what the page hands each place and each sheet. `v` is the season's numbers already cut by the page's
// filters (numeros/view.ts recomputes it whenever the state moves); `st` the state; `act` the page's actions.
import type { Ref } from "react";
import type { CatalogLoadStatus } from "../numeros/CatalogLoadState";
import type { Act, NuState, NuView } from "../numeros/view";

export interface PlaceProps {
  v: NuView;
  st: NuState;
  act: Act;
}

export interface JuegoProps extends PlaceProps {
  /** The club's data is still arriving (the charts say «Cargando las jugadas…»). */
  loading: boolean;
  /** The repo catalogue of 412 statistics (it loads the first time the catalogue, a ficha or the search needs it). */
  catalogLoad: CatalogLoadStatus;
  /** A chart's «ver la ficha»: the statistic's sheet, for a player when one is given. */
  onInspect: (metricId: string, playerId?: string | null) => void;
}

export interface SheetProps extends PlaceProps {
  onClose: () => void;
  /** The dialog (the page puts the focus in it). */
  sheetRef: Ref<HTMLElement>;
  catalogLoad: CatalogLoadStatus;
}
