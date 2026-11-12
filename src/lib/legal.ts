// Textos legales del sitio (aviso de privacidad, términos y condiciones, política de devoluciones
// y política de cookies). La maqueta solo trae los enlaces, sin textos: estos se redactaron a
// partir de lo que hace la app (datos que guarda, servicios que usa, reglas de acceso y reembolso).
// Son un borrador sin revisión legal; lo que dependa de datos del negocio está en `LEGAL`.

export const LEGAL = {
  // Responsable de los datos: la chef, como persona física (dato del cliente, 2026-11-11).
  responsable: 'Gladis de Jesus Castillo Aparicio',
  // Domicilio del responsable (el aviso de privacidad debe tenerlo). Sin él, no se muestra la línea.
  domicilio:
    'Federico Cárdenas Barajas #234D, Colonia Primaveras, Villa de Álvarez, Colima, México' as
      string | null,
  // Correo para dudas y derechos ARCO (el mismo de soporte del checkout).
  email: 'soporte@capagla.com',
  actualizado: '11 de noviembre de 2026',
}

export type LegalSection = {
  heading: string
  // Párrafos y, después, una lista opcional.
  paragraphs?: string[]
  items?: string[]
}

export type LegalDoc = {
  slug: 'privacidad' | 'terminos' | 'devoluciones' | 'cookies'
  title: string
  intro: string
  sections: LegalSection[]
}

const { responsable, domicilio, email } = LEGAL

