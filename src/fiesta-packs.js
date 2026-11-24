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
    ]
  }
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
  const nTriv = Math.ceil(n / 2), nProb = n - nTriv;
  const t = barajar(triv.slice(0, nTriv)), p = barajar(prob.slice(0, nProb));
  const rondas = [];
  for (let i = 0; i < n; i++) {
    const q = i % 2 === 0 ? (t.shift() || p.shift()) : (p.shift() || t.shift());
    if (!q) break;
    if (q.opciones) {
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
