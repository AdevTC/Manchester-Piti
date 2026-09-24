# Manchester Piti · Guía de la nueva web

## Qué está implementado

- Portada pública, navegación nueva para ordenador y móvil, temas claro y oscuro.
- Calendario con búsqueda y filtro de temporada; fichas públicas de partidos y jugadores.
- Estadísticas legibles, comparador, minutos, récords, sociedades y balance ante rivales. El explorador anterior sigue accesible desde «Explorar más».
- El club: historia, hitos, campo, contacto, patrocinadores y galería, editables desde «Contenido y fotos».
- Espacios gráficos identificados para las fotos pendientes. No se presentan fotografías ajenas como fotos del equipo.
- Vestuario privado: Google → clave del equipo → nombre de miembro, si es la primera visita.
- Disponibilidad para el próximo partido y aviso privado de quedada/material.
- MVP con una papeleta por cuenta, posibilidad de cambiar el voto y detalle de votantes visible para administradores.
- Editor de actas de fútbol 7 en cuatro pasos, borradores privados, validación, revisiones y acumulados en el servidor.
- Calendario descargable, carteles PNG cuadrado/vertical y enlaces para compartir con imagen social dinámica.

## Preparar una temporada

1. Entra al vestuario con tu Google y la clave compartida.
2. Un administrador abre **Administrar el club → Temporadas** y crea la temporada.
3. En **Jugadores**, asigna a esa temporada todos los integrantes. Ajusta sus dorsales y nombres de camiseta por temporada.
4. En **Nuevo partido**, elige temporada, rival, competición, fecha/hora de Madrid, campo y condición local/visitante.
5. Déjalo **Programado**, revisa los datos y pulsa **Publicar encuentro**. La convocatoria puede completarse más adelante.
6. Repite con el calendario que ya conozcáis. Si cambian fecha o campo, edita el encuentro existente.

El horario se interpreta siempre en **Europe/Madrid**, incluido el cambio entre verano e invierno. No depende de la zona horaria del dispositivo.

## Qué ocurre automáticamente

- Antes del inicio: cuenta atrás hacia el encuentro más próximo.
- Desde el saque inicial hasta una hora después: **JUGANDO**.
- Al cumplirse la hora: ese encuentro queda pendiente de acta y el contador pasa al siguiente programado.
- Si no hay más partidos: se muestra un estado de calendario pendiente.
- Un partido aplazado o cancelado no ocupa el contador.
- El marcador y las estadísticas deportivas solo se publican al finalizar el acta. Nunca se interpreta un futuro encuentro como empate a cero.

«JUGANDO» describe la franja prevista de juego; no es un marcador en directo. No necesita un cron ni abrir el panel de administración. La duración del acta es configurable (60 minutos por defecto); la franja pública pedida sigue siendo de una hora.

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

La clave se verifica exclusivamente en una Cloud Function contra Secret Manager; no se incluye en HTML, JavaScript, reglas o Git. Hay cinco intentos por cuenta cada quince minutos. El acceso dura doce horas y se vuelve a validar con reglas de Firestore y backend. Se recuerda en la pestaña al recargar sin guardar la contraseña. Cerrar sesión en el vestuario revoca ese acceso.

Los perfiles y nombres únicos se registran mediante transacción. Los roles administrativos existentes se conservan. La cuenta propietaria verificada conserva el mecanismo de superadministrador del proyecto.

Los datos deportivos públicos se separan de los votos individuales, los avisos de equipo, la disponibilidad, los borradores y los perfiles privados.

## Fotos y contenido

**Contenido y fotos** permite cambiar textos, imagen principal, galería, hitos, patrocinadores, contactos, biografías y fotos de jugadores. Las fotos se incorporan mediante URL HTTPS; no se ha añadido un servicio de subida de archivos.

Mientras no haya fotos propias se ven espacios gráficos preparados para ellas. Campo, historia, año de fundación y contactos permanecen pendientes si no se han facilitado: no se inventan datos del club.

## Historial anterior

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

El servidor 3001 utiliza la configuración habitual de Firebase. Hasta desplegar las nuevas funciones y reglas, las funciones nuevas del vestuario no estarán disponibles contra ese proyecto real.

### Pruebas aisladas

Crea `functions/.secret.local` con una línea `TEAM_PASSWORD=una-clave-solo-para-pruebas`. Ese archivo está ignorado por Git y por el despliegue de Functions. Para probar la clave solicitada se ha configurado localmente el valor indicado por el equipo.

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

El proyecto de pruebas es `demo-manchester-piti`. Los scripts usan exclusivamente endpoints de loopback y no escriben en producción. La semilla crea una temporada y diez jugadores ficticios, un encuentro futuro y un acta 2–1. El botón **Google de prueba · Solo emulador** únicamente aparece en desarrollo con emuladores; la comprobación de la clave sigue pasando por el backend.

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

La integración continua instala ambos proyectos, ejecuta tests de aplicación, reglas y funciones en emuladores, y la suite Playwright de los flujos nuevos. Para ejecutar Playwright manualmente con los emuladores abiertos: `npm run test:e2e`. Para arrancarlos y pararlos automáticamente: `npm run test:e2e:ci` (prepara antes Functions y el secreto local).