const privacy: LegalDoc = {
  slug: 'privacidad',
  title: 'Aviso de privacidad',
  intro:
    'En Capagla cuidamos tus datos. Aquí te explicamos cuáles guardamos, para qué los usamos, con quién los compartimos y cómo puedes ejercer tus derechos.',
  sections: [
    {
      heading: 'Quién es responsable de tus datos',
      paragraphs: [
        `${responsable} es responsable del tratamiento de tus datos personales${domicilio ? `, con domicilio en ${domicilio}` : ''}. Puedes escribirnos a ${email}.`,
      ],
    },
    {
      heading: 'Qué datos recabamos',
      paragraphs: ['Según lo que hagas en el sitio, guardamos:'],
      items: [
        'Datos de tu cuenta: nombre y correo electrónico. La contraseña es opcional; si la creas, se guarda cifrada y nadie del equipo puede verla.',
        'Datos de tu compra: qué compraste, el monto, la fecha y el estado del pago. No guardamos el número de tu tarjeta: el pago lo procesa Stripe.',
        'Si te registras en la clase gratis: tu correo y la fecha en que aceptaste este aviso.',
        'Tu actividad en los cursos: lecciones vistas, favoritas, momentos que marcas y las preguntas que haces a la chef, con sus respuestas.',
        'Lo que capturas en la herramienta de costos: lugares de compra, ingredientes, recetas, productos, precios y cotizaciones.',
        'Datos técnicos: dirección IP y navegador, que usamos para la seguridad y para limitar intentos repetidos de entrar.',
        'Origen de tu visita: si llegas desde un anuncio o un enlace con etiquetas, guardamos de dónde vino (por ejemplo, la campaña) para saber qué promociones funcionan.',
        'Solo si aceptas las cookies de medición: al comprar o registrarte, enviamos a Meta y a TikTok el evento de la compra o del registro, con tu correo (y a Meta también tu nombre) cifrados, tu IP, tu navegador y los identificadores de sus cookies, para medir nuestros anuncios. Google Analytics recibe la actividad de tu navegador, sin tu correo.',
      ],
    },
    {
      heading: 'Datos sensibles',
      paragraphs: [
        'No te pedimos datos personales sensibles (salud, origen, creencias u otros similares). Te pedimos no escribirlos en tus preguntas.',
      ],
    },
    {
      heading: 'Para qué usamos tus datos',
      paragraphs: ['Para lo necesario del servicio:'],
      items: [
        'Crear tu cuenta y darte acceso a lo que compraste.',
        'Cobrar, confirmar tu pago, activar y renovar tu acceso, y atender reembolsos.',
        'Enviarte correos del servicio: el enlace para entrar, la confirmación de compra y los avisos de vencimiento.',
        'Responder tus preguntas y dudas de soporte.',
        'Mantener la seguridad del sitio y evitar abusos.',
        'Cumplir obligaciones legales y contables.',
      ],
    },
    {
      heading: 'Para qué más (puedes decir que no)',
      items: [
        'Enviarte correos con recetas y ofertas, solo si marcaste la casilla al registrarte.',
        'Medir y mejorar nuestros anuncios, solo si aceptas las cookies de medición.',
      ],
      paragraphs: [
        'Si no quieres alguno de estos usos, dínoslo en cualquier momento y dejaremos de hacerlo, sin afectar tu acceso a lo que compraste.',
      ],
    },
    {
      heading: 'Con quién compartimos tus datos',
      paragraphs: [
        'No vendemos tus datos. Los compartimos solo con empresas que nos prestan un servicio y que tratan los datos por nuestra cuenta; algunas están fuera de México:',
      ],
      items: [
        'Stripe: procesa los pagos con tarjeta.',
        'Bunny.net: aloja y entrega los videos y los archivos de los cursos.',
        'Brevo: envía nuestros correos.',
        'Railway: aloja el sitio y la base de datos.',
        'Anthropic (Claude): es el asistente de inteligencia artificial de las preguntas. Cuando le preguntas algo, enviamos el texto de tu pregunta y el contenido de la lección relacionada para generar la respuesta. No le enviamos tu correo.',
        'Meta, TikTok y Google (Analytics): solo si aceptas las cookies de medición.',
      ],
    },
    {
      heading: 'Tus preguntas en las lecciones',
      paragraphs: [
        'Cuando la chef responde una pregunta, la pregunta y la respuesta pueden verlas las demás alumnas con acceso a ese curso, junto con tu primer nombre. Mientras una pregunta espera respuesta, solo la ves tú y la chef. Puedes pedirnos que oculten una pregunta tuya.',
      ],
    },
    {
      heading: 'Tus derechos',
      paragraphs: [
        `Tienes derecho a acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso (derechos ARCO), y a revocar tu consentimiento. Escríbenos a ${email} desde el correo de tu cuenta, con tu nombre y qué quieres hacer. Te respondemos en un máximo de 20 días hábiles.`,
        'Si crees que tus derechos no se respetaron, puedes acudir a la autoridad de protección de datos personales en México (hoy, la Secretaría Anticorrupción y Buen Gobierno).',
      ],
    },
    {
      heading: 'Cuánto tiempo guardamos tus datos',
      paragraphs: [
        'Mientras tengas cuenta o los necesitemos para darte el servicio. Los datos de las compras los conservamos el tiempo que exijan las obligaciones legales y contables. Si pides cancelar tus datos, los borramos salvo lo que la ley nos obligue a conservar.',
      ],
    },
    {
      heading: 'Cookies',
      paragraphs: [
        'Usamos cookies propias y, si las aceptas, de medición. Su detalle está en la política de cookies.',
      ],
    },
    {
      heading: 'Menores de edad',
      paragraphs: [
        'El sitio no está dirigido a menores de edad. Si crees que un menor nos dio sus datos, escríbenos y los borraremos.',
      ],
    },
    {
      heading: 'Cambios a este aviso',
      paragraphs: [
        'Si cambia algo importante, actualizaremos esta página y la fecha de arriba.',
      ],
    },
  ],
}

