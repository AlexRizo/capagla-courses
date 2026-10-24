Capagla · Técnico · Para visto bueno

# Herramienta de Costos

Lógica, entidades y reglas de cálculo de la herramienta de costos para reposteras. Es un sistema aparte del LMS. Aquí se revisa y se autoriza antes de pasarlo a David.

En revisión · Marca cada sección cuando la apruebes

## Cómo leer este documento

La herramienta de costos es un sistema aparte del LMS: sirve para que una repostera sepa cuánto le cuesta cada producto, ponga su precio con semáforo, organice su producción y arme su lista de compra. Este documento y el prototipo van juntos.

**1. El prototipo: cómo se ve y se usa**

Son las pantallas navegables. Ábrelo en [Capagla - Técnico - 02 Prototipo pantallas](https://claude.ai/artifact/8Lje9T2y1ZPDGf8NLPMzYA) y entra a la pestaña (página) **Herramienta de costos**. Ahí están todas las pantallas de esta herramienta: Productos, Recetas, Premezclas, Ingredientes, Etiquetas, Producción, Cotizador, Lista de compra, Registro de compras, Lugares de compra y Ajustes. Se puede navegar de una a otra con el menú lateral, como en la app real. Las cifras son de ejemplo.

**2. Este documento: por qué funciona así**

Aquí abajo se explica la lógica de cada apartado: menú y niveles de acceso, entidades, cómo se calcula el costo, cómo se fija el precio y el semáforo, la producción, el cotizador y la lista de compra. El prototipo muestra qué se ve; este documento dice qué reglas hay detrás.

**3. En qué orden leerlo**

Primero recorre el prototipo de principio a fin (Productos, Recetas, Ingredientes). Después lee las secciones de aquí abajo en orden. Al final están los pendientes: lo que todavía no está decidido.

Para pasarlo al desarrollador o dejarlo en el repositorio.

## Contenido

1. [○Alcance y entrega](#alcance)
2. [○Menú](#menu)
3. [○Niveles de usuario y acceso](#niveles)
4. [○Entidades](#entidades)
5. [○Modelo de costo](#costo)
6. [○Precio y semáforo](#precio)
7. [○Producción](#produccion)
8. [○Lista de compra](#lista)
9. [○Pantallas del prototipo](#pantallas)
10. [○Pendientes por decidir](#pendientes)

## Alcance y entrega

[ ] Revisado

- Es una web app, no una app nativa. Forma parte del prototipo Capagla.
- Tiene su propio panel, aparte del resto: sidebar morado oscuro y contenido en gris claro (RGB 243 241 243), estilo admin.
- Se entrega al desarrollador con shadcn, Tailwind y Node.
- Las cifras de todas las pantallas son de ejemplo.

## Menú

[ ] Revisado

Así se ve el menú lateral de la herramienta, en orden.

**Costos**

- Productos
- Recetas
- Premezclas
- Ingredientes
- Etiquetas

**Compras**

- Lista de compra
- Registro de compras

**Herramientas**

- Producción
- Cotizador

**Otras opciones**

- Lugares de compra
- Ajustes de costos

## Niveles de usuario y acceso

[ ] Revisado

La herramienta se vende por nivel. Cada nivel abre una parte del menú y limita la cantidad de registros. El precio máximo es de unos $300 MXN al año.

**Propuesta inicial.** Todavía no están definidos el precio ni las funciones de cada nivel. Estos son los dos niveles de usuario que se proponen de entrada.

**Nivel 1**

Recetas, ingredientes, premezclas, costos y semáforo. Los precios de venta se escriben a mano.

**Nivel 2**

Producción, Cotizador (por ahora), Lista de compra y Registro de compras (que guarda el último precio y su cambio).

| Opción del menú | Acceso |
| --- | --- |
| Productos, Recetas, Premezclas, Ingredientes | Nivel 1 |
| Producción, Cotizador, Lista de compra, Registro de compras | Nivel 2 (Cotizador, por ahora) |
| Lugares de compra | Sin nivel propio. Lo usa el ingrediente. |
| Etiquetas, Ajustes de costos | Por confirmar |

Sin inventario. Solo existe "Ya lo tengo" en la lista de compra.

## Entidades

[ ] Revisado

| Entidad | Qué es y cómo se comporta |
| --- | --- |
| Producto | Lo que se vende: recetas más el empaque del entero. Al agregar una receta se pregunta cuántas piezas salieron para vender (por defecto, lo que rinde la receta) y se explica por qué: si salen menos, cada pieza cuesta más. El costo por pieza vendible es el costo de la receta ÷ esas piezas. Opcional "también se vende por rebanadas": costo del entero ÷ N, más empaque por rebanada. Aquí viven el precio y el semáforo. |
| Receta | Nombre, etiqueta (tipo) y cuántas piezas rinde. El rendimiento siempre se mide en piezas (ej. Pastel rinde 1, Cupcake rinde 24). Sí lleva costo (ingredientes, merma, mano de obra y gasto fijo, ver Modelo de costo), pero no lleva precio de venta ni empaque: eso vive en el Producto. Los nombres se pueden repetir (se distinguen por etiqueta). No hay slug. |
| Tipo de receta (etiqueta) | Es una etiqueta para clasificar recetas: Pastel, Cupcake, Galleta… Se escribe al crear la receta y autocompleta con las etiquetas que ya existen. Sirve solo para filtrar el listado de recetas. No define el rendimiento. |
| Premezcla | Sub-receta con rendimiento final real y unidad elegible (g, kg, ml, l), porque un sólido puede terminar líquido. El costo es proporcional a lo usado. |
| Ingrediente / empaque | Precio, cantidad de compra, tipo (ingrediente o empaque), lugar de compra, merma opcional y "uso flexible" opcional. Ejemplo: el huevo se compra por pieza y se usa en gramos o piezas; el peso promedio sale de pesar piezas. |
| Tipo de ingrediente | Solo dos valores fijos: Ingrediente y Empaque. Sirve para distinguir uno de otro (por ejemplo, para verlos por separado) y no se administra ni se ordena. No hay tipos por pasillo o departamento: ordenar por como acomoda cada tienda sus cosas sería demasiado trabajo para la primera versión. El orden de compra se define en la Lista de compra. |
| Lugar de compra | Harinero, Sams, Soriana… Los ingredientes sin lugar caen en "Sin lugar asignado". |
| Producción | Es el apartado donde la repostera arma lo que ya sabe que va a hacer: nombre, productos y cantidades. De ahí salen su lista de compra (los insumos que necesita) y su utilidad esperada. Se guarda 30 días en dos tablas, `producciones` y `producción_items` (id de producto y cantidad); todo se recalcula. Vence y se limpia con una tarea diaria. Cada producción tiene su propia lista de compra. |
| Cotización | La que se arma en el Cotizador: producto, cantidad, horas extra y una lista simple de extras (nombre y costo). Se guarda para poder consultarla o repetirla después. Guarda lo que se capturó y se recalcula con los costos del momento, igual que la producción. No modifica el producto. Falta decidir cuánto tiempo se conserva y si se archiva o se limpia como la producción. |

### Archivar, no borrar

- Productos, recetas, premezclas e ingredientes se archivan (`archivado_en`).
- Siguen funcionando en lo que ya los usa.
- Avisan al archivar si están en uso, y se pueden restaurar.
- No se muestran contadores "usada en", para no sumar consultas.

## Modelo de costo

[ ] Revisado

Receta = ingredientes + merma opcional + mano de obra (horas de trabajo × tarifa) + gasto fijo (horas de horno × tarifa)

**Gasto fijo por hora**

Luz, gas y renta × % que ocupa ÷ horas al mes, más depreciación del equipo. No es lo mismo que la mano de obra por hora.

**Mano de obra por hora**

- **A:** lo que quiere ganar al mes ÷ horas al mes
- **B:** base del salario mínimo diario ÷ 8
- **C:** no sumar por ahora. Se muestra como "te queda (incluye tu trabajo)"

**Otras reglas**

- Merma opcional en ingrediente, premezcla (rendimiento real) y receta.
- Impuestos opcionales con % propio.
- Los costos se calculan al vuelo. Solo se guardan ingredientes, líneas de receta y compras.

## Precio y semáforo

[ ] Revisado

El precio se fija como "vender a N × mi costo". Es un múltiplo, no un porcentaje. Ejemplo en pantalla: $100 → $143 (1.43×). El 1.43 es de ejemplo. Un aviso en pantalla evita confundir 30% con ×3.

El múltiplo se puede aplicar sobre el costo total, o solo sobre ingredientes y empaque (la regla de redes ×3).

**Rojo**\
El precio es menor que el costo.

**Amarillo**\
El precio cubre el costo, pero es menor que el múltiplo.

**Verde**\
El precio es igual o mayor que el múltiplo.

"Quizás lo estés vendiendo muy barato. Recuerda que hay gastos aparte de los ingredientes: tu tiempo, el gas, la luz y el desperdicio."

## Producción

[ ] Revisado

Es donde la repostera crea lo que ya sabe que va a producir. Le genera la lista de compra con los insumos que necesita y su utilidad esperada. Cotizar es otra cosa y va aparte (ver Pendientes).

Una sola ficha con tres partes: nombre y resumen, una barra, y una tabla.

- **Resumen:** horas, dinero para comprar, costo total, ventas y ganancia.
- **Barra:** búsqueda y agregar producto.
- **Botones al final, centrados:** Proyectar producción e Ir directo a la lista.

**Dinero para comprar** = ingredientes y empaque. **Costo total** incluye además mano de obra y gasto fijo.

## Lista de compra

[ ] Revisado

Es una sola lista con dos vistas.

**Por tienda**

Grupos por lugar de compra. Se arrastra un renglón para ordenarlo dentro de la tienda, o a otro lugar si ese día se compra ahí. El orden lo pone la repostera, como va a recorrer esa tienda hoy.

**Por ingrediente**

Una sola lista que también se ordena arrastrando los renglones; es el mismo orden que se ve por tienda. Cada renglón tiene un selector de lugar.

- "Ya lo tengo" y alta manual. Cada renglón indica su origen: Producción o Manual.
- La barra de producción solo aparece si se llega desde una producción.
- Salidas: PDF, texto compartido y vista web móvil.

## Pantallas del prototipo

[ ] Revisado

Están en la página "Herramienta de costos" del prototipo, **Capagla - Técnico - 02 Prototipo pantallas**.

Los módulos con detalle (productos, recetas, premezclas, ingredientes, producciones y compras) entran primero por un listado y de ahí al detalle. El botón "Nuevo" lleva a una pantalla vacía.

- Productos y 5 detalles de producto: amarillo con rebanadas, verde, rojo, faltan precios y vacío.
- Recetas y Receta.
- Premezclas y Premezcla.
- Ingredientes e Ingrediente.
- Etiquetas y Ajustes.
- Producciones y Producción.
- Lista, Registro de compras y Registrar compra.
- Lugares de compra y Lista móvil.

## Pendientes por decidir

[ ] Revisado

- Límites reales de cada nivel y el precio.
- A qué nivel pertenecen Etiquetas y Ajustes de costos.
- **Cotizador, una herramienta aparte de Producción (ambas en el menú Herramientas).** Sirve para cotizar un pedido personalizado a partir de un producto que ya tiene sus ingredientes, por ejemplo un pastel con decoración muy elaborada. Propuesta: eliges el producto y la cantidad; la pantalla muestra las horas de trabajo que ya traen sus recetas y pregunta cuántas horas extra de decorado llevará. Esas horas se multiplican por la tarifa de mano de obra de Ajustes y se suman al costo. El resultado es un número: "menos de esto no puedes cobrar". También lleva una lista simple de extras para ese pedido (palitos, tupers, un muñeco de dinosaurio de $90…), cada uno con nombre y costo. Pueden ser ingredientes ya dados de alta o no, y se suman al costo. Las cotizaciones se guardan (tabla aparte) para consultarlas o repetirlas, y no se toca el producto. Decidido: solo se suman horas extra; las horas habituales de las recetas se quedan tal cual y no se descuenta nada. Las horas extra incluyen también el tiempo de conseguir los insumos extra, como ir a la tienda por el dinosaurio. Por ahora el Cotizador es de Nivel 2. Falta decidir cuánto tiempo se guardan las cotizaciones.
- Confirmar con la chef el múltiplo por defecto y sobre qué costo se aplica.
- Confirmar la fórmula del gasto fijo.
- Exportación de la lista: PDF, texto y checklist.
- Orden de la lista de compra: por ahora el orden se guarda con cada lista. Falta decidir si la lista recuerda el orden de cada tienda para la próxima vez (por ejemplo, que el Harinero siempre salga en el orden en que ella lo recorre).
- Probar el arrastrar y soltar en el navegador. El selector de lugar es la alternativa táctil.
- Modo oscuro opcional (tokens `.dark`).

Fuente: documento del proyecto herramienta-costos-decisiones. Las casillas de revisión se guardan solo en este navegador.

Link del Artifact: https://claude.ai/artifact/8Lje9T2y1ZPDGf8NLPMzYA?sk=ikPtkYm_wGH70jm41TajuA#page-ed8e1591e146