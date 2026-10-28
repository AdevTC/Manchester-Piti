// ACTA · Publicar (/admin/partidos/<id>/publicar): antes de publicar (lista), «Así lo verá la afición» (la cabecera
// pública tal cual), crónica, foto, galería, minutos, cartel; «Publicar el acta» with its consequences in words
// (board part-partido-publicar.html, M-09). TEMPORARY: today's workspace on «Publicar».
import { MatchEditorStation } from "../interim/MatchEditorStation";

export function PublicarScreen() {
  return <MatchEditorStation tab="publicar" />;
}
