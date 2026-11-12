// Contenido de la landing de venta de cada curso (/cursos/$slug y las promociones).
// Datos en duro por ahora; más adelante saldrán del panel.
// Los precios y el recuadro de promoción no están aquí: salen de `lib/offers.ts`.
// Hay dos diseños: el de recetas (Navidad) y el del curso de costeo (`layout`).
export type RecipesContent = {
  layout: 'recipes'
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

// Una barra de la gráfica «¿Cuánto te queda por postre?»: cada costo con su color y su ícono.
export type CostingKind = 'ingredients' | 'packaging' | 'time' | 'gas'

export type CostingContent = {
  layout: 'costing'
  slug: string
  badge: string
  title: string
  intro: string
  // Recuadro «Pregúntate».
  question: string
  heroImage: string
  heroAlt: string
  problemsTitle: string
  problems: string[]
  // Gráfica de ejemplo: una venta de `sale` pesos; lo que pensabas (solo ingredientes) frente a
  // lo que realmente queda (con todos los costos).
  example: {
    kicker: string
    title: string
    sale: number
    perceived: { label: string; profit: number }
    actual: { label: string; profit: number; hiddenLabel: string }
    costs: { kind: CostingKind; label: string; amount: number }[]
    explain: string
    note: string
  }
  learnTitle: string
  learnIntro: string
  stages: {
    title: string
    topics: { icon: CostingTopicIcon; title: string; text: string }[]
  }[]
  teacherText: string
  // Texto de la tarjeta «Tu curso» de la landing de la promoción.
  courseCardText: string
  // Preguntas del enlace simple y de la promoción gratis.
  faq: { q: string; a: string }[]
  freeFaq: { q: string; a: string }[]
}

export type CostingTopicIcon =
  | 'price'
  | 'waste'
  | 'piece'
  | 'package'
  | 'time'
  | 'target'
  | 'chart'
  | 'quote'

export type CourseContent = RecipesContent | CostingContent

export type Offer = {
  tag: string
  title: string
  old: string
  now: string
  note: string
}

// Lo que cambia con el precio y la promoción del momento; es común a los dos diseños.
type Priced = {
  price: string
  // Precio en pesos (para los eventos de marketing).
  priceMxn: number
  strike: string
  strikeShort: string
  priceNote: string
  // Promoción desde la que se entró; los botones de compra la llevan al checkout.
  promoSlug?: string
  // Clave del enlace de prueba (solo admin); se pasa al checkout.
  promoTest?: string
  // Video de intro de la promoción (URL firmada de Bunny): lo abre el botón de reproducir.
  introVideo?: string | null
}

// La landing lista para mostrar: contenido + precios y promoción del momento.
export type RecipesCoursePage = RecipesContent &
  Priced & { promo: { title: string; offers: Offer[] } | null }

// Curso de costeo: `free` es la promoción que lo regala (landing «Quiero empezar gratis»); `promo`,
// sus adicionales (los niveles de la herramienta), con el mismo bloque que la landing de recetas.
export type CostingCoursePage = Omit<CostingContent, 'freeFaq'> &
  Priced & {
    free: boolean
    promo: { title: string; offers: Offer[] } | null
  }

export type CoursePage = RecipesCoursePage | CostingCoursePage

// Preguntas que comparten el enlace simple y la promoción gratis del curso de costeo.
const costingFaq = [
  {
    q: '¿Necesito ser buena para las matemáticas?',
    a: 'No. Solo sumas, multiplicaciones y repartir entre piezas. Usas la calculadora del celular y una hoja de papel, o una hoja de Excel.',
  },
  {
    q: '¿Sirve para cualquier postre?',
    a: 'Sí. El curso usa un brownie de dieciséis piezas como ejemplo, y en cada video haces el ejercicio con tu propio postre. También verás pasteles por rebanada y cajas.',
  },
  {
    q: '¿Cuánto tiempo toma?',
    a: 'Una tarde. Cada video es corto y puedes pausarlo para hacer el ejercicio.',
  },
  {
    q: '¿Los precios del curso son los que debo usar?',
    a: 'No. Son precios de ejemplo. Tú usas los tuyos, según tu región y tu moneda.',
  },
  {
    q: '¿Me garantiza ventas o ganancias?',
    a: 'Costear bien no garantiza ventas, pero te da datos claros para decidir cuánto invertir y a cuánto vender. Tú decides, y ahora con números claros.',
  },
]

export const courseContents: Partial<Record<string, CourseContent>> = {
  'postres-navidad': {
    layout: 'recipes',
    slug: 'postres-navidad',
    badge: 'Curso en línea · 11 recetas · a tu ritmo',
    title: 'Postres para vender en Navidad',
    intro:
      '11 recetas rendidoras con medidas exactas, técnicas de decoración y consejos para empacar y cobrar: postres para vender. Desde cero, a tu ritmo, desde casa.',
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
        big: '50',
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
  'calcular-costos': {
    layout: 'costing',
    slug: 'calcular-costos',
    badge: 'Curso de costeo para reposteras',
    title: 'Aprende a Costear',
    intro:
      'En una tarde aprendes a costear tus postres y a definir el precio justo.',
    question:
      '¿Te ha pasado que vendes todos tus postres pero al final no te queda la utilidad que tenías planeada?',
    // La maqueta usa la foto del curso de Navidad mientras no haya una propia.
    heroImage: '/images/postres-navidad.jpg',
    heroAlt: 'Gladis presenta el curso de costeo',
    problemsTitle: 'Si no sabes cuánto cuesta, estás perdiendo dinero.',
    problems: [
      'Pones el precio al ojo.',
      'Copias lo que cobran otras.',
      'Cuentas solo los ingredientes.',
    ],
    example: {
      kicker: 'Costos y utilidad',
      title: '¿Cuánto te queda por postre?',
      sale: 35,
      perceived: { label: 'Lo que pensabas', profit: 24 },
      actual: {
        label: 'Lo que realmente te queda',
        profit: 15,
        hiddenLabel: 'Costos ocultos',
      },
      costs: [
        { kind: 'ingredients', label: 'Ingredientes', amount: 11 },
        { kind: 'packaging', label: 'Empaque', amount: 2 },
        { kind: 'time', label: 'Tu tiempo', amount: 6 },
        { kind: 'gas', label: 'Gas y otros gastos', amount: 1 },
      ],
      explain:
        'La parte rayada parecía utilidad. En el costeo completo, esa parte se va en costos.',
      note: 'Cifras de ejemplo.',
    },
    learnTitle: 'Lo que vas a dominar',
    learnIntro:
      'Aprende a costear bien tus productos para evitar errores al poner precio y proteger tu ganancia.',
    stages: [
      {
        title: 'Calcula el costo base',
        topics: [
          {
            icon: 'price',
            title: 'Precio de ingredientes',
            text: 'Ponle un valor real a cada ingrediente.',
          },
          {
            icon: 'waste',
            title: 'Merma',
            text: 'Calcula cuánto de lo que compras llega a tu receta.',
          },
          {
            icon: 'piece',
            title: 'Costo por pieza',
            text: 'Saca el costo por charola, rebanada o caja.',
          },
        ],
      },
      {
        title: 'Completa el costo y fija tu precio',
        topics: [
          {
            icon: 'package',
            title: 'Empaque',
            text: 'Suma el empaque al costo de cada pieza.',
          },
          {
            icon: 'time',
            title: 'Tu tiempo y gastos',
            text: 'Incluye mano de obra, gas, luz y desgaste del horno.',
          },
          {
            icon: 'target',
            title: 'Utilidad y precio',
            text: 'Fija un precio que te deje la ganancia que buscas.',
          },
        ],
      },
      {
        title: 'Decide y cotiza con confianza',
        topics: [
          {
            icon: 'chart',
            title: 'Toma decisiones con datos reales',
            text: 'Conoce el costo de tu producto para decidir si ajustar el precio, la porción o el empaque.',
          },
          {
            icon: 'quote',
            title: 'Cotiza pedidos grandes más rápido',
            text: 'Con el costeo listo, sabes cuánto te deja el pedido antes de aceptarlo.',
          },
        ],
      },
    ],
    teacherText:
      'Soy Gladis, repostera. Te acompaño con un solo brownie y números sencillos para que costees tus postres con confianza. Los términos técnicos los decimos una vez y enseguida los explicamos con palabras simples.',
    courseCardText:
      '8 videos cortos, una tarde y acceso por 1 año. Lo haces con hoja y calculadora.',
    faq: [
      ...costingFaq,
      {
        q: '¿Cuánto tiempo tengo acceso?',
        a: 'Tienes acceso por 1 año a partir de tu compra.',
      },
    ],
    freeFaq: [
      {
        q: '¿Por qué el curso es gratis?',
        a: 'Porque entraste desde nuestras redes: es una promoción por venir de ahí.',
      },
      {
        q: '¿Es obligatoria la herramienta de costos?',
        a: 'No. Es opcional. Si la quieres, la dejas en tu carrito; si no, la quitas, tomas el curso gratis y haces las cuentas a mano con hoja y calculadora.',
      },
      ...costingFaq,
      {
        q: '¿Cuánto tiempo tengo acceso?',
        a: 'Tienes acceso por 1 año a partir de que empiezas.',
      },
    ],
  },
}
