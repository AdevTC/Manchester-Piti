# La mesa: crítica de diseño

Fecha: 2026-10-17. Sobre el canvas «La mesa · partido en vivo (Copy)» (https://claude.ai/artifact/Jt9fXoRgguUqmAaazfTKSm)
y la spec `2026-10-16-mesa-en-vivo-design.md`. No toca la spec, el canvas original ni el código.

## Cómo se ha revisado

- Los 8 artboards de la Copy, renderizados en local a 390 × 844 con el runtime del propio canvas
  (`dc-runtime.js`), con medición automática de textos que se pisan, se cortan o se salen, y
  contraste WCAG de cada texto.
- La app en local (emuladores y semilla de prueba, un partido en juego con goles y tarjeta): la
  página del partido con la «Mesa de partido» (Banda), el «En juego» del admin, Hoy, Partidos,
  Perfil «La carta» y Pizarra «Noche de partido».
- DESIGN.md, PRODUCT.md y la spec.

## Veredicto

La mesa ya cumple lo difícil: todo lo común se apunta en dos toques o menos, el campo y el banquillo
están siempre a la vista, el estado sin cobertura no esconde nada y la crónica con autor y
duplicados es clara. Es una herramienta buena.

No es espectacular por tres motivos:

1. **El momento firma (el gol) tapa justo lo que hay que comprobar.** «¡GOOOL!» cubre el marcador
   1,5 s y la asistencia se elige en una fila de chips que se corta por la derecha.
2. **Es la receta otra vez.** Noche azul marino, LED de puntos, titular enorme («Victoria», «Por
   delante, y con dos palos»), sello dorado girado y tarjetas apiladas. Está bien hecha, pero es
   la misma receta de la que te cansaste. La mesa no tiene un lenguaje propio.
3. **Está pensada para mirarla, no para la banda.** Hay textos de 9,5 a 11 px, solo existe el tema
   de noche a pleno sol, la vibración no llega a los iPhone y el error más caro (un gol del rival
   apuntado sin querer, que avisa a todo el club) cuesta un toque.

## Fallos del canvas que no deben pasar al código

| Dónde | Qué | Medido |
|---|---|---|
| Todos los CTA dorados (GOL del Piti, Pitar el inicio, Arrancar la 2ª, Publicar el acta) | El texto sale blanco sobre oro: `.ms button{color:inherit}` gana en especificidad a `.cta` | 1,41:1 (AA pide 3:1) |
| En juego, al apuntar un gol | El lower third tapa la última línea del banquillo; los chips de asistencia se cortan (el 4º a medias, el 5º fuera, en x 397–475) | captura y medición |
| En juego | «¡GOOOL!» tapa el marcador durante 1,5 s | captura |
| En juego, Sin cobertura | «sin jugar», «fuera 14′», minutos y «sin subir» a 9,5–10,5 px en mono | |
| En juego | En un móvil de 375 × 667 (iPhone SE/8) la pila de 844 px no cabe: el dock fijo taparía el banquillo | cálculo de alturas |
| En juego | Amarilla y roja en el campo se distinguen solo por el color (dos rectángulos iguales) | regla «nunca solo color» |
| Final | Chips «¿Le dio el pase alguien?» de 34 px | por debajo de 44 |
| Lo que va pasando | El punto de presencia late sin regla de `prefers-reduced-motion` (Cronica.dc.html no tiene ninguna); «Tarjetas» se sale del borde sin pista de scroll | |
| Sin cobertura | El spinner gira aunque no esté pasando nada (está esperando señal) | |

## Propuestas, por impacto para quien anota

Coste aproximado: **S** ≤ 1 día, **M** 2–3 días, **L** una semana o más (front y back).
«Cambia una decisión tuya» señala lo que contradice la spec o lo que acordamos.

### 1. En juego · «El campo es el teclado» (boceto 1)

- **Qué cambia:**
  - «GOL del Piti» no abre una hoja: las camisetas del campo se marcan y se toca quién marcó.
  - Después el campo pide el pase: las demás camisetas se marcan y se toca quién la dio, o
    «Sin asistencia». «Deshacer el gol» queda al lado.
  - Para un cambio, se toca a quien entra en el banquillo y luego a quien sale en el campo; desde
    la hoja de un jugador («Cambio»), el banquillo se marca para elegir quién entra.
  - La hoja de acciones del jugador se queda solo para las acciones menos frecuentes.
- **Por qué:**
  - Los tres flujos más comunes dejan de tapar el campo con una hoja.
  - La asistencia se elige con objetivos grandes y en su sitio, sin chips que se corten.
  - Quien anota aprende dónde está cada uno y deja de leer nombres.
  - Los toques no cambian: gol en 2, pase opcional en 1 más, cambio en 2.
- **Coste:** M.
- **Decisión:** no cambia ninguna decisión. Cambia la forma de «¿Quién marcó?» y «¿Por quién?»
  (de hoja a campo), no su comportamiento.

### 2. El marcador confirma en vez de tapar (boceto 1)

- **Qué cambia:**
  - El marcador usa las fichas que giran de Partidos (la cuenta atrás), no el LED de puntos.
  - Al marcar, la cifra gira con un anillo dorado (rojo si marca el rival).
  - No hay capa encima.
- **Por qué:**
  - Para comprobar que se apuntó, basta con mirar la cifra nueva.
  - Lo emparenta con Partidos sin repetir el LED del admin.
- **Coste:** S.
- **Cambia una decisión tuya:** la spec dice «¡GOOOL! flashes on our goal».

### 3. Tema «sol» para la mesa (bocetos 2 y 3, y el 1 con su Tweak)

- **Qué cambia:**
  - La mesa usa el tema de día de DESIGN.md: navy como tinta y como acción, y el oro oscurecido.
  - Se elige solo según la hora del partido (los de las 10:30 salen de día) y se puede cambiar
    con un botón en la cabecera.
  - Los textos de trabajo nunca bajan de 12 px.
- **Por qué:**
  - Con el sol de frente, texto oscuro sobre fondo claro se lee mejor que el tema de noche con
    tintes al 5–7 %.
  - El tema de día ya está diseñado, es «de primera».
- **Coste:**
  - M si la mesa nace con variables de tema;
  - L si se añade después.
- **Cambia una decisión tuya:** la spec dice «se lee a pleno sol con el tema de noche».

### 4. Vibración que sí llegue, y con código

- **Qué cambia:**
  - Un patrón distinto por tipo:
    - gol nuestro: dos golpes y uno largo;
    - gol del rival: uno largo;
    - cambio: dos cortos;
    - el resto: un toque corto;
    - jugada guardada sin red: doble corto.
  - Donde no hay vibración, un clic de sonido opcional y la confirmación visual junto al pulgar.
- **Por qué:**
  - El código de vibración deja saber qué se ha apuntado sin mirar (la meta de los ~2 s).
  - Safari en iOS no implementa `navigator.vibrate` (datos de compatibilidad de MDN), así que en
    iPhone «vibra al apuntar» no ocurre.
- **Coste:** S.
- **Decisión:** no cambia ninguna decisión, pero corrige una suposición de la spec.

### 5. El aviso de un gol espera a que se pueda deshacer

- **Qué cambia:**
  - El push de gol (nuestro o del rival) sale 8 s después de apuntarlo.
  - Si en ese tiempo se deshace, no sale.
  - El lower third lo dice: «aviso a la afición en 8 s».
- **Por qué:**
  - «Gol» del rival está a un toque, junto a «Falta».
  - Un toque sin querer cambia el marcador de todos y avisa a todo el club. Es el error más caro
    de la pantalla.
- **Coste:** M (el aviso tiene que comprobar que el evento sigue ahí; Cloud Tasks o equivalente).
- **Cambia una decisión tuya:** la spec deja los avisos como están hoy.

### 6. Descanso · «El siete de la 2ª se elige sobre los minutos» (boceto 2)

- **Qué cambia:**
  - «Quién ha jugado» deja de ser un informe y pasa a ser el selector.
  - Se toca una fila para meter o sacar a un jugador del siete. Su barra se alarga con la 2ª
    parte prevista y el total se ve («17′ → 42′»).
  - Hay tres atajos: «Como acabó», «Igualar minutos» (el portero y los seis de campo con menos
    minutos) y «Plan pizarra».
  - Una línea dice el reparto («Jugadores de campo: de 25′ a 45′»).
  - El CTA dice cuántos cambios aplica, o qué falta («Elige el siete · 6 de 7», «falta portero»).
  - Las barras reflejadas de la 1ª parte quedan en cuatro cifras.
- **Por qué:**
  - En el descanso, el trabajo de quien anota es decidir quién juega, y hoy eso es un botón
    secundario que lleva a otro sitio.
  - El reparto de minutos es lo que más discute un equipo de amigos. Así se ve antes de pitar.
- **Coste:** M (los cambios se aplican en una sola operación, como ya exige la spec para las
  oleadas de la pizarra).
- **Decisión:** no cambia ninguna decisión. Une «Preparar el siete de la 2ª» y «Arrancar la 2ª
  parte».

### 7. Final · «Mantén pulsado para firmar el acta» (boceto 3)

- **Qué cambia:**
  - El acta es una hoja con el resultado en el alfabeto G·E·P.
  - Las asistencias que faltan se piden en línea, con chips de 44 px y «Nadie».
  - Una lista «antes de firmar» muestra jugadas subidas, dudas entre anotadores, minutos y
    asistencias (opcionales).
  - Para publicar se mantiene pulsado un segundo: una barra y un anillo se llenan, y al soltar
    antes se cancela.
  - Al firmar aparecen la firma, el nombre y la hora, y lo que ha desencadenado (stats, un logro,
    la votación abierta).
  - Con teclado, Enter o Espacio mantenidos.
- **Por qué:**
  - Para un anotador, publicar no tiene vuelta atrás (solo un admin reabre), y un toque es
    demasiado barato.
  - La lista explica por qué el botón estaría bloqueado (bandeja «Por revisar», duplicados) en vez
    de dejarlo gris sin más.
  - Sale de la receta: no hay «Victoria» gigante ni sello girado.
- **Coste:** S–M.
- **Decisión:** no cambia ninguna decisión (la spec no define cómo se confirma).

### 8. El rival arriba y el ataque hacia el pulgar (boceto 1, abierto a debate)

- **Qué cambia:**
  - La fila del rival pasa encima del campo.
  - El campo se dibuja atacando hacia abajo: portero arriba, delantero junto al dock.
- **Por qué:**
  - Las jugadas nuestras más frecuentes (ocasión, palo, falta recibida) son de delanteros y
    medios, y hoy están en la zona del móvil a la que peor llega el pulgar.
  - Con el rival lejos del pulgar, «Gol» del rival se toca menos sin querer.
- **Contra:**
  - En la pizarra el portero está abajo.
  - Paradas y faltas del rival quedan más lejos.
- **Coste:** S.
- **Decisión:** no cambia ninguna decisión de la spec, pero rompe la coherencia con la pizarra.

### 9. El eco del otro anotador

- **Qué cambia:** cuando David apunta algo, tu lower third lo muestra al momento («David · Gol de
  Mario · 19′ · ya cuenta»).
- **Por qué:** evita el duplicado antes de que aparezca la tarjeta «¿Es la misma jugada?», que
  queda como red de seguridad.
- **Coste:** S (los eventos ya llegan en tiempo real).
- **Decisión:** no cambia ninguna decisión.
- No está bocetado.

### 10. Pantallas bajas

- **Qué cambia:** por debajo de unos 740 px de alto:
  - el reloj y el añadido se pliegan dentro de la tira del marcador;
  - el banquillo pasa a una fila de dorsales.
- **Por qué:** en un iPhone SE/8 la pantalla no cabe.
- **Coste:** S–M.
- **Decisión:** no cambia ninguna decisión.

### 11. Retoques menores

Todos son S y ninguno cambia una decisión tuya.

- **Antes del pitido:**
  - el siete se dibuja en el mismo campo de En juego (donde vas a tocar);
  - un «Probar aviso» para comprobar la vibración o el sonido antes de empezar.
- **Sin cobertura:** cambiar el spinner por la cuenta fija («3 en el móvil») y «último intento
  hace 20 s».
- **Lo que va pasando:**
  - una pista de scroll en los filtros;
  - aplicar reduced motion al punto de presencia.
- **Tarjetas en el campo:** letra o forma además del color («A», «R»; la segunda amarilla
  como «2A → R»).

## Pantalla por pantalla

| Pantalla | Velocidad en la banda | Dos anotadores / sin red | Coherencia | Accesibilidad | Qué le falta para ser espectacular |
|---|---|---|---|---|---|
| En juego | Bien: 1–2 toques, todo a la vista. Mal: delanteros en la zona difícil, textos de 10 px, la hoja tapa el campo | Chip «al día» bueno; sin eco de lo que apunta el otro | Es el LED del admin; parece «En juego» del admin en móvil | CTA a 1,41:1; tarjetas solo por color; stepper de 40 px de ancho | Propuestas 1, 2, 4, 5 |
| Antes del pitido | Se usa una vez; bien | Dice quién anota: bien | Titular grande y fila de tarjetas: la receta | CTA a 1,41:1 | Propuesta 11 |
| Lo que va pasando | Filas de 56 px, buenas; el swipe no se descubre, pero «···» lo cubre | La mejor pantalla para dos anotadores; autor y «corregido por» muy claros | Bien | Punto que late sin reduced motion; filtros de 40 px | Poco: es una herramienta y está bien así |
| Sin cobertura | Igual que En juego | Muy claro, no esconde nada | Bien | El estado tiene chip con texto, no solo ámbar: bien | Propuesta 11 |
| Descanso | Es un informe; la acción es un botón secundario | — | Titular a dos líneas, marquesina: la receta | Marquesina con fallback: bien | Propuesta 6 |
| Final | Chips de 34 px; publicar en un toque | No dice qué bloquea la publicación | «Victoria» gigante y sello girado: la receta | CTA a 1,41:1 | Propuesta 7 |
| Afición (móvil y web) | No es de quien anota; no la he criticado a fondo | | Coherente con la página del partido actual | | |

## Lo que mantendría tal cual

- **La regla de dos toques y el catálogo de jugadas.** Están bien medidos: cubren todo sin volver
  a los 14 botones iguales.
- **El lower third con «Deshacer»** como única confirmación. Es el objeto de difusión correcto,
  con 4 px de radio, y no es un toast.
- **Sin cobertura = la misma pantalla con un borde y una tira.** Es la decisión más acertada del
  diseño: no se pierde el campo.
- **Lo que va pasando con autor, «corregido por» y la tarjeta de duplicado.** Es claro y honesto,
  y la tarjeta ámbar con dos salidas es exacta.
- **El banquillo bajo la línea de banda, con «sin jugar» y «fuera N′».** Dice lo que importa del
  banquillo sin abrir nada.
- **El añadido como etiqueta con stepper y el fin de parte manual.** Es simple y no engaña al reloj.
- **La cabecera** (salir, nombres completos, línea en directo, chip de presencia).
- **La gantt de «Quién ha jugado»:** la mejor idea del Descanso, y el boceto 2 la convierte en la
  herramienta.

## Bocetos

En la Copy, en una fila bajo los originales con el título «Bocetos para el debate · 17 oct». Los tres
son interactivos y tienen el Tweak «tema» (noche / sol). También están, cada uno junto a su original,
en la página «Bocetos de la mesa» (https://claude.ai/artifact/1qjCQxuW5Ph43GYFKsZ2AU).

1. **Boceto 1 · En juego: el campo es el teclado** (noche). Firma: GOL → camiseta → la cifra gira →
   el campo pide el pase.
2. **Boceto 2 · Descanso: el siete de la 2ª se elige sobre los minutos** (sol). Firma: tocar filas
   alarga las barras hacia la 2ª parte; «Igualar minutos» lo resuelve de un toque.
3. **Boceto 3 · Final: mantén pulsado para firmar el acta** (sol). Firma: la pulsación mantenida
   que se llena, la firma que se dibuja y lo que desencadena.

Se han comprobado a 390 × 844 en los dos temas y en sus estados (reposo, «¿Quién marcó?», pase,
filas cambiadas, firmando y firmada):

- ningún texto se pisa ni se sale;
- todos los textos pasan AA. Dos fallos se corrigieron: dorsales del banquillo y de las filas del
  Descanso en «sol», a 4,2:1;
- todos los controles miden 44 px o más, salvo el «−/+» del añadido (40 × 44, igual que el
  original).

## Preguntas para elegir

1. ¿Qué móviles usan los anotadores? Si son iPhone, la vibración no existe y la propuesta 4 pasa a
   ser imprescindible.
2. ¿Atacamos hacia abajo (delanteros junto al pulgar), aunque la pizarra ponga al portero abajo?
3. ¿Tema «sol» automático según la hora del partido, o solo con un botón?
4. ¿Retrasamos 8 s el aviso de gol para poder deshacerlo antes de que llegue a todos?
5. ¿Firmar el acta con pulsación mantenida, o con un toque y una confirmación?
6. ¿«¡GOOOL!» desaparece a favor de la cifra que gira, o lo quieres además, pero sin tapar el
   marcador?
