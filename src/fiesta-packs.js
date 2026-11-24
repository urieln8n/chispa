// Fiestón · contenido de los packs. Cada partida mezcla rondas de trivial y de «¿Quién es más probable…?».
// trivial: { tipo, texto, opciones[4], correcta, tiempo } · probable: { tipo, texto, tiempo } (los jugadores son las opciones)

export const PACKS = {
  navidad: {
    id: 'navidad',
    titulo: 'Pack Navidad',
    trivial: [
      { texto: '¿Cuántas uvas se comen en España con las campanadas de Nochevieja?', opciones: ['10', '12', '7', '24'], correcta: 1 },
      { texto: '¿Desde qué plaza de Madrid se retransmiten tradicionalmente las campanadas?', opciones: ['Plaza Mayor', 'Plaza de España', 'Puerta del Sol', 'Plaza de Cibeles'], correcta: 2 },
      { texto: '¿Qué día traen los regalos los Reyes Magos en España?', opciones: ['25 de diciembre', '1 de enero', '6 de enero', '24 de diciembre'], correcta: 2 },
      { texto: '¿Cómo se llama el premio mayor de la Lotería de Navidad del 22 de diciembre?', opciones: ['El Gordo', 'El Niño', 'La Pedrea', 'El Reintegro'], correcta: 0 },
      { texto: '¿Qué personaje trae los regalos en el País Vasco y Navarra?', opciones: ['El Tió', 'Olentzero', 'Papá Noel', 'Mari Domingi'], correcta: 1 },
      { texto: 'En Cataluña, ¿qué tronco «da» regalos a los niños si le dan golpes con un palo?', opciones: ['El Caganer', 'El Tió de Nadal', 'El Pessebre', 'La Mona'], correcta: 1 },
      { texto: '¿Qué se celebra en España el 28 de diciembre?', opciones: ['Los Santos Inocentes', 'San Silvestre', 'La Epifanía', 'Nochevieja'], correcta: 0 },
      { texto: 'Según la tradición española, ¿qué Rey Mago lleva el oro?', opciones: ['Gaspar', 'Baltasar', 'Melchor', 'Ninguno'], correcta: 2 },
      { texto: '¿Qué se esconde dentro del roscón de Reyes junto a la figurita?', opciones: ['Una moneda', 'Un haba', 'Una almendra', 'Una uva'], correcta: 1 },
      { texto: '¿Cuántos renos tiran del trineo de Papá Noel contando a Rudolph?', opciones: ['6', '8', '9', '12'], correcta: 2 },
      { texto: '¿De qué color es la nariz de Rudolph?', opciones: ['Azul', 'Roja', 'Dorada', 'Verde'], correcta: 1 },
      { texto: '¿En qué país empezó la costumbre moderna del árbol de Navidad?', opciones: ['Alemania', 'Italia', 'Estados Unidos', 'Noruega'], correcta: 0 },
      { texto: '¿De qué país es originaria la flor de Pascua?', opciones: ['España', 'Perú', 'México', 'Brasil'], correcta: 2 },
      { texto: '¿En qué idioma se escribió originalmente el villancico «Noche de paz»?', opciones: ['Inglés', 'Latín', 'Alemán', 'Italiano'], correcta: 2 },
      { texto: '¿Qué ciudad alicantina es famosa por su turrón?', opciones: ['Jijona', 'Elche', 'Toledo', 'Estepa'], correcta: 0 },
      { texto: '¿Qué pueblo de Sevilla es famoso por sus mantecados y polvorones?', opciones: ['Carmona', 'Estepa', 'Utrera', 'Écija'], correcta: 1 },
      { texto: '¿De qué país son típicas las hallacas en Navidad?', opciones: ['Venezuela', 'Argentina', 'Chile', 'Cuba'], correcta: 0 },
      { texto: 'En Colombia, ¿qué día empieza la Novena de Aguinaldos?', opciones: ['1 de diciembre', '8 de diciembre', '16 de diciembre', '24 de diciembre'], correcta: 2 },
      { texto: 'En México, ¿cuántas noches duran las posadas?', opciones: ['3', '7', '9', '12'], correcta: 2 },
      { texto: '¿Qué pareja es típica en la cena navideña colombiana?', opciones: ['Churros y chocolate', 'Buñuelos y natilla', 'Arepas y queso', 'Tamales y atole'], correcta: 1 },
      { texto: '¿Cómo se titula «Solo en casa» en Latinoamérica?', opciones: ['Mi pobre angelito', 'Solito en Navidad', 'Kevin en casa', 'Navidad en peligro'], correcta: 0 },
      { texto: '¿Cómo se llama el niño protagonista de «Solo en casa»?', opciones: ['Charlie', 'Kevin', 'Tommy', 'Danny'], correcta: 1 },
      { texto: '¿Quién escribió «Cuento de Navidad»?', opciones: ['Mark Twain', 'Charles Dickens', 'Oscar Wilde', 'Hans Christian Andersen'], correcta: 1 },
      { texto: '¿Cómo se llama el viejo avaro de «Cuento de Navidad»?', opciones: ['Ebenezer Scrooge', 'Jacob Marley', 'Bob Cratchit', 'El Grinch'], correcta: 0 },
      { texto: 'San Nicolás, el santo que inspiró a Papá Noel, nació en lo que hoy es…', opciones: ['Finlandia', 'Turquía', 'Holanda', 'Grecia'], correcta: 1 },
      { texto: '¿Qué se suele pedir con cada uva de Nochevieja?', opciones: ['Un regalo', 'Un deseo', 'Perdón', 'Otra uva'], correcta: 1 }
    ],
    probable: [
      '…de quemar la cena de Nochebuena?', '…de dormirse antes de las campanadas?', '…de atragantarse con las uvas?',
      '…de regalar calcetines otra vez?', '…de llegar tarde a la cena… con excusa incluida?', '…de llorar con un anuncio de Navidad?',
      '…de comerse el último trozo de turrón sin preguntar?', '…de hacer trampas en este juego?', '…de abrir los regalos antes de tiempo?',
      '…de cantar villancicos desafinando a todo volumen?', '…de olvidarse de comprar un regalo?', '…de hacer foto a la comida antes de que nadie pruebe nada?',
      '…de quedarse dormido en el sofá después de comer?', '…de reenviar el mismo meme navideño a todos los grupos?', '…de gastarse más de la cuenta en lotería?',
      '…de bailar encima de una silla en Nochevieja?', '…de que le toque el haba y tenga que pagar el roscón?', '…de regalar algo que le regalaron a él o ella?',
      '…de pelearse con las luces del árbol?', '…de decir «este año no como tanto» y repetir tres veces?', '…de mandar un audio de cinco minutos felicitando las fiestas?',
      '…de hacerse el dormido para no fregar?', '…de ponerse el jersey navideño más feo?', '…de esconder los mejores bombones para él o ella?',
      '…de llamar a alguien por el nombre equivocado esta noche?', '…de prometer ir al gimnasio en enero… y no ir?', '…de acabar contando la misma anécdota de todos los años?',
      '…de comerse las uvas antes de tiempo?', '…de quedarse con el mejor sitio del sofá?', '…de pedir la receta y no hacerla nunca?'
    ],
    // «Verdad o mentira»: cada jugador se inventa una respuesta falsa y luego todos intentan encontrar la verdadera
    mentira: [
      { texto: 'En Japón, muchas familias celebran la Navidad cenando comida de ___.', verdad: 'KFC' },
      { texto: 'En Noruega, en Nochebuena se esconden todas las ___ de la casa para que no las roben las brujas.', verdad: 'escobas' },
      { texto: 'En Ucrania es tradición decorar el árbol de Navidad con adornos en forma de ___.', verdad: 'telarañas' },
      { texto: 'En Caracas, la gente va a las misas de aguinaldo de madrugada en ___.', verdad: 'patines' },
      { texto: 'En Islandia, según la leyenda, un gato gigante se come a quien no estrena ___ en Navidad.', verdad: 'ropa nueva' },
      { texto: 'En Guatemala, el 7 de diciembre se celebra la «Quema del ___».', verdad: 'diablo' },
      { texto: 'En la ciudad sueca de Gävle, cada año alguien intenta ___ la cabra gigante de paja.', verdad: 'quemar' },
      { texto: 'En Italia, los regalos del 6 de enero los trae una bruja llamada ___.', verdad: 'la Befana' },
      { texto: 'En Polonia, en la cena de Nochebuena se deja un ___ libre para el invitado inesperado.', verdad: 'sitio en la mesa' },
      { texto: 'En Filipinas, la temporada de Navidad empieza oficialmente en ___.', verdad: 'septiembre' },
      { texto: 'En la República Checa, las chicas solteras lanzan un ___ por encima del hombro para saber si se casarán.', verdad: 'zapato' },
      { texto: 'En Perú, en Nochebuena es típico tomar chocolate caliente con ___.', verdad: 'panetón' },
      { texto: 'En Austria, un demonio con cuernos llamado ___ asusta a los niños que se han portado mal.', verdad: 'Krampus' }
    ]
  }
};

