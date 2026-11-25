# Factura C para ARCA — v1.5.0

Extensión local de Chrome. Reutiliza tu sesión sin pedir ni almacenar Clave Fiscal, cookies o tokens. Prepara Factura C, consumidor final, Productos y Servicios, Contado, una línea Servicios, cantidad 1. Todas las fechas usan el día actual de Argentina al iniciar. Importe en formato **999.999,99**.

## Instalación y uso

1. Extrae el ZIP. En `chrome://extensions`, activa Modo de desarrollador y carga la carpeta `extension`. Para actualizar, reemplaza los archivos y recarga la extensión. Acepta el nuevo acceso a los sitios de facturación que solicite Chrome; si queda deshabilitada por el cambio de permisos, vuelve a habilitarla. Comprueba **Versión 1.5.0** en el panel. Chrome puede solicitar habilitar nuevamente la extensión por el nuevo permiso de notificaciones.
2. Abre tu sesión de ARCA, entra en Comprobantes en Línea y selecciona el contribuyente. Deja abierto el menú principal.
3. Indica el importe. La extensión entra en GENERAR COMPROBANTES, elige el único punto de venta disponible y FACTURA C. Si hay varios puntos de venta, debes elegir uno y avanzar a los datos del comprobante antes de iniciar.
4. Elige el modo:
   - **Opción desmarcada:** Preparar hasta revisión final. Avanza automáticamente y se detiene antes de emitir; confirmas personalmente en ARCA.
   - **NO AGUARDAR CONFIRMACIÓN marcada:** Preparar y emitir comprobante. Autoriza la emisión automática de ese comprobante. No solicita confirmación final. Acepta el mensaje específico de confirmación de ARCA, incluso si aparece después del clic.
5. En el modo automático, después de verificar la emisión, muestra una notificación de Chrome con «Se ha generado el comprobante por $ xx.xxx,xx», pulsa MENÚ PRINCIPAL y pone el importe en vacío (ayuda **0,00**). La opción de emisión automática se conserva hasta que la desmarques. Para el siguiente comprobante, indica un nuevo importe e inicia otra ejecución.

Puedes cerrar el panel durante el proceso. El botón Detener cancela los próximos pasos; no revierte una solicitud de emisión ya enviada.

## Verificación de emisión y manejo de errores

El éxito requiere texto afirmativo de comprobante generado/autorizado u operación exitosa, sin mensajes de error. Se acepta acompañado por un CAE visible o por el menú de la pantalla final sin controles de confirmación. No exige que el CAE esté fuera del PDF. Pulsar Confirmar no se considera éxito. Ante respuesta incierta, se conserva el importe y no se repite la emisión: revisa ARCA antes de intentar nuevamente. Un cambio del portal puede requerir adaptar esta detección.

La solicitud de emisión se registra antes del clic para evitar reenvíos al navegar o reactivarse el trabajador de Chrome. El modo automático sólo acepta un único botón final reconocido. Reconoce el mensaje exacto «Usted está por generar un nuevo comprobante. ¿Confirma la Operación?» como diálogo nativo o dentro de un diálogo HTML reconocido. El manejador nativo dura como máximo dos minutos y se restaura al responder, cancelar o vencer ese plazo; las demás preguntas se delegan al navegador.

La notificación no requiere cerrarla para regresar al menú. Si el sistema operativo bloquea notificaciones, el aviso permanece en el panel de la extensión. Si no se encuentra MENÚ PRINCIPAL o no se verifica el regreso, se informa que el comprobante fue generado y que falta regresar al menú. No se inicia automáticamente otro comprobante.

## Privacidad y permisos

Permisos: scripting, storage y notifications; acceso a los hosts `https://fe.afip.gob.ar/*` y `https://fe.arca.gob.ar/*`. No usa activeTab, permiso global tabs ni acceso al correo. Chrome concede los permisos por host; el código restringe las operaciones a la ruta `/rcel/`. Importe, fechas, modo y ejecución se almacenan temporalmente en `chrome.storage.session`; no hay sincronización, servidor ni telemetría. Se ejecuta únicamente en HTTPS, subdominios AFIP/ARCA y ruta `/rcel/`. La ejecución de confirmación usa el contexto de la página exclusivamente para aceptar el diálogo síncrono del clic autorizado.

