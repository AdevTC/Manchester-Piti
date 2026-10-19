// The header tells what it renders inside its actions slot: the theme switch pages still pass there moves into
// the account sheet («Tú» / the fan's «Entrar» sheet) and the footer, as the «Vidrio» boards draw the top bar
// (search, bell, avatar), so ThemeToggle renders nothing inside the header.
import { createContext, useContext } from "react";

export const InChromeHeader = createContext(false);
export const useInChromeHeader = (): boolean => useContext(InChromeHeader);
