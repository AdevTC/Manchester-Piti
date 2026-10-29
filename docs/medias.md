# Medias: GLOBAL, FOR y la nota de cada partido

GLOBAL es el número de la carta del perfil, los cromos de la pizarra, la ficha de jugador, «¿Quién ha venido?» de la mesa y el cromo del admin. Todos lo leen del mismo cálculo (`src/lib/seasonRating.ts`), con los mismos partidos y la misma clasificación, así que nunca difieren. Modelo `piti-media-v4` (29 de octubre de 2026): la `v3` (27 de octubre, la revisión de `v2` en tres pasadas, con fuentes y con lo que vio el usuario en la J1) revisada con la J2. Cada jugador se valora en un puesto fijo, como propusieron los del equipo, y cada familia de acciones pesa por el oficio de ese puesto. Los goles van en las proporciones del Fantasy, las calibraciones F7 y del portero pesan igual a los dos equipos y la parte del equipo cuenta los goles de verdad. La nota se sigue congelando con su acta.

El código está en `functions/src/rating/` (la web lo lee por `src/lib/rating/`; las funciones lo usan para congelar las notas al publicar el acta):

- `constants.ts`: todos los números del modelo.
- `fixed.ts`: el puesto fijo de cada jugador en cada partido.
- `values.ts`: lo que vale cada acción de un partido y lo que pasó con el equipo mientras cada uno estaba en el campo.
- `season.ts`: notas, GLOBAL y FOR.
- `rival.ts`: la fuerza del rival y sus goles.
- `frozen.ts`: las notas que guarda cada acta.

Cambiar un número es cambiar el modelo: sube `MODEL_VERSION` y actualiza esta página.

## La nota de un partido (0–10)

Cada acción vale lo que cambia, en goles, la probabilidad de marcar o de encajar (VAEP, xT, g+). La nota suma tres partes:

1. **Lo que se repite** (pases, controles, recuperaciones, despejes, bloqueos…: lo que cuenta la narración) se pasa a **cada 50′**, con un colchón de 10′ de lo normal en su puesto, y se compara con **lo normal en su puesto fijo** (abajo), cada familia de acciones con el peso que le da ese puesto:
   - Lo normal es lo que hicieron los otros que jugaron ese puesto en la temporada hasta ese partido, sin contarle a él, por minutos (Σ valor / Σ minutos), con los pesos de ese puesto. Un puesto es la línea y el centro o la banda (`positions.ts`): un central con los centrales, un lateral con los laterales, un interior con los interiores.
   - Lo normal de un puesto parte de la media del equipo con 200′, hasta que tiene muestra. Si el acta no permite fijarle un puesto, cuenta cada uno de los suyos por sus minutos; si no dice dónde jugó, se le compara con el equipo.
   - **El portero cuenta tal cual**: lo normal de un portero solo lo fijan otros porteros, partiendo de cero. Sin otro portero, lo que hace cuenta entero.
   - **Un partido sin narración** (solo acta y mesa) cuenta casi nada del juego: lo poco que apunta la mesa cuenta tal cual, sin compararlo con los partidos narrados ni fijar lo normal de nadie.
2. **Lo que pasa una vez** (goles, asistencias, penaltis, tarjetas, goles en propia, errores que acaban en gol y los goles evitados del portero) cuenta **entero**: no se pasa a 50′ ni se compara con la media de un solo partido. Un gol vale lo mismo en 10′ que en 50′ y no mueve la nota de nadie más.
   - **Un gol pesa por su puesto fijo**, en las proporciones del Fantasy de la Premier (10 puntos el del portero, 6 el del defensa, 5 el del medio y 4 el del delantero): ×2,5 el del portero, ×1,5 el del defensa, ×1,25 el del medio y ×1 el del delantero. Un gol de penalti, sus +0,22 con el mismo peso.
   - Lo demás (asistencias, penaltis, tarjetas, errores) pesa igual en todos los puestos, como en el Fantasy.
   - Medir los goles contra lo normal de su puesto quedó descartado: un compañero que marca te bajaría la nota.
3. **Lo que pasó con el equipo mientras estaba en el campo** (abajo), en puntos de nota.

