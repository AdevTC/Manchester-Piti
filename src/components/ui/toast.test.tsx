import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { toast } from "@/lib/toast";
import { Toaster } from "./toast";

// The toast wrapper keeps sonner out of the first load: <Toaster> renders nothing until the first toast,
// which then mounts sonner's (components/ui/sonner) and shows, with nothing lost on the way.
describe("lazy toaster", () => {
  // (sonner compiled ahead, so the test doesn't wait on Vitest's cold transform; the wrapper still
  // imports it on its own, on the first toast)
  beforeAll(async () => {
    await import("./sonner");
  });

  it("renders nothing until a toast asks, then mounts sonner's and shows every toast fired meanwhile", async () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();
    toast("La convocatoria ya está cerrada");
    toast.success("Apuntado: Voy · J4 vs MAD SKY", { action: { label: "Deshacer", onClick: () => {} } });
    toast.error("No se ha podido deshacer.");
    expect(await screen.findByText("La convocatoria ya está cerrada")).toBeInTheDocument();
    expect(await screen.findByText("Apuntado: Voy · J4 vs MAD SKY")).toBeInTheDocument();
    expect(screen.getByText("No se ha podido deshacer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
    // sonner's live region, in the page before its first toast was created
    expect(container.querySelector('section[aria-live="polite"]')).not.toBeNull();
  });
});
