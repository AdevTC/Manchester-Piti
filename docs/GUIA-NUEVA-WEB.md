# Manchester Piti · Guía de la nueva web

## Qué está implementado

- Portada pública, navegación nueva para ordenador y móvil, temas claro y oscuro.
- Calendario con búsqueda y filtro de temporada; fichas públicas de partidos y jugadores.
- Estadísticas legibles, comparador, minutos, récords, sociedades y balance ante rivales. El explorador anterior sigue accesible desde «Explorar más».
- El club: historia, hitos, campo, contacto, patrocinadores y galería, editables desde «Contenido y fotos».
- Espacios gráficos identificados para las fotos pendientes. No se presentan fotografías ajenas como fotos del equipo.
- Vestuario privado, sin clave compartida: se entra con Google y un enlace de invitación, o pidiendo acceso para que un capitán lo apruebe. En la primera visita, «¿Quién eres?» te deja elegir tu ficha.
- Disponibilidad para el próximo partido y aviso privado de quedada/material.
- MVP con una papeleta por cuenta, posibilidad de cambiar el voto y detalle de votantes visible para administradores.
- Editor de actas de fútbol 7 en cuatro pasos, borradores privados, validación, revisiones y acumulados en el servidor.
- Calendario descargable, carteles PNG cuadrado/vertical y enlaces para compartir con imagen social dinámica.

## Preparar una temporada

1. Entra al vestuario con tu Google (con una invitación o con tu acceso ya aprobado).
2. Un administrador abre **Administrar el club → Temporadas** y crea la temporada.
3. En **Jugadores**, asigna a esa temporada todos los integrantes. Ajusta sus dorsales y nombres de camiseta por temporada.
4. En **Nuevo partido**, elige temporada, rival, competición, fecha/hora de Madrid, campo y condición local/visitante.
5. Déjalo **Programado**, revisa los datos y pulsa **Publicar encuentro**. La convocatoria puede completarse más adelante.
6. Repite con el calendario que ya conozcáis. Si cambian fecha o campo, edita el encuentro existente.

El horario se interpreta siempre en **Europe/Madrid**, incluido el cambio entre verano e invierno. No depende de la zona horaria del dispositivo.

## Qué ocurre automáticamente

- La portada prioriza el encuentro en directo; si no hay ninguno, presenta el próximo partido. El último resultado tiene su propio bloque y nunca sirve de titular a un encuentro futuro.
- Antes del horario previsto: cuenta atrás hacia el encuentro más próximo. Si se alcanza la hora sin iniciar el reloj, aparece **Pendiente del pitido inicial**.
- Un administrador o anotador designado inicia la primera parte, marca el descanso, inicia la segunda y señala el final. El reloj compartido sigue esos momentos reales; las partes orientativas de 25 minutos no se cierran solas.
- Al finalizar, el resultado queda pendiente de revisión del acta y la portada puede presentar el siguiente encuentro.
- Si no hay más partidos: se muestra un estado de calendario pendiente.
- Un partido aplazado o cancelado no ocupa el contador.
- El marcador y las jugadas en directo se sincronizan entre dispositivos. Los acumulados definitivos se recalculan al publicar el acta. Nunca se interpreta un futuro encuentro como empate a cero.

Los partidos antiguos sin reloj conservan su compatibilidad con la franja de juego estimada. Para los nuevos se utiliza el reloj manual compartido.

### Recuperar una jugada del banquillo

La selección y la operación pendiente se conservan en este navegador, separadas por cuenta y partido. Tras recargar, revisa el jugador y el minuto antes de recuperar la selección o reenviar la jugada. **Pendiente**, **enviada** y **confirmada en el partido** son estados distintos: la confirmación requiere que los datos sincronizados muestren la operación.

No se reenvía nada automáticamente al volver la conexión. El reintento conserva la referencia de la jugada para evitar duplicados. Si el primer envío nunca llegó al servidor, se recupera el minuto original con precisión de minuto, sin los segundos. Un cambio de parte, un partido cerrado o un conflicto de jugadores requiere revisar el acta; los datos pendientes se pueden copiar desde el panel. Los borradores locales caducan a las 24 horas y el reenvío directo deja de estar disponible tras dos horas.

