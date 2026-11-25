# Preparador de Factura C para ARCA

Extensión local para Chrome (Manifest V3, sin dependencias). Usa la sesión abierta en el perfil donde se instala. No pide ni lee Clave Fiscal, cookies o tokens; no inicia sesión ni realiza solicitudes de red propias. Solo se ejecuta al pulsar su botón y solo en HTTPS, subdominios oficiales AFIP/ARCA y ruta `/rcel/`.

## Instalación y uso

1. En **tu Chrome y tu perfil autorizado**, abre `chrome://extensions`, activa Modo de desarrollador y selecciona **Cargar descomprimida**. Elige la carpeta `extension` de este proyecto (descarga y extrae el proyecto primero si está en otra computadora).
2. Inicia sesión personalmente en ARCA y entra a **Comprobantes en Línea**. Selecciona contribuyente, punto de venta y generación de comprobantes. La extensión no elige estas identidades.
3. Abre la extensión e indica únicamente el importe en pesos, sin separadores de miles. Todas las fechas se calculan como el día actual en Argentina al pulsar el botón: emisión, inicio/fin de servicios y vencimiento.
4. Pulsa **Completar pantalla actual** en cada paso. Revisa lo completado y avanza tú con los botones de ARCA. Si al elegir un concepto aparecen nuevos campos, vuelve a pulsar el botón. El importe se conserva temporalmente durante la sesión de Chrome; puedes borrarlo con el botón de la extensión.
5. Comprueba **Factura C**, **consumidor final**, **Productos y Servicios**, todas las fechas, moneda **pesos**, cantidad **1**, detalle **Servicios**, precio igual al importe, bonificación **0** y total correcto. Selecciona manualmente la condición de venta y los datos de receptor que ARCA exija según importe/normativa. No se inventan documentos, domicilios ni condiciones de cobro.
6. En el resumen final, detente y revisa. Solo tú puedes pulsar la confirmación de emisión en ARCA. La extensión no pulsa ningún botón, no envía formularios y no obtiene CAE.

## Alcance y límites

Esta es una implementación inicial conservadora, **sin validación contra una sesión real de ARCA**. Los alias de campos están aislados en `extension/screen.js`; cambios en el portal pueden requerir ajustes. Solo completa controles con identificadores o etiquetas exactos y opciones inequívocas. Ante campos ambiguos o múltiples líneas detectadas se detiene antes de escribir. No garantiza detectar todos los diseños posibles de tablas; usa siempre un comprobante nuevo y comprueba que exista una sola línea. No reemplaza datos de un comprobante ya emitido.

El portal puede recalcular o alterar campos mediante sus propios eventos; verifica los valores y el total en cada pantalla. La extensión no interpreta que la ausencia de campos sea una emisión exitosa. No automatiza navegación, selección de contribuyente ni inicio de sesión. Tampoco impone un bloqueo a los botones de ARCA: el usuario conserva su control.

Los datos temporales se guardan en `chrome.storage.session`, no en disco mediante almacenamiento persistente ni en sincronización. No hay telemetría ni servidor. No compartas capturas con datos fiscales o credenciales para depurar: bastan identificadores de controles y etiquetas anonimizados.

## Verificación

Ejecuta `npm test` con Node 20 o superior. Incluye importes, fechas, límites de dominio y una comprobación estática de ausencia de APIs de click/envío/red en el ejecutor. No equivale a una prueba integral del portal. Para verificar en vivo, prepara un comprobante nuevo, prueba cada pantalla y termina en la revisión sin emitir.
