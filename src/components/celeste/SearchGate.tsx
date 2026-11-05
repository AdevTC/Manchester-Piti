// Where the chrome mounts «Buscar» (SearchLauncher). The public pages are server-rendered for fans, so this
// renders nothing on the server and while the browser hydrates: the fans' HTML and first paint stay exactly what
// they were. Right after, for everyone, the button's small chunk loads (the dialog and its data hooks load only when
// it opens), and it shows with the bell once who is looking is known (headerTools), where it stays. The header
// places it in the bell's slot (Chrome.tsx), so no sibling moves and React's ids stay the server's.
import { useHeaderTools } from "./headerTools";

export function SearchGate() {
  const tools = useHeaderTools();
  return tools ? <tools.SearchLauncher /> : null;
}