### Rankings y detalle de estadísticas

Los puestos siguen la clasificación por competición: **1, 1, 3** o **1, 2, 2, 4**. Todos los empatados reciben la misma medalla; un corte del podio no elimina a quien comparte puesto y los ceros no conceden medallas. Los titulares y los líderes de goles y asistencias también reconocen los empates.

Las secciones de Estadísticas están antes de la carrera del Pichichi; la carrera pertenece al Resumen. En Análisis del juego, las cifras interactivas abren las acciones que las justifican, con partido, jugador, momento y referencia de origen cuando existe. El detalle respeta la temporada y la cobertura seleccionadas: una narración parcial no equivale a haber registrado todo el encuentro.

### Revisar una narración

En el acta, copia el contexto del partido y úsalo al preparar el análisis narrado. Importa el archivo de acciones y pulsa **Revisar importación**: verás las acciones nuevas, las correcciones con valores **Antes / Ahora**, las que no cambian y los fragmentos de origen aportados.

Puedes filtrar por jugador y corregir una acción dentro de la importación. Las dudas deben resolverse explícitamente; escribir una explicación no modifica por sí solo las jugadas. **Incorporar al borrador** conserva las acciones ajenas a la importación y no publica el acta. Si el borrador cambia durante la revisión, hay que revisar de nuevo antes de incorporarla. Los identificadores estables evitan duplicar acciones al reimportar.

## Cerrar el acta después del partido

1. Abre el encuentro y selecciona **Finalizado**.
2. En **Convocatoria**, asigna exactamente siete titulares; marca suplentes y no convocados. El botón de completar no convocados ayuda con el resto de la plantilla.
3. En **Eventos**, registra el minuto de cada acción:
   - Gol normal, de falta o de penalti, con asistente opcional.
   - Gol rival y autogoles de ambos equipos.
   - Cambio: jugador que sale, jugador que entra y minuto.
   - Amarilla, segunda amarilla y roja directa.
   - Penalti cometido, recibido, parado o fallado; tiro al palo.
4. En **Revisión**, comprueba marcador, minutos, entradas, salidas y tramos. Los goles registrados deben coincidir con el resultado.
5. Añade crónica y, cuando existan, URLs HTTPS de fotos. Puedes preparar un resumen a partir de los hechos anotados y editarlo.
6. Publica el acta. Se actualizan partido, perfiles, tablas y acumulados de temporada.

Los cambios admiten reingresos: salir en el 20 y volver en el 45 produce dos tramos, sin duplicar minutos. Una expulsión detiene el tiempo jugado. Una tarjeta a un suplente que no entra no le suma un partido. Para la segunda amarilla se registra también la primera; el total queda en dos, no tres.

Los eventos del mismo minuto se procesan en el orden de registro: anota el cambio antes de una acción del jugador que acaba de entrar. Si se introdujeron en orden contrario, elimina y vuelve a añadir los eventos afectados en orden cronológico.

Los errores aparecen antes de publicar y se validan de nuevo en el servidor. **Guardar borrador** permite dejar un acta incompleta sin modificar su versión pública. Si otro administrador publica durante la edición, la revisión bloquea la sobrescritura accidental; hay que abrir de nuevo el partido.

Corregir una acta reemplaza su contribución anterior a los acumulados. No la suma dos veces. Si una corrección excluye a alguien que recibió votos al MVP, se retiran sus papeletas y esos miembros pueden votar de nuevo mientras siga abierto.

## Votación y acceso

La votación se abre al publicar la primera acta final y dura 48 horas. Editarla no prolonga ese plazo. Solo se puede votar a jugadores que participaron. Cada UID de Google tiene una papeleta por partido.

Ya no hay clave del equipo. Un capitán crea un enlace de invitación (`/invitacion/<código>`, válido de 1 a 30 días, 7 por defecto, de un solo uso o sin límite de usos y, si quiere, una ficha reservada) y puede revocarlo. Quien no tiene invitación pide acceso desde la puerta y un capitán lo aprueba o lo rechaza. Las invitaciones, las solicitudes y la pertenencia se comprueban en Cloud Functions y en las reglas de Firestore. La pertenencia va con la cuenta de Google y dura hasta que un administrador la retira.