**Nota = 6,5 + (lo que se repite + lo que pasa una vez) / 0,65 + la parte del equipo**, entre 0 y 10. **6,5 es un partido normal** y **0,65 goles son un punto**: la escala es fija, así que una nota no depende de las de los demás. Con menos de 10′ no hay nota.

### El puesto fijo

En cada partido, cada jugador se valora en **un puesto fijo**: donde empieza o, si sale del banquillo, donde entra por primera vez. Lo propusieron los del equipo para que los cambios no mezclen puestos: si entra un delantero y el medio pasa a la banda, cada uno se sigue valorando en el puesto en el que empezó.

- **Donde empieza**: la alineación del partido (`matches/{id}.lineup`, la que fija la pizarra oficial antes de empezar). Sin ella, los puestos de salida con los que los cambios del acta reproducen sus minutos en cada puesto (`positionsPlayed`).
- **Donde entra**: quien entra ocupa el sitio de quien sale, o el que dejó vacío una roja. Un «Cambio de sitio» intercambia dos sitios, pero no cambia el puesto fijo de nadie.
- Ese puesto decide **todo** lo que depende del puesto: lo normal con lo que se le compara, el peso de cada familia de sus acciones, el de sus goles y el de la parte del equipo.
- Si el acta no permite saber dónde empezó, cuentan sus minutos en cada puesto, como en la `v3`. Pasa con un invitado en el siete (el acta guardada solo tiene socios) y con quien entra por él. También con un cambio de sitio justo en el descanso sin alineación, porque las dos salidas reproducen igual los minutos.

### El oficio de cada puesto

Las acciones de la narración se agrupan en tres familias:

- **Ataque**: remates, regates, conducciones, la ocasión clarísima fallada y las ocasiones de la mesa.
- **Pase**: pases de todo tipo, centros, pases clave, recepciones y controles, pérdidas, saques del portero y la ocasión clarísima creada.
- **Defensa**: recuperaciones, intercepciones, entradas, duelos, presiones, despejes y bloqueos.

Cada familia pesa en un puesto **por lo que ese puesto suele hacer**, su oficio. El peso es el ritmo de las acciones valoradas de esa familia en el puesto entre el del equipo, cada 50′, en los partidos narrados de la temporada hasta el acta. Cada valor cuenta una: un pase clave suma el pase y el pase clave.

- El ritmo del puesto se acerca al del equipo con 200′, hasta que tiene muestra.
- El peso va de ×2/3 a ×1,5.
- Así la defensa de un central y el remate de un delantero cuentan más, y lo que su puesto apenas hace, menos.
- El portero (×1) y lo demás (portería, errores, disciplina) cuentan tal cual.
- Lo normal de cada puesto se calcula con sus propios pesos, también lo que pone el equipo hasta que el puesto tiene muestra: el juego del equipo valorado como lo valora ese puesto.

Pesos tras la J2, en ataque / pase / defensa:

| Puesto | Ataque | Pase | Defensa |
| --- | --- | --- | --- |
| Central | ×0,70 | ×0,90 | ×1,08 |
| Interior | ×1,17 | ×1,08 | ×0,94 |
| Mediocentro | ×1,08 | ×1,11 | ×1,07 |
| Punta | ×1,27 | ×1,00 | ×0,88 |

### El equipo con él en el campo

- **A favor**: los goles nuestros mientras estaba en el campo, sin los suyos.
- **En contra**: los goles del rival mientras estaba en el campo, como los cobra el Fantasy a porteros y defensas. Con el peligro esperado de la `v3`, unos 2 goles de la J2 no eran de nadie. El tiro a tiro del portero va aparte, en sus goles evitados.
- Lo que causó él (su error que acaba en gol, su penalti, su gol en propia) ya le cuenta aparte: no vuelve a contarle aquí, ni al acercarlo al partido entero.
- Lo que la narración no sitúa en el tiempo (o un acta sin tramos), y los goles del acta que no narra, cuentan en proporción a sus minutos.
- **Un rato corto se acerca al partido entero**: (lo suyo + 25′ del partido) × minutos / (minutos + 25), como el encogimiento del plus-minus ajustado.
- Se compara con **lo normal en sus minutos**: los goles por equipo cada 50′ de la temporada hasta ese partido (los dos equipos). Con una clasificación que tenga goles, lo que marca ese rival por partido (lo que solemos encajar) y lo que encaja (lo que solemos marcar), con 2 partidos de la media de la liga.
- **Pesos** (puntos de nota por gol por encima de lo normal, en contra / a favor), por la línea de su puesto fijo (sin él, por sus minutos en cada línea):