Validación acumulada: 165 pruebas de aplicación y 60 comprobaciones del backend ejecutadas; las 35 pruebas de reglas pasaron en la entrega inicial. Revisión manual en escritorio/móvil, temas claro/oscuro, navegación, fichas, medallas, escudos, filtros y gráficas. Los specs Playwright están actualizados; la suite completa queda preparada para CI.

## Estado del despliegue y publicación

El 24 de septiembre de 2026 se desplegaron las siete Cloud Functions y las reglas de Firestore en `futbolmanagement-dc6cb`, después de activar Blaze. `TEAM_PASSWORD` está configurado en Secret Manager y `PUBLIC_SITE_URL` en el entorno local ignorado de Functions. Las peticiones previas desde `http://localhost:3001` devuelven 204 con CORS correcto; las peticiones sin sesión devuelven `UNAUTHENTICATED`, como corresponde. Se añadió `127.0.0.1` a los dominios autorizados de Google, conservando `localhost` y todos los dominios existentes. El repositorio de imágenes de compilación tiene una limpieza a siete días.

La interfaz rediseñada se sirve en local; Firebase Hosting todavía no se ha actualizado. El acceso real con Google y la clave se verificó en `127.0.0.1:3001`: el vestuario se abrió con el perfil real y sus opciones de administración. También se han probado la lógica de acceso, clave y permisos con los emuladores.

1. Usar la cuenta autorizada del proyecto Firebase y confirmar los requisitos de Cloud Functions del proyecto.
2. Configurar el secreto **TEAM_PASSWORD** en Secret Manager con la clave del equipo, mediante el prompt seguro de `firebase functions:secrets:set TEAM_PASSWORD --project futbolmanagement-dc6cb`. No ponerla en una variable `VITE_*`.
3. Si se utiliza un dominio propio, establecer `PUBLIC_SITE_URL` en la configuración de Functions. El valor por defecto es el dominio Firebase del proyecto. Sirve para las tarjetas sociales y sus enlaces.
4. Comprobar Google como proveedor de Auth y los dominios autorizados.
5. Ejecutar los builds con la configuración real, sin `VITE_USE_FIREBASE_EMULATOR`.
6. Desplegar Functions, las reglas de Firestore y Hosting como una misma entrega:
   `firebase deploy --only functions,firestore:rules,hosting --project futbolmanagement-dc6cb`.
7. Verificar con un administrador real: Google, clave, nuevo partido, edición, votación y enlace social.

Las nuevas reglas exigen que las actas y votos pasen por Functions. No debe desplegarse solo el frontend esperando que esas funciones existan ya.

La carpeta `functions/assets` contiene el escudo necesario para generar imágenes sociales. Se utiliza Sharp en el servidor. La versión de `uuid` transitiva de `gaxios` está fijada mediante override a una versión corregida; la auditoría del backend quedó sin vulnerabilidades conocidas.

Referencias: [Secretos y configuración de Functions](https://firebase.google.com/docs/functions/config-env), [emuladores de Functions](https://firebase.google.com/docs/emulator-suite/connect_functions).

## Plantilla y estadísticas (revisión de septiembre)

- Carrusel infinito en portada con todos los resultados finalizados y estadísticas de jugadores. Se actualiza desde Firestore, tiene pausa manual, pausa al interactuar y desplazamiento manual cuando el dispositivo pide movimiento reducido.
- Fichas con nombre, apellidos, alias, camiseta, edad, altura, peso, minigráfica y estadísticas. El podio usa clasificación por competición: `1, 2, 2, 4` y `1, 1, 3`; los valores cero no reciben medallas. Buscar o esconder jugadores históricos no altera sus puestos.
- Los minutos, titularidades, suplencias y cambios solo se muestran si existe un acta con seguimiento. Un `—` significa dato no registrado; no se infieren minutos del historial anterior.
- Rivales sin escudo o con imagen fallida reciben una insignia circular automática. Ejemplos: Superbebientes → SB, FUSION 7 → F7. El acta permite configurar una URL HTTPS y corregir hasta tres iniciales.
- Estadísticas: Resumen (balance y resultados), Jugadores (tabla ordenable y CSV), Minutos (convocatorias y reparto), Rivales y Comparar. Explorar contiene exclusivamente Récords individuales, Rachas e hitos, Récords del equipo y Evolución y rankings.
- Las secciones se conservan en la URL mediante `view` y `section`, además de la temporada. El comparador antiguo `tab=compare` sigue funcionando.
- Los récords muestran todos sus titulares empatados y una clasificación desplegable. Las rachas cuentan partidos consecutivos del equipo dentro del período elegido; una ausencia rompe la racha. Los hitos registran la fecha en que se alcanza o cruza un umbral, desde el inicio del período.
- Las gráficas de evolución permiten elegir métrica, hasta seis jugadores y partido consultado con el ratón o teclado. El ranking visual y los datos tabulares utilizan el mismo cálculo.
