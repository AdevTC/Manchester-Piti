# Auditoría de toda la web — 2026-10-14

Revisado: `main` en bd459d8 (posiciones fase 4 incluida).

Cómo se ha hecho:
- capturas reales en el emulador de las 15 secciones, a 1440 y a 390;
- dos auditorías de código en solo lectura;
- referencias de otras apps de equipos amateur.

Informes completos:
- [Sincronización y tiempo real](2026-10-14-sync-tiempo-real.md): mapa ruta → fuente de datos, H1–H3, M1–M10, L1–L10 y 13 ideas de «que se sienta en vivo».
- [Integración, coherencia y huecos](2026-10-14-integracion-y-huecos.md): grafo de navegación, N1–N11, C1–C14, D1–D6 e ideas de producto puntuadas.

## Diagnóstico en una frase

La base en vivo es buena: un gol llega a todas las páginas en un segundo. Los fallos están en las costuras:
- un error real de listeners compartidos;
- cálculos repetidos con reglas distintas (jornada, minutos, valoración, temporada, nombre, letra del resultado);
- enlaces que faltan entre módulos;
- un partido que nadie arranca y nunca «empieza»;
- una capa de diseño repartida en el CSS de cada página.

## Errores que hay que arreglar ya

| # | Qué pasa | Dónde |
|---|---|---|
| H1 | La nota de la quedada y los anotadores comparten clave de listener y se pisan. Un anotador designado puede quedarse sin poder anotar, y el admin no puede gestionar los anotadores del próximo partido. | `vestuario/live.ts:108,342` |
| H2/N1 | El selector de temporada de /partidos vuelve atrás a partir del segundo cambio. | `PartidosPage.tsx:331` |
| H3 | Si nadie pone el reloj en marcha, el partido no empieza nunca: la cuenta atrás se queda en 00:00, aunque el push «¡Empieza!» ya ha salido. | `matchEngine.ts:350`, `push.ts:145` |
| M1 | Al abrir un partido en directo, la caché puede disparar un «¡GOL!» antiguo. | `GoalBurst.tsx:17` |
| C1 | «J5» no es el mismo partido en Convocar, en la pizarra y en /partidos. | `partidos.ts`, `adminLogic.ts`, `useBoardData.ts` |
| C2 | Una derrota sale como «P» en la home y en /partidos, y como «D» en el resto. | 7 copias |
| C4 | En la página del jugador aparece «342.67′». | `JugadorPage.tsx:134,188` |
| — | Convocar sigue mostrando la línea («DEF») en vez de la posición exacta («DFC»). | captura `admin/convocar` |

## Programa propuesto

1. **Coherencia y errores** (≈1–2 días). Arreglar H1, H2, H3 y M1. Una sola fuente para la jornada, la letra del resultado, los minutos, la valoración, la temporada actual y el nombre del jugador. Además:
   - Convocar con posición exacta;
   - El club en el dock del móvil;
   - pestaña del partido en la URL, para que los push lleven a la pestaña correcta;
   - quitar las insignias «nuevo» caducadas;
   - tipografía del admin: los títulos en fuente condensada desentonan.
2. **Todo enlazado** (≈2 días). Un `PlayerLink` en todas partes, las páginas públicas enlazadas con el admin y la pizarra, «Volver» que respeta de dónde vienes, un estado de error y un 404 con el estilo Celeste.
3. **Que se sienta en vivo** (≈2–3 días):
   - momento de gol en cualquier página;
   - isla con ciclo completo: «a punto de empezar» → directo → descanso → final → vota al MVP;
   - aviso de sin conexión;
   - hora del servidor;
   - push en el pitido final, gol anulado, ganador del MVP, ficha aprobada y posiciones revisadas;
   - apodo por uid;
   - un solo «siete», con la convocatoria y la pizarra sincronizadas.
4. **Ficha del partido 2.0** (≈2 días):
   - el campo con las posiciones reales y el sistema jugado (fase 4);
   - el panel de análisis con el estilo de la casa y más abajo;
   - convocatoria, porra y MVP como componentes compartidos.
5. **Base de diseño Celeste** (≈2–3 días):
   - piezas comunes (kicker, títulos, botones, segmentado, pestañas, tarjeta, estados);
   - borrar ~5,5k líneas de código muerto;
   - tokens `--pos-*` de la paleta;
   - DESIGN.md y la guía actualizados.
6. **Funciones nuevas**, a elegir:
   - «Hoy» de día de partido para cada socio;
   - La caja (cuotas, campo, árbitro, multas);
   - ausencias por fechas;
   - resumen de temporada para compartir;
   - centro de avisos;
   - jugador de la temporada;
   - invitados en el acta.

## Decisiones del usuario (2026-10-14)

- Los cinco bloques se hacen en el orden propuesto, sin parar y con un PR por bloque.
- Funciones nuevas para después: «Hoy» de día de partido, La caja y ausencias por fechas.
- Letras de resultado en toda la web: **G · E · P** (ganado, empatado, perdido). DESIGN.md se actualiza en consecuencia.