| Línea | En contra | A favor |
| --- | --- | --- |
| Portero | −0,05 | 0 |
| Defensa | −0,15 | +0,05 |
| Medio | −0,10 | +0,10 |
| Delantero | −0,05 | +0,15 |

Sin puesto en el acta, pesa como un medio. Sofascore y Flashscore dan entre 0,75 y 0,96 puntos menos a los que pierden (estudio de 2025); FPL y LaLiga Fantasy restan los goles encajados a porteros y defensas.

### La nota congelada

La nota se calcula **al publicar el acta**, con los partidos de la temporada **hasta ese día** (de ellos salen lo normal y el peso de cada puesto, las calibraciones F7 y del portero, el volumen de narración y lo normal de un partido) y la fuerza del rival en la clasificación de ese día. Se guarda con el acta (`matches/{id}.notas`: cada nota, el modelo, el factor del rival y, si la clasificación lo dio, lo normal contra ese rival) y **solo cambia si se corrige esa acta**; la corrección conserva el factor del rival y lo normal de la primera publicación. Lo que pase después (otras jornadas, la clasificación) ya no la mueve.

- La guardan `saveMatchSheet` y la publicación de la mesa (`publishSheet`); nadie más puede escribirla.
- Un acta sin notas de este modelo (publicada antes, o si el cálculo falló al publicar) se calcula igual en la web, con su temporada hasta ella. `functions/scripts/backfill-notas.mjs` las congela en las actas ya publicadas.
- Si cambia la fórmula (otro `MODEL_VERSION`), las notas guardadas dejan de valer y se recalculan todas con ese relleno: nunca se mezclan modelos.

## GLOBAL y FOR (0–99)

- **GLOBAL** = 10 × (Σ peso·nota + 3 × 6,5) / (Σ peso + 3), con las notas congeladas de cada acta (con la parte del equipo dentro: GLOBAL es la media de las notas que se ven). La media parte de tres partidos de 6,5 para que pocos partidos no decidan.
- **Peso de un partido**: 1 desde 30′ jugados y en proporción por debajo (15′ = medio partido). Un partido sin narración (solo acta y mesa) pesa la mitad.
- **FOR**: la misma fórmula sobre sus 5 últimos partidos con nota, con colchón de un partido.
- **Estado**:
  - «provisional» hasta 150′ con nota.
  - «—» sin ninguna nota.
  - Sin GLOBAL ni FOR al mezclar temporadas; las notas siguen valiendo para las posiciones.
- **Tipos de carta**: oro desde 75, plata de 65 a 74 y bronce por debajo de 65. «En racha» (gol o asistencia en las tres últimas) manda sobre el tipo.
- **Posiciones**: la valoración de un puesto es GLOBAL sobre los partidos en los que ese fue su puesto con más minutos. Aparece desde dos partidos.
- **Bandas** (`GLOBAL_BANDS`): baja < 55, floja 55–61, normal 62–67, buena 68–74, muy buena ≥ 75. Las usa el medidor de forma de la mesa. La barra FOR de la pizarra (la media de GLOBAL del siete) se enciende desde «buena» y se marca baja por debajo de «normal».
- **Pizarra** (`FIT_FORM_STEP` = 10, en `pages/pizarra/v2/ratings.ts`): al colocar por posiciones exactas, un adaptado le quita el sitio a uno en su posición solo con 10 puntos más de GLOBAL, lo que va de plata a oro. Un jugador del banquillo con el mismo encaje entra por uno del campo con unos 10 puntos más: 6 si dijo «voy», 8 si no contestó.

## Lo que vale cada acción (en goles)