Los perfiles y nombres únicos se registran mediante transacción. Los roles administrativos existentes se conservan. La cuenta propietaria verificada conserva el mecanismo de superadministrador del proyecto.

Los datos deportivos públicos se separan de los votos individuales, los avisos de equipo, la disponibilidad, los borradores y los perfiles privados.

## Fotos y contenido

**Contenido y fotos** permite cambiar textos, imagen principal, galería, hitos, patrocinadores, contactos, biografías y fotos de jugadores. Las fotos se incorporan mediante URL HTTPS; no se ha añadido un servicio de subida de archivos.

Mientras no haya fotos propias se ven espacios gráficos preparados para ellas. Campo, historia, año de fundación y contactos permanecen pendientes si no se han facilitado: no se inventan datos del club.

## Historial anterior

### Archivar, reactivar y eliminar partidos

Solo los administradores pueden gestionar estas acciones desde **Administración → Partidos**. **Archivar partido** y **Borrar partido** están siempre visibles en las cuatro pestañas del editor y en la pantalla que aparece después de publicar, también para partidos terminados. Ambas acciones muestran el rival, la fecha y sus consecuencias antes de confirmar.

- **Archivar** conserva el acta, los eventos, los votos, las porras y el resto de datos vinculados. El encuentro sale del calendario público, de los avisos y de todas las estadísticas, récords y clasificaciones. Se consulta en modo de solo lectura desde **Archivados**.
- **Reactivar** devuelve el partido y sus aportaciones a las estadísticas. Un borrador se recupera como borrador. Si su temporada está archivada, hay que reactivar primero la temporada; hacerlo no reactiva automáticamente los partidos archivados individualmente.
- **Borrar** elimina definitivamente el encuentro y sus datos vinculados, incluidos borradores, convocatoria, votos, pronósticos y pizarras. Se recalculan los acumulados y la porra sin ese partido. No hay opción de deshacer.

Se puede archivar cualquier partido aunque tenga el reloj iniciado: se pausa automáticamente mientras permanece archivado y, al reactivarlo, continúa en la misma parte o descanso. Ese intervalo no suma minutos de juego ni de descanso y se conservan las horas originales. Las pestañas antiguas no pueden seguir editando un encuentro archivado ni recrear uno eliminado. El servidor conserva únicamente una marca interna del identificador eliminado, sin contenido del partido ni datos personales, para impedir esa recreación.

La retirada de las estadísticas se confirma junto al borrado del partido. La limpieza de sus datos vinculados tiene además un proceso de recuperación en el servidor, por si la operación se interrumpe después de retirar el encuentro.

Los resultados y eventos existentes siguen disponibles. Las estadísticas antiguas usan sus datos originales. Los minutos y situaciones iniciales que nunca se registraron se muestran como desconocidos, sin estimarlos.

Para convertir un encuentro antiguo a acta completa hay que proporcionar siete iniciales, convocatoria, minutos y goles de ambos equipos. No es necesario convertir todo el historial para empezar la próxima temporada.

Los acumulados de `playerSeasonStats` corresponden a actas completas nuevas/convertidas. Las páginas combinan estos datos de acta con el historial de eventos al calcular las cifras mostradas.

## Desarrollo local

Requisitos: Node 22, Java 21 o superior para los emuladores.

```text
npm install
npm ci --prefix functions
npm --prefix functions run build
npm run dev -- --host 127.0.0.1 --port 3001
```

La instalación reproducible del frontend usa `npx pnpm install --frozen-lockfile`. La configuración pública de Firebase está en el archivo local ignorado `.env`; `.env.example` sirve de plantilla.

El servidor 3001 utiliza la configuración habitual de Firebase. Las funciones y reglas del vestuario, incluida la gestión de partidos archivados, están desplegadas en ese proyecto real; usa los emuladores para las pruebas que escriban datos.

