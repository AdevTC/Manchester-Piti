# Medias: GLOBAL, FOR y la nota de cada partido

GLOBAL es el número de la carta del perfil, los cromos de la pizarra, la ficha de jugador, «¿Quién ha venido?» de la mesa y el cromo del admin. Todos lo leen del mismo cálculo (`src/lib/seasonRating.ts`), con los mismos partidos y la misma clasificación, así que nunca difieren. Modelo `piti-media-v1` (octubre de 2026); las decisiones se tomaron con el usuario acción por acción.

El código está en `src/lib/rating/`:

- `constants.ts`: todos los números del modelo.
- `values.ts`: lo que vale cada acción de un partido.
- `season.ts`: notas, GLOBAL y FOR.
- `rival.ts`: la fuerza del rival.

Cambiar un número es cambiar el modelo: sube `MODEL_VERSION` y actualiza esta página.

## La nota de un partido (0–10)

1. Cada acción vale lo que cambia, en goles, la probabilidad de marcar o de encajar (VAEP, xT, g+). La suma es su valor del partido.
2. Ese valor se pasa a **cada 50′**, con un colchón de 10′ de la media de su línea: un rato corto se acerca a lo normal de su línea, no a cero. Con menos de 10′ no hay nota.
3. Se compara con la **media de su línea**: la de los otros jugadores de la línea, sin contarle a él, ponderada por los minutos que jugó en cada línea ese partido. La línea parte de 4 partidos con la media del equipo hasta que tiene muestra. Si el acta no dice dónde jugó, se le compara con el equipo.
4. La diferencia se divide por la dispersión de la temporada (mínimo 0,15 goles cada 50′). La nota es 6,5 más esa diferencia, entre 0 y 10. **6,5 es un partido normal.**

## GLOBAL y FOR (0–99)

- **GLOBAL** = 10 × (Σ peso·nota + 3 × 6,5) / (Σ peso + 3). La media parte de tres partidos de 6,5 para que pocos partidos no decidan.
- **Peso de un partido**: 1 desde 30′ jugados y en proporción por debajo (15′ = medio partido). Un partido sin narración (solo acta y mesa) pesa la mitad.
- **FOR**: la misma fórmula sobre sus 5 últimos partidos con nota, con colchón de un partido.
- **Estado**:
  - «provisional» hasta 150′ con nota.
  - «—» sin ninguna nota.
  - Sin GLOBAL ni FOR al mezclar temporadas; las notas siguen valiendo para las posiciones.
- **Tipos de carta**: oro desde 75, plata de 65 a 74 y bronce por debajo de 65. «En racha» (gol o asistencia en las tres últimas) manda sobre el tipo.
- **Posiciones**: la valoración de un puesto es GLOBAL sobre los partidos en los que ese fue su puesto con más minutos. Aparece desde dos partidos.
- **Bandas de la mesa** (`FORM_BANDS`): baja < 55, floja 55–61, normal 62–67, buena 68–74, muy buena ≥ 75.

## Lo que vale cada acción (en goles)

El acta decide los recuentos: goles, asistencias, tarjetas y penaltis. La narración añade lo que pasó alrededor y lo que se deduce de ella cuenta igual.

| Acción | Valor |
| --- | --- |
| Gol | +1,0 (el remate que es gol no suma aparte) |
| Asistencia | +0,3 + el pase clave (+0,08 si la narración no lo valoró ya) |
| Remate | su ocasión (área 0,12, cabeza 0,08, falta directa 0,05, fuera 0,04), +0,02 a puerta o al palo |
| Pase clave | la ocasión del remate que crea (0,08 sin remate enlazado) |
| Pase raso bueno / atrás | +0,004 / +0,002 |
| Pase fallado | −0,03 × (acierto del equipo en ese tipo / acierto en raso); desviado, la mitad |
| Pase difícil bueno | +0,004 × (1 − acierto del tipo) / (1 − acierto en raso); bajo presión o cambio de orientación, +0,004 más |
| Centro / pase en profundidad que llega | +0,05 (un córner o una falta indirecta son un centro) |
| Saques de banda y de puerta | la mitad de un pase; el de centro, 0 |
| Pase recibido | +0,002 al receptor |
| Pérdida, control fallado | −0,03 |
| Regate bueno / fallado | +0,01 + la amenaza que gana (+0,04 sin zona) / −0,015 |
| Conducción buena | +0,004 |
| Recuperación / intercepción | +0,03 / +0,04, el doble en el área propia |
| Despeje | a un compañero +0,04, fuera +0,02, al rival +0,005, fallado −0,02 |
| Remate bloqueado / pase bloqueado | lo que valía el remate / +0,02 |
| Entrada ganada / fallada | +0,04 / −0,02 |
| Duelo ganado / perdido / le superan | +0,01 / −0,01 / −0,03 |
| Presión con éxito | +0,01 |
| Portero: goles evitados | Σ probabilidad de gol de cada remate a puerta recibido (área 0,50, cabeza 0,35, fuera 0,25; mesa 0,42) − goles encajados, sin penaltis |
| Portero: centro atrapado / balón atrapado / saque bueno | +0,04 / +0,01 / +0,004 |
| Error que acaba en gol | −0,1 además de la acción fallada (ver abajo) |
| Error señalado por la narración | −0,05 |
| Falta cometida / recibida | −0,01 / +0,01; una falta táctica, 0 |
| Amarilla / expulsión (roja o doble amarilla, una vez) / gol en propia | −0,05 / −0,3 / −0,8 |
| Ocasión de la mesa (solo sin narración) | +0,08 |

