# La alineación del partido, una sola verdad (pizarra ⇄ mesa ⇄ Campo)

- **Fecha:** 2026-10-17
- **Estado:** aprobado el enfoque («el siete se elige en la pizarra»); la pizarra se diseña sobre la real.

## El problema

Hoy el siete vive en tres sitios que no se hablan:

- **La pizarra:** el tablero oficial, con formación, casillas y «Jugar de».
- **La convocatoria:** `starters` / `bench` / `notCalled`, sin formación ni posiciones.
- **Dos dibujos inventados:** la mesa usa un 2-3-1 por defecto y el Campo en directo un 1-3-2-1. Pueden salir con porteros distintos.

Esto falla en varios puntos:

- Cambiar el siete en la pizarra después de convocar no llega al partido.
- «Cambiar» en la mesa abre cualquier pizarra, sin vuelta.
- El anotador no puede tocar nada.
- La formación no se guarda hasta el acta, y se lee del tablero tal como esté entonces.
- Los cambios previstos se leen una sola vez.

El siete casi nunca se sabe antes: se decide en el campo, viendo quién ha venido y cómo está.

## Decisiones del usuario (2026-10-17)

- Deciden el siete **admins y anotadores** del partido.
- El **tablero oficial se actualiza solo**: pizarra, mesa y web siempre iguales.
- Hay un paso **«¿Quién ha venido?»**, con la forma de cada uno.
- **El siete se elige en la pizarra** (los 15 sistemas, cromos, Química, Sugerir siete). La mesa no tiene un editor propio.
- La pizarra ya tiene su diseño: solo se diseña lo nuevo dentro de ella y sobre la pantalla real.

## El modelo

```
matches/{id}.lineup = { system, slots[7]{playerId, code, x, y}, boardId, setBy, setAt }
                      // casilla 0 = portero; x/y en el marco de la pizarra
matches/{id}.present = string[]   // «¿Quién ha venido?»
```

- El módulo puro `functions/src/matchLineup.ts`, compartido con `src/lib/matchLineup.ts`, contiene:
  - `lineupFromBoard`;
  - `lineupNow(lineup, events)`: quien entra hereda la casilla de quien sale y una roja vacía la casilla;
  - `convocatoriaOf`;
  - `parseMatchLineup` / `parsePresent`;
  - `sameLineup`.
- Después del pitido `lineup` no se reescribe: lo que cambia son los eventos (`liveEvent add` / `addMany`).

## Servidor

- **`setMatchLineup({ matchId, boardId })`**
  - Permisos: admin o anotador del partido. Fase: reloj en `ready`.
  - El tablero tiene que ser el oficial del partido o uno del propio actor (admin: cualquiera de la temporada).
  - En una transacción:
    - `match.lineup`;
    - `starters` / `bench` / `notCalled` con `convocatoriaOf(seven, conv, present)`;
    - el tablero oficial del partido recibe `formation`, `freeMode`, `slots` y `playerPositions` del tablero enviado. Si no hay oficial, el enviado pasa a serlo; el doc de ámbito `lineupOfficials` se mantiene.
  - Si no cambia nada (`sameLineup` y la misma convocatoria), devuelve `changed: false`.
  - Aviso «Cambio en el siete»: el de siempre, una vez.
- **`setMatchPresent({ matchId, present })`**: admin o anotador, solo en `ready`, ids de la plantilla o invitados del partido.
- **`setConvocatoria`:** si sus titulares ya no son el siete de `lineup`, borra `lineup`.
- **`publishSheet`:** `system` y `positionsPlayed` salen de `match.lineup` más los cambios. El tablero queda como respaldo para partidos sin `lineup`.

## La mesa

- **Antes:**
  - «¿Quién ha venido?» (lienzo `QuienV3`): toques que guardan `present`, con la forma y la posición de los cromos de la pizarra.
  - Después, «Elegir el siete en la pizarra», que va a `/pizarra?tablero=<oficial>&desde=mesa&partido=<id>`.
  - Cuando hay `lineup`, el campo de Antes lo dibuja y la lista dice «El siete de la pizarra · 2-3-1».
- **En juego:** `lineupNow(lineup, events)`. Sin `lineup`, el comportamiento de hoy.
- **Campo de la web:** igual, el mismo dibujo y el mismo portero, en tiempo real (el partido ya es `onSnapshot`).
- **Cambios previstos:** en tiempo real (`onSnapshot`).

## La pizarra

- **Modo «desde la mesa»** (`desde=mesa&partido=<id>`):
  - Abre el tablero del partido. Si el usuario no puede editar el oficial (anotador), abre o crea su copia del oficial, ligada al partido.
  - «Convocados» marca quién ha venido según `present`, y Sugerir siete solo usa a los que han venido.
  - Barra fija **«Mandar a la mesa»**. Abre una hoja con las diferencias respecto a `match.lineup` (sistema, siete, banquillo, portero). Al mandarlo, `setMatchLineup` y vuelta a la mesa.
  - Estado arriba: «Mesa al día» / «Mesa: otro siete».
- **En partido:**
  - Franja **«En el campo ahora · 34′»** con `lineupNow`.
  - «Traer aquí» copia lo que hay en el campo al tablero abierto.
  - «Hacer el cambio» (ya existe) sigue mandando los cambios a la mesa con `addMany`.

## Fuera de alcance

- Cambiar el siete inicial una vez pitado (para eso están los cambios y «Reabrir»).
- La forma por partido: se usa la que ya calcula la pizarra.