### Pruebas aisladas

```text
npm --prefix functions run build
npm run emulators
```

Con los emuladores abiertos, en otra terminal:

```text
npm --prefix functions test
npx vitest run --config vitest.rules.config.ts
npm --prefix functions run seed:preview
```

El proyecto de pruebas es `demo-manchester-piti`. Los scripts usan exclusivamente endpoints de loopback y no escriben en producción. La semilla crea una temporada y diez jugadores ficticios, un encuentro futuro y un acta 2–1. El botón **Google de prueba · Solo emulador** únicamente aparece en desarrollo con emuladores; la invitación y la pertenencia se siguen comprobando en el backend.

Para levantar la interfaz de prueba en PowerShell:

```powershell
$env:VITE_USE_FIREBASE_EMULATOR = '1'
$env:VITE_FIREBASE_PROJECT_ID = 'demo-manchester-piti'
$env:VITE_FIREBASE_API_KEY = 'demo-key'
$env:VITE_FIREBASE_AUTH_DOMAIN = 'demo-manchester-piti.firebaseapp.com'
$env:VITE_FIREBASE_APP_ID = 'demo-app'
npm run dev -- --host 127.0.0.1 --port 3002
```

Usa una terminal separada y ciérrala al terminar para no reutilizar accidentalmente esas variables en un build real.

Comprobaciones generales:

```text
npm run lint -- --max-warnings 0
npm test
npm run build
npm --prefix functions run build
```

La integración continua instala ambos proyectos, ejecuta tests de aplicación, reglas y funciones en emuladores, y la suite Playwright de los flujos nuevos. Para ejecutar Playwright manualmente con los emuladores abiertos: `npm run test:e2e`. Para arrancarlos y pararlos automáticamente: `npm run test:e2e:ci` (prepara antes Functions).

Validación acumulada: 165 pruebas de aplicación y 60 comprobaciones del backend ejecutadas; las 35 pruebas de reglas pasaron en la entrega inicial. Revisión manual en escritorio/móvil, temas claro/oscuro, navegación, fichas, medallas, escudos, filtros y gráficas. Los specs Playwright están actualizados; la suite completa queda preparada para CI.

## Estado del despliegue y publicación

El 16 de octubre de 2026 se desplegó el backend `club` completo (42 funciones) y las reglas de Firestore en `futbolmanagement-dc6cb`. La entrega incorpora `setMatchArchived` y `cleanupMatchTombstone`, actualiza el borrado completo y protege los datos frente a escrituras de pestañas antiguas. La limpieza puede repetirse con seguridad y reintenta automáticamente si se interrumpe.

La web pública utiliza Vercel (`manchester-piti.vercel.app`); el push a `main` debe comprobarse también en su despliegue. GitHub Actions valida el código pero no publica Firebase. El HTML dinámico y el bundle público no se almacenan en caché para evitar que reaparezcan partidos archivados o eliminados. La comprobación SSR `node --test scripts/test-ssr-lifecycle.mjs`, después del build, verifica archivo, borrado y reactivación sin conectarse a Firebase.

Los dos párrafos siguientes son el registro del 24 de septiembre de 2026. Desde octubre el acceso al vestuario va por invitaciones: la clave del equipo y sus funciones ya no existen, y el secreto `TEAM_PASSWORD` no hace falta.

El 24 de septiembre de 2026 se desplegaron las siete Cloud Functions y las reglas de Firestore en `futbolmanagement-dc6cb`, después de activar Blaze. `TEAM_PASSWORD` está configurado en Secret Manager y `PUBLIC_SITE_URL` en el entorno local ignorado de Functions. Las peticiones previas desde `http://localhost:3001` devuelven 204 con CORS correcto; las peticiones sin sesión devuelven `UNAUTHENTICATED`, como corresponde. Se añadió `127.0.0.1` a los dominios autorizados de Google, conservando `localhost` y todos los dominios existentes. El repositorio de imágenes de compilación tiene una limpieza a siete días.