**Penaltis (opción A)**: un penalti cometido cuesta lo que cambia la jugada: 0,70 (probabilidad de gol) menos el peligro que ya había. Ese peligro sale de la zona de la última jugada rival y, por defecto, es el del área (0,12). Las reglas simétricas:

- provocado: +(0,70 − 0,12)
- parado: +0,70
- fallado: −0,70
- marcado: +0,30

**Error que acaba en gol**: solo si es directo. Nuestra última jugada antes del gol rival fue fallida, no hubo saque ni reanudación entre medias y el gol llegó en 5 jugadas rivales o menos. Un gol de penalti no suma este extra.

**El mismo balón, una vez**:

- Una pérdida justo después de un fallo propio es ese fallo.
- Una recuperación justo después de su intercepción, despeje, bloqueo o entrada o duelo ganado es esa acción.
- Un pase fallado seguido del control fallado del receptor se reparte a medias.
- Un duelo y una entrada enlazados son una acción.

## Ajustes

- **Volumen de narración**: lo narrado se multiplica por (volumen mediano de la temporada / volumen del partido). Un partido contado con menos detalle no penaliza. Lo del acta no se escala.
- **Posesión**: las acciones defensivas se multiplican por 0,5 / (parte rival de los pases), entre 0,7 y 1,3. Defender más porque el rival tuvo el balón no es defender mejor.
- **Rival**: se usan sus puntos por partido en la clasificación actual, ajustados con 2 partidos a la media de la liga. Ante un rival fuerte lo bueno vale hasta ×1,15 y los fallos restan hasta ÷1,15; ante uno débil, al revés. Solo se aplica si la clasificación va como mucho 2 jornadas por detrás (los amistosos no cuentan como jornada) y el nombre del rival identifica una sola fila.
- **Plus-minus**: se mide el xG a favor menos en contra con él en el campo frente a sin él, cada 50′, pero **no cuenta** (`PLUS_MINUS_ACTIVE = false`). En la J11 se hará la prueba de mitades. Si es estable, entra con un colchón de 400′ y un tope de ±0,5 de nota; si no, se descarta.

## Reglas de datos (de GLOBAL de Adrián)

- Sin minutos en el acta no hay nota: no se inventan. Un acta antigua sin ledger cuenta como partido jugado, sin nota.
- Lo desconocido no es fallo: un pase sin resultado no resta.
- Un enriquecimiento canónico sustituye a su evento del acta y nunca cuenta dos veces.
- **Portero**: solo se le acredita con prueba (un intervalo GK de la narración, o POR todo el partido sin estimar) y cuando los goles rivales narrados cuadran con el acta.
- **Partidos**: cuenta la última revisión de cada uno, sin archivados, cancelados ni pendientes. Nunca se mezclan temporadas en un GLOBAL. Los invitados no se valoran.

## Lo que no cuenta

- **Los votos MVP**: la votación cierra días después, contaría dos veces lo mismo y admite voto estratégico. El MVP sigue como atributo de la carta, estrella y medallas.
- **El marcador**: un gol vale siempre lo mismo.

## Pendiente de calibrar

- P(gol de penalti) = 0,70.
- Las probabilidades de gol de los remates a puerta para el portero.
- La prueba de mitades del plus-minus en la J11.