const terms: LegalDoc = {
  slug: 'terminos',
  title: 'Términos y condiciones',
  intro:
    'Estas reglas aplican cuando usas el sitio, compras un curso o usas la herramienta de costos de Capagla. Al comprar o crear una cuenta, aceptas estos términos.',
  sections: [
    {
      heading: 'Qué ofrecemos',
      paragraphs: [
        `Capagla es una escuela en línea de repostería de la chef Gladis, que opera ${responsable}${domicilio ? `, con domicilio en ${domicilio}` : ''}. Vendemos cursos en video con recetas y recursos descargables, y una herramienta de costos con niveles (por ejemplo, Básico y Completo) para calcular lo que cuestan tus postres.`,
      ],
    },
    {
      heading: 'Tu cuenta',
      items: [
        'Entras con un enlace que te llega al correo; la contraseña es opcional.',
        'La cuenta es personal. No la compartas ni compartas tu enlace de acceso.',
        'Eres responsable de lo que se haga desde tu cuenta. Si crees que alguien más entró, avísanos.',
        'Podemos suspender una cuenta que incumpla estos términos o abuse del servicio.',
      ],
    },
    {
      heading: 'Precios y pago',
      paragraphs: [
        'Los precios están en pesos mexicanos (MXN) y el total aparece antes de pagar. Se paga con tarjeta a través de Stripe. Las promociones tienen vigencia y condiciones que se muestran en su página: el precio que ves al pagar es el que se cobra.',
      ],
    },
    {
      heading: 'Acceso de 365 días',
      paragraphs: [
        'Cada compra da acceso por 365 días a partir de que se activa. Cuando vence, dejas de ver el contenido, pero tu cuenta y tu avance se conservan.',
      ],
      items: [
        'Puedes renovar desde Mis cursos; el precio de la renovación se muestra ahí.',
        'Si pasas de un nivel de la herramienta a uno más alto, pagas solo la diferencia.',
        'Los cursos o productos gratis que vienen con una promoción tienen su propio acceso, que se activa junto con tu compra.',
      ],
    },
    {
      heading: 'Qué puedes hacer con el contenido',
      paragraphs: [
        'Los videos, recetarios, PDF, textos y demás materiales son de Capagla. Te damos una licencia personal, no transferible, para verlos y usarlos mientras tengas acceso.',
        'Sí puedes preparar las recetas y vender los postres que hagas con ellas. No puedes copiar, descargar los videos, compartir tu acceso, revender, publicar ni distribuir el contenido, ni usarlo para entrenar sistemas de inteligencia artificial.',
      ],
    },
    {
      heading: 'Preguntas y comentarios',
      paragraphs: [
        'Las preguntas que haces en una lección pueden mostrarse, ya respondidas, a otras alumnas del curso con tu primer nombre. Escribe con respeto y sin datos personales tuyos ni de terceras personas. Podemos ocultar lo que sea inapropiado.',
      ],
    },
    {
      heading: 'Asistente de inteligencia artificial',
      paragraphs: [
        'Las preguntas se responden primero con un asistente de inteligencia artificial que usa el contenido del curso. Puede equivocarse. Si su respuesta no te sirve, puedes mandar la pregunta a la chef. No sustituye el consejo de un profesional.',
      ],
    },
    {
      heading: 'Recetas, resultados y herramienta de costos',
      items: [
        'Los resultados dependen de tus ingredientes, equipo y práctica; no garantizamos ventas ni ganancias.',
        'Revisa los ingredientes de cada receta y tus alergias antes de preparar o vender un postre. La seguridad de lo que cocinas y vendes es tuya.',
        'La herramienta de costos calcula con los datos y precios que tú capturas. Es una ayuda para decidir, no asesoría fiscal, contable ni legal.',
      ],
    },
    {
      heading: 'Devoluciones',
      paragraphs: [
        'Las reglas de reembolso están en la política de devoluciones.',
      ],
    },
    {
      heading: 'Disponibilidad',
      paragraphs: [
        'Hacemos lo posible por que el sitio funcione siempre, pero puede haber interrupciones por mantenimiento o por servicios de terceros. Podemos mejorar, cambiar o reordenar el contenido de los cursos.',
      ],
    },
    {
      heading: 'Responsabilidad',
      paragraphs: [
        'Nuestra responsabilidad se limita, hasta donde la ley lo permita, al monto que pagaste por el producto en cuestión. Esto no limita los derechos que la ley te da como consumidora.',
      ],
    },
    {
      heading: 'Ley aplicable',
      paragraphs: [
        'Estos términos se rigen por las leyes de México. Como consumidora, también puedes acudir a la Procuraduría Federal del Consumidor (PROFECO).',
      ],
    },
    {
      heading: 'Cambios y contacto',
      paragraphs: [
        `Si actualizamos estos términos, publicaremos la nueva versión aquí con su fecha. Para cualquier duda, escribe a ${email}.`,
      ],
    },
  ],
}