PACKS.quedadas = {
  id: 'quedadas',
  titulo: 'Pack Quedadas',
  trivial: [
    { texto: '¿Cuántos corazones tiene un pulpo?', opciones: ['1', '2', '3', '8'], correcta: 2 },
    { texto: '¿Cuál es el animal terrestre más rápido?', opciones: ['León', 'Guepardo', 'Caballo', 'Gacela'], correcta: 1 },
    { texto: '¿Cuál es la capital de Australia?', opciones: ['Sídney', 'Melbourne', 'Canberra', 'Perth'], correcta: 2 },
    { texto: '¿Cuántas patas tiene una araña?', opciones: ['6', '8', '10', '12'], correcta: 1 },
    { texto: '¿De qué color es la «caja negra» de un avión?', opciones: ['Negra', 'Naranja', 'Gris', 'Roja'], correcta: 1 },
    { texto: '¿Cuántos huesos tiene el cuerpo de una persona adulta?', opciones: ['106', '206', '306', '156'], correcta: 1 },
    { texto: '¿Qué planeta es conocido como el planeta rojo?', opciones: ['Venus', 'Júpiter', 'Marte', 'Mercurio'], correcta: 2 },
    { texto: '¿Qué instrumento tocaba Paco de Lucía?', opciones: ['Piano', 'Guitarra', 'Violín', 'Cajón'], correcta: 1 },
    { texto: '¿En qué ciudad está la Sagrada Familia?', opciones: ['Madrid', 'Sevilla', 'Barcelona', 'Valencia'], correcta: 2 },
    { texto: '¿Cuál es el océano más grande del mundo?', opciones: ['Atlántico', 'Índico', 'Pacífico', 'Ártico'], correcta: 2 },
    { texto: '¿Qué país tiene más habitantes del mundo?', opciones: ['China', 'India', 'Estados Unidos', 'Indonesia'], correcta: 1 },
    { texto: '¿Qué idioma tiene más hablantes nativos en el mundo?', opciones: ['Inglés', 'Español', 'Chino mandarín', 'Hindi'], correcta: 2 },
    { texto: '¿Cuál es el ingrediente principal del guacamole?', opciones: ['Aguacate', 'Tomate', 'Lima', 'Pepino'], correcta: 0 },
    { texto: '¿Qué pintor se cortó parte de una oreja?', opciones: ['Picasso', 'Dalí', 'Van Gogh', 'Monet'], correcta: 2 },
    { texto: '¿En qué país están las pirámides de Guiza?', opciones: ['México', 'Egipto', 'Perú', 'Sudán'], correcta: 1 },
    { texto: '¿Cuál es la moneda de Japón?', opciones: ['Yuan', 'Won', 'Yen', 'Rupia'], correcta: 2 },
    { texto: '¿Cuántos minutos dura un partido de fútbol sin descuento?', opciones: ['80', '90', '100', '120'], correcta: 1 },
    { texto: '¿Qué país tiene forma de bota en el mapa?', opciones: ['Grecia', 'Portugal', 'Italia', 'Chile'], correcta: 2 },
    { texto: '¿Cuántos jugadores de un equipo de fútbol hay en el campo?', opciones: ['9', '10', '11', '12'], correcta: 2 },
    { texto: '¿Cuál es el metal más caro de estos?', opciones: ['Plata', 'Oro', 'Cobre', 'Hierro'], correcta: 1 },
    { texto: '¿Qué animal es el símbolo de la marca Ferrari?', opciones: ['Un toro', 'Un caballo', 'Un león', 'Un águila'], correcta: 1 },
    { texto: '¿Qué gas necesitamos respirar para vivir?', opciones: ['Nitrógeno', 'Oxígeno', 'Helio', 'Dióxido de carbono'], correcta: 1 }
  ],
  probable: [
    '…de llegar tarde a la quedada?', '…de quedarse dormido en el cine?', '…de perder las llaves esta semana?', '…de mandar un mensaje al grupo equivocado?',
    '…de pedir postre después de decir que está lleno?', '…de hacerse famoso en TikTok?', '…de quedarse sin batería en el peor momento?', '…de perderse con el GPS puesto?',
    '…de reírse en el momento menos oportuno?', '…de comprar algo que no necesita en las rebajas?', '…de sobrevivir en una isla desierta?', '…de proponer «la última» y que no sea la última?',
    '…de quedarse el último en la fiesta?', '…de ganar un concurso de karaoke?', '…de olvidarse de un cumpleaños?', '…de tener cien pestañas abiertas en el móvil?',
    '…de enamorarse en un viaje?', '…de contestar un mensaje tres días después?', '…de organizar el próximo viaje del grupo?', '…de pedir lo mismo que otro en el restaurante?',
    '…de hacer de DJ sin que nadie se lo pida?', '…de decir «yo invito» y luego no encontrar la cartera?'
  ],
  mentira: [
    { texto: 'Un pulpo tiene ___ corazones.', verdad: 'tres' },
    { texto: 'El animal nacional de Escocia es el ___.', verdad: 'unicornio' },
    { texto: 'La Torre Eiffel puede crecer unos centímetros en verano por culpa del ___.', verdad: 'calor' },
    { texto: 'Los koalas pueden dormir hasta ___ horas al día.', verdad: '22' },
    { texto: 'Las nutrias de mar duermen ___ para no separarse.', verdad: 'agarradas de la mano' },
    { texto: 'Bien guardada, la miel puede durar ___.', verdad: 'miles de años' },
    { texto: 'En los caballitos de mar, el que se queda embarazado es ___.', verdad: 'el macho' },
    { texto: 'Una jirafa tiene en el cuello el mismo número de vértebras que ___.', verdad: 'una persona' },
    { texto: 'Los plátanos son ligeramente ___.', verdad: 'radiactivos' },
    { texto: 'Los flamencos son rosas por ___.', verdad: 'lo que comen' },
    { texto: 'El corazón de una ballena azul es del tamaño de ___.', verdad: 'un coche pequeño' }
  ]
};

