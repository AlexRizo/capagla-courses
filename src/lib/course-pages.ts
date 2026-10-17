// Contenido de la landing de venta de cada curso (/cursos/$slug y las promociones).
// Datos en duro por ahora; más adelante saldrán del panel.
// Los precios y el recuadro de promoción no están aquí: salen de `lib/offers.ts`.
export type CourseContent = {
  slug: string
  badge: string
  title: string
  intro: string
  introShort: string
  heroImage: string
  heroAlt: string
  forWhom: string[]
  recipesTitle: string
  recipes: { name: string; desc: string; descShort: string; image: string }[]
  includesText: string
  includes: {
    big: string
    bigShort?: string
    label: string
    labelShort: string
  }[]
  teacherText: string
  teacherTextShort: string
  testimonials: number
  faq: { q: string; a: string; aShort: string }[]
}

export type Offer = {
  tag: string
  title: string
  old: string
  now: string
  note: string
}

// La landing lista para mostrar: contenido + precios y promoción del momento.
export type CoursePage = CourseContent & {
  price: string
  strike: string
  strikeShort: string
  priceNote: string
  promo: { title: string; offers: Offer[] } | null
  // Promoción desde la que se entró; los botones de compra la llevan al checkout.
  promoSlug?: string
  // Clave del enlace de prueba (solo admin); se pasa al checkout.
  promoTest?: string
  // Video de intro de la promoción (URL firmada de Bunny): lo abre el botón de reproducir.
  introVideo?: string | null
}

export const courseContents: Partial<Record<string, CourseContent>> = {
  'postres-navidad': {
    slug: 'postres-navidad',
    badge: 'Curso en línea · 11 recetas · a tu ritmo',
    title: 'Postres para vender en Navidad',
    intro:
      '11 recetas rendidoras con medidas exactas, técnicas de decoración y consejos para empacar y cobrar, por si decides venderlas. Desde cero, a tu ritmo, desde casa.',
    introShort:
      '11 recetas rendidoras con medidas exactas, decoración y consejos para empacar y cobrar. Desde cero, a tu ritmo.',
    heroImage: '/images/postres-navidad.jpg',
    heroAlt: 'Gladis con sus postres navideños',
    forWhom: [
      'Quieres vender postres en temporada y no sabes por dónde empezar.',
      'Ya horneas, pero quieres decorar como en pastelería.',
      'Buscas recetas rendidoras que dejen buen margen.',
    ],
    recipesTitle: 'Las 11 recetas que vas a preparar',
    recipes: [
      {
        name: 'Enjambre de chocolate',
        desc: 'Rinde mucho, económico',
        descShort: 'Rinde mucho',
        image: 'enjambre-chocolate',
      },
      {
        name: 'Turrón de chocolate',
        desc: 'Fácil y económico',
        descShort: 'Fácil y económico',
        image: 'turron-chocolate',
      },
      {
        name: 'Brownie de cheesecake',
        desc: 'Dos capas, corte decorado',
        descShort: 'Dos capas',
        image: 'brownie-cheesecake',
      },
      {
        name: 'Blondie',
        desc: 'Preparación y decoración',
        descShort: 'Decorado',
        image: 'blondie',
      },
      {
        name: 'Cupcake navideño',
        desc: 'Chantilly y 4 decorados',
        descShort: '4 decorados',
        image: 'cupcake-navideno',
      },
      {
        name: 'Lunch Box Cake',
        desc: 'Betún de mantequilla suizo',
        descShort: 'Betún suizo',
        image: 'lunch-box-cake',
      },
      {
        name: 'Roles de canela',
        desc: 'Normales y mini',
        descShort: 'Normales y mini',
        image: 'roles-canela',
      },
      {
        name: 'Alfajores',
        desc: 'Horneado y decorado',
        descShort: 'Horneado',
        image: 'alfajores',
      },
      {
        name: 'Galleta de mantequilla',
        desc: 'Royal icing',
        descShort: 'Royal icing',
        image: 'galleta-mantequilla',
      },
      {
        name: 'Galleta de jengibre',
        desc: 'Corte, horneado y decorado',
        descShort: 'Decorada',
        image: 'galleta-jengibre',
      },
      {
        name: 'Galleta red velvet',
        desc: 'Rellena',
        descShort: 'Rellena',
        image: 'galleta-red-velvet',
      },
    ],
    includesText:
      'Un curso completo, organizado por capítulos, para que avances paso a paso y vuelvas a cualquier receta cuando la necesites.',
    includes: [
      {
        big: '11',
        label: 'recetas completas',
        labelShort: 'recetas completas',
      },
      {
        big: '52',
        label: 'videos paso a paso',
        labelShort: 'videos paso a paso',
      },
      {
        big: 'A tu ritmo',
        bigShort: '365',
        label: 'desde tu celular, tableta o computadora',
        labelShort: 'días de acceso',
      },
      {
        big: 'PDF',
        label: 'recetario con utensilios e ingredientes',
        labelShort: 'recetario con ingredientes',
      },
    ],
    teacherText:
      'Soy Gladis y tengo años de experiencia en repostería. En este curso te comparto las técnicas que uso en mis postres, con gramos, temperaturas y tiempos exactos, para que te salgan igual cada vez.',
    teacherTextShort:
      'Soy Gladis y tengo años de experiencia en repostería. Te comparto mis técnicas con gramos, temperaturas y tiempos exactos.',
    testimonials: 3,
    faq: [
      {
        q: '¿Necesito conocimientos previos?',
        a: 'No. Aprenderás las técnicas desde cero y te guiamos para que puedas hacer cualquiera de las recetas sin importar su dificultad.',
        aShort:
          'No. Aprenderás las técnicas desde cero y te guiamos para que puedas hacer cualquiera de las recetas.',
      },
      {
        q: '¿Cómo son las clases?',
        a: '100% en línea, a tu ritmo, desde cualquier dispositivo. Solo necesitas internet.',
        aShort: '100% en línea, a tu ritmo, desde cualquier dispositivo.',
      },
      {
        q: '¿Cómo compro?',
        a: 'Das tu correo y tu nombre, pagas con tarjeta y recibes el acceso por correo al momento.',
        aShort:
          'Das tu correo y tu nombre, pagas y recibes el acceso por correo al momento.',
      },
      {
        q: '¿Cuánto tiempo tengo acceso?',
        a: 'Tienes acceso durante 365 días desde tu compra. Al terminar ese periodo puedes renovar con hasta 85% de descuento sobre el precio de ese momento.',
        aShort:
          '365 días desde tu compra. Después puedes renovar con hasta 85% de descuento.',
      },
      {
        q: '¿Qué métodos de pago hay?',
        a: 'Tarjeta de crédito o débito, procesada de forma segura con Stripe.',
        aShort: 'Tarjeta, Apple Pay o Google Pay, procesados con Stripe.',
      },
      {
        q: '¿Puedo pagar desde otro país?',
        a: 'Sí. Stripe cobra en tu moneda.',
        aShort: 'Sí. Stripe cobra en tu moneda.',
      },
    ],
  },
}