## Pruebas y límites

`npm test` con Node 20+. Pruebas de importes, fechas, formularios simulados, navegación, carga tardía, emisión opcional, confirmación de éxito, notificación, regreso al menú e importe vacío.

El usuario confirmó que la preparación funciona en su sesión. **El nuevo modo de emisión automática aún no se ha probado contra ARCA real**; las pruebas de emisión usan una simulación. Los controles o pantallas no reconocidos detienen la ejecución y los datos fiscales adicionales nunca se inventan.

### Preferencia y panel 1.5.0

La elección «No aguardar confirmación» se guarda inmediatamente en `chrome.storage.local` y se restaura al abrir el panel, incluso tras reiniciar Chrome. Sólo se persiste ese booleano; importe, fechas y ejecución siguen en almacenamiento de sesión. Una ejecución usa el modo elegido al iniciarla; el panel muestra ese modo y bloquea cambios hasta terminar o detener. Vaciar el importe no cambia la preferencia. La ayuda está plegada y los controles principales se agrupan en un panel compacto.

### Reparación 1.5.0

Conserva el seguimiento tras agotar la espera de emisión: una navegación posterior vuelve a comprobar el resultado, sin reenviar la emisión. El importe queda vacío al terminar o detener; 0,00 aparece sólo como placeholder. Verificado con pruebas de confirmación diferida y confirmación manual posterior al timeout; pendiente de validar el diálogo real del portal.

### Regreso al menú 1.5.0

Mantiene la ejecución activa durante el regreso y espera que aparezca un control de menú habilitado. Reconoce Menú Principal, Volver al Menú Principal, Volver a Menú Principal e Ir al Menú Principal, incluyendo controles con etiqueta accesible. No repite el clic si la navegación destruye su contexto. Comprueba el destino antes de indicar que está listo. Si la emisión no se reconoce, aún necesita verificar el CAE y el resultado; esta mejora no omite esa comprobación.

### Detección de resultado 1.5.0

Reconoce un mensaje de generación completada y el menú de la pantalla final aunque el CAE no sea visible en HTML. No acepta el botón de menú por sí solo, textos de error ni confirmaciones pendientes. Esta variante fue verificada con pantallas simuladas.


## Uso desde el correo o cualquier pestaña — 1.5.0

1. Deja abierta una pestaña RCEL en **MENÚ PRINCIPAL**, con la sesión vigente y el contribuyente ya seleccionado.
2. Desde la pestaña del correo (u otra), abre la extensión. Busca RCEL entre todas las ventanas del mismo perfil.
3. Si hay una única pestaña, la selecciona automáticamente. Si hay varias, elige explícitamente el destino en la lista (título, ventana y posición). **Actualizar** vuelve a buscar; nunca se elige automáticamente entre varios contribuyentes.
4. Indica el importe y pulsa Preparar. El proceso se ejecuta sobre el destino seleccionado sin activar la pestaña ni cambiar el foco. Puedes cerrar el panel y continuar leyendo el correo.
5. **Ir a RCEL** es la única acción que activa la pestaña y su ventana; úsala para revisar, confirmar manualmente o reactivar una pestaña que Chrome suspendió.

Si no hay RCEL, la sesión venció, el destino está cargando/suspendido o no está en el menú principal, la extensión informa el problema y no escribe sobre un comprobante pendiente. Cada ejecución queda ligada al ID de la pestaña elegida y nunca migra a otra. Dos solicitudes simultáneas no pueden iniciar dos procesos. El modo automático conserva la notificación, regreso al menú e importe vacío de la versión validada.

Las esperas admiten hasta 30 segundos para campos dependientes y aproximadamente 60 segundos para navegación/resultado, para tolerar la ralentización de pestañas inactivas. Chrome debe seguir abierto y el equipo despierto; una pestaña suspendida debe reactivarse antes de iniciar. No requiere mantener el panel abierto.

La ampliación se validó con pruebas automatizadas de selección, permisos, pantallas pendientes, pestañas suspendidas y flujo de facturación simulado. **Pendiente de validar la ejecución en segundo plano contra Chrome y ARCA reales**. La versión 1.4.4 fue validada por el usuario antes de esta ampliación.