La interfaz rediseñada se sirve en local; Firebase Hosting todavía no se ha actualizado. El acceso real con Google y la clave se verificó en `127.0.0.1:3001`: el vestuario se abrió con el perfil real y sus opciones de administración. También se han probado la lógica de acceso, clave y permisos con los emuladores.

1. Usar la cuenta autorizada del proyecto Firebase y confirmar los requisitos de Cloud Functions del proyecto.
2. Comprobar que al menos un capitán puede entrar al vestuario: es quien crea las invitaciones y aprueba las solicitudes de acceso.
3. Si se utiliza un dominio propio, establecer `PUBLIC_SITE_URL` en la configuración de Functions. El valor por defecto es el dominio Firebase del proyecto. Sirve para las tarjetas sociales y sus enlaces.
4. Comprobar Google como proveedor de Auth y los dominios autorizados.
5. Ejecutar los builds con la configuración real, sin `VITE_USE_FIREBASE_EMULATOR`.
6. Desplegar primero el backend y las reglas:
   `firebase deploy --only functions:club,firestore:rules --project futbolmanagement-dc6cb`.
   Después subir el frontend a `main` y verificar el despliegue de Vercel. Firebase Hosting solo se publica si se quiere actualizar también ese alojamiento alternativo.
7. Verificar con un administrador real: Google, una invitación, nuevo partido, edición, votación y enlace social.

Las nuevas reglas exigen que las actas y votos pasen por Functions. No debe desplegarse solo el frontend esperando que esas funciones existan ya.

La carpeta `functions/assets` contiene el escudo necesario para generar imágenes sociales. Se utiliza Sharp en el servidor. La versión de `uuid` transitiva de `gaxios` está fijada mediante override a una versión corregida; la auditoría del backend quedó sin vulnerabilidades conocidas.

Referencias: [Secretos y configuración de Functions](https://firebase.google.com/docs/functions/config-env), [emuladores de Functions](https://firebase.google.com/docs/emulator-suite/connect_functions).

## Plantilla y estadísticas (revisión de septiembre)

- La portada: el próximo partido (o el que se está jugando) con su cuenta atrás y el jugador del momento; luego el último resultado, cómo va la temporada y el calendario que viene; «Ponte la del Piti» (tu nombre y dorsal en la camiseta, para guardarla como imagen), el acceso a la plantilla, la banda del vestuario y los patrocinadores. Los textos cambian solos según el momento de la temporada y todo se actualiza desde Firestore.
- Fichas con nombre, apellidos, alias, camiseta, edad, altura, peso, minigráfica y estadísticas. El podio usa clasificación por competición: `1, 2, 2, 4` y `1, 1, 3`; los valores cero no reciben medallas. Buscar o esconder jugadores históricos no altera sus puestos.
- Los minutos, titularidades, suplencias y cambios solo se muestran si existe un acta con seguimiento. Un `—` significa dato no registrado; no se infieren minutos del historial anterior.
- Rivales sin escudo o con imagen fallida reciben una insignia circular automática. Ejemplos: Superbebientes → SB, FUSION 7 → F7. El acta permite configurar una URL HTTPS y corregir hasta tres iniciales.
- Estadísticas: Resumen (balance y resultados), Jugadores (tabla ordenable y CSV), Minutos (convocatorias y reparto), Rivales y Comparar. Explorar contiene exclusivamente Récords individuales, Rachas e hitos, Récords del equipo y Evolución y rankings.
- Las secciones se conservan en la URL mediante `view` y `section`, además de la temporada. El comparador se enlaza con `view=compare` (y `a`/`b` para la pareja); los enlaces antiguos con `tab=compare` siguen abriendo Comparar (se leen como `view=compare`).
- Los récords muestran todos sus titulares empatados y una clasificación desplegable. Las rachas cuentan partidos consecutivos del equipo dentro del período elegido; una ausencia rompe la racha. Los hitos registran la fecha en que se alcanza o cruza un umbral, desde el inicio del período.
- Las gráficas de evolución permiten elegir métrica, hasta seis jugadores y partido consultado con el ratón o teclado. El ranking visual y los datos tabulares utilizan el mismo cálculo.
