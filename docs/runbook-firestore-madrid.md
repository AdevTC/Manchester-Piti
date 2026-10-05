# Runbook · Mover Firestore a Madrid (`europe-southwest1`)

Hoy la base de datos `(default)` está en **nam5** (EE. UU.) y las funciones en `us-central1`. El
objetivo es tener datos y funciones en **Madrid**, a unos milisegundos del equipo.

**Por qué así:**
- La ubicación de una base de datos no se puede cambiar.
- Firestore da **una sola base gratuita por proyecto**: la primera que se crea. Si se borra, la siguiente que se cree pasa a ser la gratuita.
- Por eso se **borra la `(default)` actual y se crea otra `(default)` en Madrid**, con los datos importados de una copia. El código del cliente no cambia de base de datos: solo cambia la región de las funciones.

**Ensayado en el emulador** con `functions/scripts/firestore-census.mjs`:
1. Recuento: 18 colecciones y 84 documentos.
2. Exportar, borrar e importar.
3. Nuevo recuento: «✓ Todo coincide».
4. Además pasan las reglas (53), la integración de funciones (142), los unitarios (216) y el e2e (11).

**Coste:** la exportación y la importación cuestan una lectura o escritura por documento (dentro de la cuota gratuita). La copia en Cloud Storage ocupa megas, y en un bucket de `us-central1` entra en el nivel gratuito. Madrid tiene precios de nivel 1 en funciones.

**Ventana:** unos 15–20 minutos en los que el vestuario no funciona; la web pública tampoco carga datos. Elegid un momento sin partido.

> Los comandos son iguales en PowerShell y en Git Bash. Si el CLI se queja de la cuota de
> `formora-491717`, lánzalo sin las variables de proyecto/cuota de Google Cloud, como en despliegues anteriores.

---

## 0 · Preparación (sin corte, se puede hacer antes)

```bash
gcloud config set project futbolmanagement-dc6cb
gcloud storage buckets create gs://futbolmanagement-dc6cb-backups --location=us-central1
gcloud auth application-default login
git fetch && git checkout perf/firestore-madrid && npm --prefix functions ci
```

Recuento «antes» (solo lectura; guarda nombres de colecciones, recuentos y huellas, no datos):

```bash
node functions/scripts/firestore-census.mjs --project futbolmanagement-dc6cb --out functions/census-antes.json
```

## 1 · Copia de seguridad (empieza la ventana)

```bash
gcloud firestore export gs://futbolmanagement-dc6cb-backups/madrid --database="(default)"
```

Espera a que termine (`Waiting for [...] to finish...done`). **No sigas si falla.**

## 2 · Borrar la base de EE. UU.

```bash
gcloud firestore databases describe --database="(default)"
```

Si pone `deleteProtectionState: DELETE_PROTECTION_ENABLED`:

```bash
gcloud firestore databases update --database="(default)" --no-delete-protection
```

```bash
gcloud firestore databases delete --database="(default)"
```

## 3 · Crear la nueva en Madrid (espera unos 5 minutos tras borrar)

```bash
gcloud firestore databases create --database="(default)" --location=europe-southwest1 --type=firestore-native --delete-protection
```

Si responde que el ID aún no se puede reutilizar, espera un par de minutos y repite.

## 4 · Reglas e índices (antes de importar)

```bash
npx --yes firebase-tools@15.30.2 deploy --only firestore --project futbolmanagement-dc6cb
```

## 5 · Importar la copia

```bash
gcloud firestore import gs://futbolmanagement-dc6cb-backups/madrid/ --database="(default)"
```

## 6 · Comprobar que todo coincide

```bash
node functions/scripts/firestore-census.mjs --project futbolmanagement-dc6cb --out functions/census-despues.json --compare functions/census-antes.json
```

Debe terminar con **«✓ Todo coincide»**. Si no, no sigas: repite el paso 5 o avisa.

## 7 · Funciones en Madrid

```bash
npx --yes firebase-tools@15.30.2 deploy --only functions --project futbolmanagement-dc6cb
```

- Pregunta si borra las funciones de `us-central1` y `europe-west1`: **sí**.
- Si `tallyMvp` falla al crearse (es la primera vez que hay un trigger en esta región), espera unos minutos y repite solo esa:

```bash
npx --yes firebase-tools@15.30.2 deploy --only functions:club:tallyMvp --project futbolmanagement-dc6cb
```

## 8 · Publicar la web

Avisa a Claude: mergea la PR (`perf/firestore-madrid`) y Vercel publica el cliente, que llama a las
funciones de Madrid. Fin de la ventana. Después se verifica en producción: carga, votaciones en tiempo
real entre dos móviles, MVP, porra, tablón y calendario.

## Vuelta atrás

- **Si algo falla antes del paso 2:** no se ha tocado nada; basta con no seguir.
- **Si falla después:** la copia del paso 1 sigue en el bucket. Se puede volver a importar en la base nueva (paso 5) cuantas veces haga falta.
- **Para volver a EE. UU.:** crear la `(default)` en `nam5` e importar la misma copia.

Guarda la copia del bucket unas semanas; luego se puede borrar:

```bash
gcloud storage rm -r gs://futbolmanagement-dc6cb-backups/madrid
```