El acta decide los recuentos: goles, asistencias, tarjetas y penaltis. La narración añade lo que pasó alrededor y lo que se deduce de ella cuenta igual. «× F7» es la calibración de las ocasiones (abajo).

| Acción | Valor |
| --- | --- |
| Gol | +1,0 × el peso de su puesto (×2,5 portero, ×1,5 defensa, ×1,25 medio, ×1 delantero); el remate que es gol no suma aparte |
| Asistencia | +0,3 + el pase clave (+0,08 × F7 si la narración no lo valoró ya) |
| Remate | su ocasión × F7 (área 0,12, cabeza 0,08, falta directa 0,05, fuera 0,04), +0,02 a puerta o al palo |
| Pase clave | la ocasión del remate que crea × F7 (0,08 sin remate enlazado) |
| La ocasión, de quien la crea | si un compañero remata tras tu pase clave, la ocasión es tuya y él solo suma sus +0,02 a puerta; si regatea o conduce antes de rematar, se la fabricó él: la ocasión es suya y tu pase vale +0,05 |
| Pase (raso, alto, saques) | contra el acierto del equipo en ese tipo en ese partido: bueno +0,034 × (1 − acierto), fallado −0,034 × acierto (desviado, la mitad). El pase medio vale 0 (ASA g+) |
| Pase atrás bueno / fallado | igual, contra el acierto de los pases atrás del equipo |
| Pase bajo presión o cambio de orientación | +0,004 más |
| Centro, pase en profundidad o pase al área que llega | +0,05 (un córner o una falta indirecta son un centro) |
| Saques de banda y de puerta | la mitad de un pase; el de centro, 0 |
| Pase recibido / control fallado | +0,032 × (1 − acierto del equipo al recibir) / −0,032 × ese acierto |
| Pérdida | −0,03 |
| Regate bueno / fallado | +0,01 + la amenaza que gana (+0,04 sin zona) / −0,03 (pierde el balón) |
| Conducción buena | +0,004 |
| Recuperación / intercepción | +0,03 / +0,04, el doble en el área propia; la intercepción que corta sin quedarse el balón, la mitad |
| Despeje | a un compañero +0,04, fuera +0,02, al rival +0,005, fallado −0,02 |
| Remate bloqueado / pase bloqueado | la ocasión del remate × F7 / +0,02 |
| Entrada ganada / neutra / fallada | +0,04 / +0,02 / −0,02 |
| Duelo ganado / perdido / le superan | +0,01 / −0,01 / −0,04 (lo que gana el regate) |
| Presión con éxito | +0,01 |
| Portero: goles evitados | (Σ probabilidad de gol de cada remate a puerta recibido − goles encajados) × n / (n + 15), con n los remates a puerta. Área 0,50, cabeza 0,35, fuera 0,25 y mesa 0,42, × la calibración del portero (como mucho 0,95); penalti 0,78 (fuera o al palo no es parada) |
| Portero: balón atrapado | +0,06 (una recuperación en el área propia) si el rival amenazaba; +0,01 tras un despeje rival o un pase nuestro |
| Portero: centro atrapado / salida / puñetazo | +0,06 / +0,08 (fallada −0,02) / como un despeje |
| Portero: saque bueno / fallado | +0,004 / −0,03 × (acierto en saques de puerta / acierto en raso) |
| Error que acaba en gol | −0,1 y la ocasión que regala (la del gol × F7), además de la acción fallada (ver abajo) |
| Error señalado que acaba en remate | la ocasión que regala (Opta: «error leading to shot») |
| Error señalado por la narración | −0,05 (solo «error»: una cobertura no resta) |
| Ocasión clarísima (solo con el criterio del club declarado en el perfil: el de Opta desde el perfil v2) | creada +0,1 / fallada −0,1 (Sofascore) |
| Falta cometida / recibida | −0,01 / +0,01; una falta táctica, 0 |
| Amarilla | −0,05 (en la liga no supone exclusión) |
| Expulsión (roja o doble amarilla, una vez) | −0,1 − 1,0 × la parte del partido que quedaba (StatsBomb: una roja en el minuto 1 ≈ 1,08 goles); sin minuto, cuando acabó su último tramo |
| Gol en propia | −0,8 |
| Ocasión de la mesa (solo sin narración) | +0,08 × F7 |

