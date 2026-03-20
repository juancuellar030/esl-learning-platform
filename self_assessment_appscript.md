# Configuración de Google Apps Script para Autoevaluación

Para que las notas de todos los estudiantes se guarden automáticamente y en tiempo real en una sola tabla, necesitamos conectar la encuesta a un Google Sheet usando **Google Apps Script**.

Sigue estos pasos cuidadosamente:

## Paso 1: Crear el Google Sheet
1. Abre tu Google Drive y crea un nuevo Google Sheet (puedes llamarlo "Respuestas Autoevaluación").
2. En la primera fila (fila 1), escribe los siguientes encabezados (exactamente como están aquí, uno por columna de la A a la M):
   * A1: `Fecha/Hora`
   * B1: `Nombre`
   * C1: `Grupo`
   * D1: `Criterio 1`
   * E1: `Criterio 2`
   * F1: `Criterio 3`
   * G1: `Criterio 4`
   * H1: `Criterio 5`
   * I1: `Criterio 6`
   * J1: `Criterio 7`
   * K1: `Criterio 8`
   * L1: `Criterio 9`
   * M1: `Nota Generada`
   * N1: `Decisión`
   * O1: `Nota Ajustada`
   
*(Puedes ponerles color de fondo y texto en negrita para que se vea mejor).*

## Paso 2: Crear el Apps Script
1. En ese mismo Google Sheet, haz clic en **Extensiones** > **Apps Script** en el menú superior.
2. Borra todo el código que aparece ahí y pega el siguiente código:

```javascript
/**
 * Script para recibir respuestas de la Autoevaluación Estudiantil
 */

const SHEET_NAME = "Hoja 1"; // <-- ¡IMPORTANTE! Cambia esto si tu hoja de abajo tiene otro nombre (ej. "Respuestas")

function doPost(e) {
  // Lock para evitar que dos estudiantes que envíen al mismo tiempo sobreescriban datos
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); // Espera hasta 10 segundos

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": "No se encontró la hoja" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Leemos los datos enviados desde la página web (vienen en formato JSON de texto)
    const data = JSON.parse(e.postData.contents);
    
    // Convertimos la decisión a español
    const decision = data.decision === 'agree' ? 'De acuerdo' : 'En desacuerdo';
    const adjusted = data.adjustedScore !== null ? data.adjustedScore : '';

    // Preparamos la fila (debe coincidir con las 15 columnas que creamos)
    const row = [
      data.timestamp || new Date().toISOString(),
      data.name,
      data.group,
      data.answers.c1 || '',
      data.answers.c2 || '',
      data.answers.c3 || '',
      data.answers.c4 || '',
      data.answers.c5 || '',
      data.answers.c6 || '',
      data.answers.c7 || '',
      data.answers.c8 || '',
      data.answers.c9 || '',
      data.generatedScore,
      decision,
      adjusted
    ];

    // Agregamos la fila a la siguiente línea vacía
    sheet.appendRow(row);

    // Retornamos éxito a la web
    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Para la validación previa de CORS (preflight request de los navegadores)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. Haz clic en el ícono de **Guardar** (el disquete 💾).

## Paso 3: Desplegar como Aplicación Web (Web App)
1. Haz clic en el botón azul **"Implementar"** (o Deploy) arriba a la derecha.
2. Selecciona **"Nueva implementación"** (New deployment).
3. En el ícono del engranaje ⚙️ (Seleccionar tipo), elige **"Aplicación web"** (Web app).
4. Llena los campos así:
   - **Descripción**: `API Autoevaluación`
   - **Ejecutar como**: `Yo` (tu cuenta de Google)
   - **Quién tiene acceso**: `Cualquier persona` (Anyone) <-- *¡MUY IMPORTANTE! Si no pones esto, los estudiantes no podrán enviar sus notas.*
5. Haz clic en **"Implementar"** (Deploy).
   - *(La primera vez, Google te pedirá "Autorizar acceso". Haz clic ahí, elige tu cuenta de Google, ve a "Avanzada" o "Advanced" abajo, y luego a "Ir a API Autoevaluación" y "Permitir").*
6. Copia la **"URL de la aplicación web"** completa (que empieza con `https://script.google.com/...`).

---

**Cuando tengas esa URL, dásela a Antigravity en la conversación para que la conecte a tu código y terminemos la automatización.**
