// A link to any address of the sala written as a string («/admin/partidos/abc/acta»), keeping the season of the
// address (`?season=`, the frame's picker) unless the link names its own. A real <a href> (a new tab, a copied
// link and a modified click work), navigated by the router on a plain click (so the change of screen gets its
// View Transition). For a typed route, the router's <Link> is just as good.
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSeasonParam, withSeason } from "./salaHref";

export interface SalaLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
}

export const SalaLink = forwardRef<HTMLAnchorElement, SalaLinkProps>(function SalaLink({ to, replace, onClick, ...rest }, ref) {
  const navigate = useNavigate();
  const season = useSeasonParam();
  const href = withSeason(to, season);
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === "_blank") return;
    e.preventDefault();
    void navigate({ href, replace });
  };
  return <a ref={ref} href={href} onClick={go} {...rest} />;
});
