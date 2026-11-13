// Presentation copy for DogSpot's academic app. Business and security logic stay in the app bundle.
const copy = new Map([
  ['Ej.: Luna', 'Nombre de tu mascota'],
  ['Prototipo académico interactivo · Hecho para tu tranquilidad', 'App académica · Hecho para tu tranquilidad'],
  ['Prototipo académico: los pagos son simulados; no se realizan transacciones reales ni se solicitan credenciales bancarias.', 'App académica: el registro de pago no realiza un cobro bancario ni solicita credenciales bancarias.'],
  ['Prototipo académico DogSpot. Los pagos y los servicios son simulados; este mensaje no acredita un cobro ni un servicio real.', 'DogSpot · App académica. El registro del servicio no acredita un cobro bancario.'],
  ['Información ilustrativa. No se han adjuntado certificados ni comprobado la experiencia de este perfil ficticio.', 'Perfil académico. Certificados y experiencia pendientes de verificación.'],
  ['Identidad y antecedentes: pendientes de verificación. En este prototipo no se acredita a personas reales.', 'Identidad y antecedentes pendientes de verificación.'],
  ['Datos de ejemplo para la presentación académica.', 'Información para la presentación académica.'],
  ['Formación de ejemplo · Certificado no adjunto', 'Formación · Certificado pendiente de adjuntar'],
  ['Disponibilidad de ejemplo', 'Disponibilidad académica'],
  ['El promedio se calcula con los comentarios mostrados. Las reseñas de ejemplo se identifican por separado.', 'El promedio se calcula con los comentarios mostrados. Las reseñas académicas se identifican por separado.'],
  ['Reseña de ejemplo', 'Reseña académica'],
  ['Servicio finalizado en este prototipo', 'Servicio finalizado en DogSpot'],
  ['Simulación de llamada · ', 'Contacto de la app académica · '],
  [' Pago registrado correctamente — Simulación', ' Registro académico de pago completado'],
  ['Simular fin del servicio', 'Finalizar servicio'],
  ['Horario de Perú. La disponibilidad corresponde a los horarios y reservas de este prototipo local. Sin descuentos automáticos ni transporte adicional dentro de la cobertura.', 'Horario de Trujillo, Perú. La disponibilidad se calcula con las reservas guardadas en este dispositivo. El traslado está incluido dentro de la cobertura.'],
  ['Servicio de ejemplo · 2:00 p. m. – 6:00 p. m.', 'Servicio académico · 2:00 p. m. – 6:00 p. m.'],
  ['Reactivar servicio de ejemplo', 'Reiniciar cuidado académico'],
  [' · Servicio de ejemplo', ' · Servicio académico'],
  ['Ejemplo', 'Académico'],
  ['Abrir servicio de ejemplo →', 'Abrir cuidado académico →'],
  ['La cuenta de ejemplo no recibe correos. Agrega tu correo al perfil o crea un registro para recibir tus nuevas confirmaciones.', 'Agrega tu correo al perfil o crea una cuenta para recibir las confirmaciones de tus servicios.'],
  ['Número de prueba: ', 'Número académico: '],
  ['Te enviaremos un enlace a tu correo (simulado).', 'La recuperación de acceso se gestiona desde este dispositivo.'],
  ['Datos de ejemplo', 'Datos académicos'],
  ['Pago simulado con ', 'Registro de pago con '],
  ['000 000 000 (ficticio)', 'Número de pago no configurado'],
  ['Datos de prueba. No realizar pagos reales.', 'Registro académico. No transfieras dinero a estos datos.'],
  [' (simulada)', ' · registro académico'],
  ['Cuenta DogSpot: ••• 0000 (simulada)', 'Cuenta bancaria no configurada'],
  ['CCI: 000 ••• •••• •••• (simulado)', 'CCI pendiente de configurar'],
  ['Desde Inicio toca “Contratar servicio”. Elige la mascota, el modo (por horas, de 2 a 8 h, o varias jornadas con un horario de 2 a 8 horas por fecha), la fecha, la hora y las indicaciones. Luego eliges al cuidador y pagas con Yape, Plin o transferencia (simulado).', 'Desde Inicio toca “Contratar servicio”. Elige la mascota, la modalidad, las fechas, las horas y las indicaciones. Luego selecciona al cuidador y registra el método de pago. La app académica no realiza cobros bancarios.'],
  ['Ingresa el código de verificación de prueba para confirmar tu nuevo correo.', 'Ingresa el código de verificación mostrado para confirmar tu nuevo correo en este dispositivo.'],
  ['Verificación simulada: en una versión real enviaríamos un código a tu correo. Tu código de prueba es ', 'Verificación local del perfil. Este código se muestra aquí y no se envía por correo: '],
  ['Escribe el código de prueba', 'Escribe el código mostrado'],
].map(([old, next]) => [old.trim(), next.trim()]));

export function academicText(text) {
  const replacement = copy.get(text.trim());
  if (replacement === undefined) return text;
  // Keep surrounding spaces used between adjacent React text nodes.
  return text.slice(0, text.length - text.trimStart().length) + replacement + text.slice(text.trimEnd().length);
}

export function academicCopy(root) {
  const doc = root.ownerDocument;
  function update(element) {
    if (element.matches('script,style,textarea,[contenteditable="true"]')) return;
    for (const attr of ['placeholder', 'aria-label', 'title', 'alt']) {
      const old = element.getAttribute(attr);
      if (old !== null) {
        const next = academicText(old);
        if (next !== old) element.setAttribute(attr, next);
      }
    }
  }
  function scan(node) {
    if (node.nodeType === 3) {
      if (node.parentElement?.closest('script,style,textarea,[contenteditable="true"]')) return;
      const next = academicText(node.data);
      if (next !== node.data) node.data = next;
    } else if (node.nodeType === 1) {
      update(node);
      if (node.matches('script,style,textarea,[contenteditable="true"]')) return;
      for (const child of node.childNodes) scan(child);
    }
  }
  scan(root);
  const observer = new doc.defaultView.MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) scan(node);
      else scan(record.target);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder','aria-label','title','alt'] });
  return () => observer.disconnect();
}

if (typeof document !== 'undefined') {
  const start = () => { const root = document.getElementById('root'); if (root) academicCopy(root); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
}