function azar(n) { return crypto.getRandomValues(new Uint32Array(1))[0] % n; }
export function barajar(a) { for (let i = a.length - 1; i > 0; i--) { const j = azar(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Mezcla rondas del pack con las personalizadas (IA), alternando trivial y «más probable». Las personalizadas van repartidas.
export function montarRondas(packId = 'navidad', n = 10, extra = { trivial: [], probable: [] }) {
  const pack = PACKS[packId] || PACKS.navidad;
  n = Math.min(Math.max(parseInt(n, 10) || 10, 4), 30);
  const triv = [...(extra.trivial || []).map(q => ({ ...q, propia: true })), ...barajar(pack.trivial.map(q => ({ ...q })))];
  const prob = [...(extra.probable || []).map(t => ({ texto: t, propia: true })), ...barajar(pack.probable.map(t => ({ texto: t })))];
  // las personalizadas primero en cada montón, pero barajadas entre sí y dentro de la partida
  // reparto: trivial, más probable y verdad o mentira, en ese orden repetido
  const nMent = pack.mentira ? Math.floor(n / 3) : 0, nTriv = Math.ceil((n - nMent) / 2), nProb = n - nMent - nTriv;
  const t = barajar(triv.slice(0, nTriv)), p = barajar(prob.slice(0, nProb)), m = barajar((pack.mentira || []).map(q => ({ ...q, mentira: true }))).slice(0, nMent);
  const rondas = [];
  const ciclo = [t, p, m];
  for (let i = 0; rondas.length < n && i < n * 3; i++) {
    const q = ciclo[i % 3].shift();
    if (!q) continue;
    if (q.mentira) rondas.push({ tipo: 'mentira', texto: q.texto, verdad: q.verdad, tiempo: 45, tiempoVoto: 25 });
    else if (q.opciones) {
      // baraja las opciones manteniendo la correcta
      const orden = barajar([0, 1, 2, 3].slice(0, q.opciones.length));
      rondas.push({ tipo: 'trivial', texto: q.texto, opciones: orden.map(k => q.opciones[k]), correcta: orden.indexOf(q.correcta), tiempo: 20, propia: !!q.propia });
    } else rondas.push({ tipo: 'probable', texto: q.texto, tiempo: 20, propia: !!q.propia });
  }
  return { titulo: pack.titulo, rondas };
}

// Limpia lo que devuelve la IA para las preguntas personalizadas
export function limpiarExtra(j) {
  const trivial = (Array.isArray(j && j.trivial) ? j.trivial : []).slice(0, 6).map(q => {
    const opciones = (Array.isArray(q.opciones) ? q.opciones : []).slice(0, 4).map(o => String(o || '').trim().slice(0, 80));
    const correcta = parseInt(q.correcta, 10);
    return { texto: String(q.texto || '').trim().slice(0, 200), opciones, correcta };
  }).filter(q => q.texto && q.opciones.length === 4 && q.opciones.every(Boolean) && q.correcta >= 0 && q.correcta < 4);
  const probable = (Array.isArray(j && j.probable) ? j.probable : []).slice(0, 6)
    .map(t => String(t || '').trim().slice(0, 140)).filter(Boolean)
    .map(t => t.startsWith('…') ? t : '…' + t.replace(/^\.\.\./, '').replace(/^¿?quién es más probable\s*/i, '').trim())
    .map(t => t.endsWith('?') ? t : t + '?');
  return { trivial, probable };
}