const refunds: LegalDoc = {
  slug: 'devoluciones',
  title: 'Política de devoluciones',
  intro:
    'Nuestros productos son digitales y el acceso empieza al pagar. Si algo no salió como esperabas, queremos resolverlo.',
  sections: [
    {
      heading: 'Cómo pedir un reembolso',
      paragraphs: [
        `Escríbenos a ${email} desde el correo con el que compraste y cuéntanos qué pasó. Revisamos cada caso y te respondemos por correo.`,
      ],
    },
    {
      heading: 'Qué pasa con tu acceso',
      items: [
        'Un reembolso total retira el acceso a todo lo que incluía esa compra: el curso, el curso adicional gratis y la herramienta de costos, si venían en ella.',
        'Si ya tenías alguno de esos productos por otra compra pagada, lo conservas.',
        'Si el reembolso es de una mejora de nivel de la herramienta, vuelves al nivel que tenías antes.',
        'Un reembolso parcial no retira el acceso.',
        'Tu cuenta y tu avance en las lecciones no se borran. Si vuelves a comprar, recuperas el acceso.',
      ],
    },
    {
      heading: 'Cómo recibes tu dinero',
      paragraphs: [
        'El reembolso se hace a la misma tarjeta con la que pagaste. Cuándo lo ves en tu estado de cuenta depende de tu banco.',
      ],
    },
    {
      heading: 'Cobros por error',
      paragraphs: [
        'Si te cobramos dos veces o por algo que no compraste, avísanos y lo corregimos. Te pedimos escribirnos antes de pedir un contracargo a tu banco, así lo resolvemos más rápido.',
      ],
    },
    {
      heading: 'Compras gratis',
      paragraphs: [
        'Lo que obtienes gratis no tiene cobro, así que no hay nada que reembolsar.',
      ],
    },
  ],
}

const cookies: LegalDoc = {
  slug: 'cookies',
  title: 'Política de cookies',
  intro:
    'Las cookies son archivos pequeños que el sitio guarda en tu navegador. Aquí ves cuáles usamos y cómo cambiar tu elección.',
  sections: [
    {
      heading: 'Tu elección',
      paragraphs: [
        'La primera vez que entras te preguntamos si aceptas las cookies de medición o prefieres quedarte solo con las necesarias. Los píxeles de Meta, TikTok y Google Analytics se cargan únicamente si aceptas.',
        'Para cambiar tu elección, borra las cookies de este sitio en tu navegador: el aviso volverá a aparecer.',
      ],
    },
    {
      heading: 'Cookies necesarias (propias)',
      paragraphs: [
        'Sin ellas el sitio no funciona bien. Siempre están activas.',
      ],
      items: [
        'Sesión: mantiene tu sesión iniciada.',
        'capagla_cookies: guarda tu elección sobre las cookies. Dura 1 año.',
        'capagla_orden: reconoce tu compra para mostrarte la página de confirmación. Dura 1 día.',
        'Stripe: al pagar, Stripe guarda cookies para prevenir fraudes y procesar el pago.',
      ],
    },
    {
      heading: 'Cookies propias de medición interna',
      paragraphs: [
        'No salen a ninguna plataforma y sirven para saber qué promociones funcionan.',
      ],
      items: [
        'capagla_attr: guarda de dónde llegaste (campaña o anuncio) si entras con un enlace con etiquetas. Dura 90 días.',
        'capagla_visitante: un identificador anónimo para contar visitas a las promociones sin repetirlas. Dura 1 año.',
      ],
    },
    {
      heading: 'Cookies de medición de terceros (solo si aceptas)',
      items: [
        'Meta (Facebook e Instagram): su píxel mide visitas y compras de nuestros anuncios.',
        'TikTok: su píxel mide visitas y compras de nuestros anuncios.',
        'Google Analytics: mide cómo se usa el sitio.',
      ],
      paragraphs: [
        'Estas empresas tienen sus propias políticas sobre las cookies que guardan. Si aceptas, al comprar o registrarte también enviamos el evento a sus servidores, como explica el aviso de privacidad.',
      ],
    },
    {
      heading: 'Almacenamiento en tu navegador',
      paragraphs: [
        'El reproductor guarda en tu navegador la velocidad, el volumen y el modo claro u oscuro que elegiste. Se queda en tu dispositivo.',
      ],
    },
  ],
}

export const LEGAL_DOCS: Record<LegalDoc['slug'], LegalDoc> = {
  privacidad: privacy,
  terminos: terms,
  devoluciones: refunds,
  cookies,
}