**Calibración F7**: la tabla de ocasiones es la de los profesionales (0,09–0,13 por remate sin penalti). En fútbol 7 se marca más, así que la tabla se multiplica por la media de los dos equipos de (goles + 10) / (Σ ocasiones + 10):

- Cuentan los remates sin penalti de cada equipo en los partidos narrados de la temporada hasta el acta.
- Cada equipo pesa lo mismo, para que los muchos remates de uno no fijen la calibración del otro. En la J2, los 54 remates del Pitutis (×2,75) pesaban casi el doble que nuestros 30 (×1,34).
- Un equipo cuyos remates no cuenta la narración se queda en la tabla (×1): sus goles sin sus fallos la inflarían.
- Parte de la tabla y se recalibra sola cada jornada: ×1,17 tras la J1 y ×1,35 tras la J2.

**Calibración del portero**: la probabilidad de gol de un remate a puerta con un portero normal (área 0,50, cabeza 0,35, fuera 0,25, mesa 0,42) se multiplica igual, por la media de los dos equipos de (goles + 10) / (Σ probabilidades + 10), con sus remates a puerta sin penalti. Queda como mucho en 0,95. Así no la fijan los remates contra nuestro portero (27 de los 35 a puerta en la J2): ×1,01 tras la J1 y ×1,10 tras la J2.

**Penaltis (opción A)**, al 0,78 (Opta 0,79, StatsBomb 0,78, Wyscout 0,76; el de fútbol 7, a 9 m de una portería de 6×2, se ve con el mismo ángulo que el de 11 m):

- cometido: −(0,78 − el peligro que ya había × F7). Ese peligro sale de la zona de la última jugada rival y, por defecto, es el del área (0,12);
- provocado: +(0,78 − 0,12 × F7);
- fallado: −0,78;
- marcado: +0,22;
- parado: dentro de los goles evitados del portero (esperado 0,78; encajado cuesta 0,22). El del acta cuenta aparte solo si no hay goles evitados.

**Error que acaba en gol**: solo si es directo, y solo donde la narración cuenta el juego del rival (la mesa apunta sus goles, no las jugadas de antes). Nuestra última jugada antes del gol rival es un fallo con el balón: un pase, un control o un saque fallados, una pérdida, un rechace, un puñetazo o una salida fallados del portero, o lo que la narración marca como error. Que te regateen no es un error (Opta lo separa como «duelo perdido»). Además, no hubo saque ni reanudación entre medias y el gol llegó con 5 jugadas rivales y 2 pases rivales como mucho. Un gol de penalti no suma este extra.

**Una jugada, un peligro**: en una jugada rival sin gol (hasta que ganamos el balón o se para el juego), sus bloqueos y paradas se reparten 1 − Π(1 − c) en vez de sumar la ocasión de cada uno: de una jugada solo puede caer un gol (FBref/Opta, ASA).

**El mismo balón, una vez**:

- Una pérdida justo después de un fallo propio es ese fallo.
- Una recuperación justo después de su intercepción, despeje, bloqueo o entrada o duelo ganado es esa acción.
- Un pase o un saque del portero fallados seguidos del control fallado del receptor se reparten a medias.
- Un duelo y una entrada enlazados son una acción.

## Ajustes

