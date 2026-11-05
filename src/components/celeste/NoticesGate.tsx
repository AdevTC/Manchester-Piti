// Where the chrome mounts the bell (NoticesBell). The public pages are server-rendered for fans, so this renders
// nothing on the server and while the browser hydrates (the HTML and the first paint stay exactly the fan's);
// right after, the bell's chunk loads for everyone (TU boards: the bell is in every top bar), and it shows with
// «Buscar» once who is looking is known (headerTools): a member reads his notices and «Te toca» there (once
// RootLayout knows him: hooks/viewerSignal), a fan only chooses this device's avisos and opens no listener. The
// header places it in a slot it already had, so no sibling moves and React's ids stay the server's (Chrome.tsx).
import { usePublishedViewer } from "../../hooks/viewerSignal";
import { readTuMaqueta } from "../vidrio/tu/maqueta";
import { useHeaderTools } from "./headerTools";

export function NoticesGate() {
  const member = usePublishedViewer().member;
  const tools = useHeaderTools();
  if (!tools) return null;
  // (the DEV maqueta's «fan» looks at the fan's bell through a member's session)
  const fan = !member || readTuMaqueta()?.quien === "fan";
  return fan ? <tools.FanBell /> : <tools.NoticesBell />;
}