- **Volumen de narración**: lo narrado se multiplica por (volumen mediano de la temporada / volumen del partido), con las acciones de los dos equipos cada 50′. Un partido contado con menos detalle no penaliza, y tener el balón no hace que cada acción valga menos. Lo del acta no se escala.
- **Posesión**: no se ajusta. StatsBomb lo usa para comparar jugadores en una temporada (y solo entradas e intercepciones), Sofascore no lo usa, y los goles encajados ya los cobra la parte del equipo.
- **Rival**: se usan sus puntos por partido en la clasificación del día en que se publica el acta, ajustados con 2 partidos a la media de la liga. Ante un rival fuerte lo bueno vale hasta ×1,15 y los fallos restan hasta ÷1,15; ante uno débil, al revés. Sus goles marcados y encajados fijan lo normal de la parte del equipo (una clasificación sin goles apuntados no). Solo se aplica si la clasificación va como mucho 2 jornadas por detrás (los amistosos no cuentan como jornada) y el nombre del rival identifica una sola fila.
- **Plus-minus de temporada**: se mide el xG a favor menos en contra con él en el campo frente a sin él, cada 50′, pero **no cuenta** (`PLUS_MINUS_ACTIVE = false`). En la J11 se hará la prueba de mitades. Si es estable, entra con un colchón de 400′ y un tope de ±0,5 de nota; si no, se descarta.

## Reglas de datos (de GLOBAL de Adrián)

- Sin minutos en el acta no hay nota: no se inventan. Un acta antigua sin ledger cuenta como partido jugado, sin nota.
- Lo desconocido no es fallo: un pase sin resultado no resta.
- Un enriquecimiento canónico sustituye a su evento del acta y nunca cuenta dos veces.
- **Portero**: solo se le acredita con prueba (un intervalo GK de la narración, o POR todo el partido sin estimar) y cuando los goles en contra narrados cuadran con el acta.
- **Partidos**: cuenta la última revisión de cada uno, sin archivados, cancelados ni pendientes. Nunca se mezclan temporadas en un GLOBAL. Los invitados no se valoran.

## Lo que no cuenta

- **Los votos MVP**: la votación cierra días después, contaría dos veces lo mismo y admite voto estratégico. El MVP sigue como atributo de la carta, estrella y medallas.
- **El marcador como tal**: un gol vale lo mismo con 0–0 que con 5–0. Lo que pasó con el equipo cuenta por los minutos de cada uno en el campo, no por el resultado final.

## Pendiente de calibrar y de pedir

- Con la temporada: P(gol de penalti) = 0,78; los pesos de la parte del equipo; el rango del oficio (×2/3 a ×1,5) y sus 200′ de colchón.
- En la J11: la prueba de mitades del plus-minus; que la media de los porteros no quede por encima de 6,5 (si pasa, fijar su referencia con la temporada).
- Pedir a la narración: la colocación del remate a puerta (o «parada de mérito» / «imparable»: necesita un dato y números nuevos) y la clasificación con goles. Desde el 27 de octubre de 2026 el prompt (`alwaysRecord` en `src/lib/narrationPrompt.ts`) ya pide los pases que entran en el área, los puñetazos y salidas del portero y las zonas; las reglas de esta página los valoran cuando llegan.
- La ocasión clarísima: desde el 27 de octubre de 2026 el perfil por defecto (`piti-narration` v2, en `functions/src/narrated/types.ts`) declara como `bigChanceCriterion` el criterio de Opta, el que aplica Sofascore: «Ocasión clarísima (Opta) v1: situación en la que se espera razonablemente que el jugador marque, normalmente un mano a mano con el portero o un remate desde muy cerca, con el camino a la portería despejado y poca o moderada presión sobre el rematador. Los penaltis siempre lo son.» El prompt de un partido nuevo la pide con ese texto. Un análisis ya guardado conserva el perfil con el que se narró, así que la J1, narrada antes, no cambia. Un penalti no suma por esta regla: ya cuenta como penalti.

## Fuentes

Sofascore (cómo se calcula la nota); The Analyst / Opta (definiciones: error frente a duelo perdido; penaltis); ASA (goals added: el pase medio ≈ 0; porteros); KU Leuven (xT frente a VAEP); StatsBomb (ajuste por posesión; su artículo de 2013 sobre las rojas y las ocasiones manifiestas, «DOGSO»); FBref / Opta (xG por posesión); FPL (puntos por gol según el puesto, temporada 2026/27: premierleague.com/news/2174909) y LaLiga Fantasy (puntos por goles encajados); Relevo (puntos del portero); normativa de fútbol 7 de Euskadi (penalti a 9 m); ESMP 2025 (Sofascore y Flashscore: ganar frente a perder); Gelade y Hvattum 2020, Kharrat et al. (plus-minus).
