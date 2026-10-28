/**
 * Catálogo de misiones.
 *
 * Cada misión tiene tantas preguntas como estrellas: cada respuesta correcta
 * vale una estrella. Los datos se generan a partir del correo del alumno, así
 * que cada alumno tiene sus propios números (y siempre los mismos).
 * Las soluciones se calculan aquí, en el servidor: el cliente nunca las recibe
 * hasta después de entregar.
 */

const G = 6.67e-11;
const TIERRA = { nombre: 'Tierra', M: 5.97e24, R: 6.37e6 };
const MARTE = { nombre: 'Marte', M: 6.42e23, R: 3.39e6, g0: 3.71, dia: 88620 };
const M_SOL = 1.99e30;
const UA = 1.496e11;
const DIA_SIDEREO = 86164;

// Rangos de la tripulación según las estrellas totales (el de 7 ★ coincide con el objetivo)
const RANGOS_ESTRELLAS = [
  { min: 0, n: 'Cadete' }, { min: 1, n: 'Piloto en prácticas' }, { min: 3, n: 'Piloto' }, { min: 5, n: 'Navegante' },
  { min: 7, n: 'Comandante' }, { min: 10, n: 'Capitán' }, { min: 14, n: 'Almirante' }, { min: 18, n: 'Leyenda estelar' }
];
function nombreRango_(estrellas) {
  let n = RANGOS_ESTRELLAS[0].n;
  RANGOS_ESTRELLAS.forEach(r => { if (estrellas >= r.min) n = r.n; });
  return n;
}

const BLOQUES = [
  { id: 'orb', nombre: 'Órbitas', color: '#4cc9f0' },
  { id: 'ene', nombre: 'Energía', color: '#f9c74f' },
  { id: 'esc', nombre: 'Escape', color: '#f3722c' },
  { id: 'geo', nombre: 'Geoestacionaria', color: '#90be6d' },
  { id: 'kep', nombre: 'Kepler', color: '#b388eb' },
  { id: 'mit', nombre: 'Conceptos', color: '#f72585' }
];

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function rngDesde_(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function entero_(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function entre_(rng, a, b) { return a + rng() * (b - a); }
function elegir_(rng, lista) { return lista[Math.floor(rng() * lista.length)]; }
function barajar_(rng, lista) {
  const l = lista.slice();
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = l[i]; l[i] = l[j]; l[j] = t;
  }
  return l;
}
function sig_(x, d) { return Number(x.toPrecision(d || 3)); }

/** Número en LaTeX con coma decimal y notación científica si hace falta. */
function tex_(x, d) {
  d = d || 3;
  if (x === 0) return '0';
  const neg = x < 0;
  const a = Math.abs(x);
  let e = Math.floor(Math.log10(a));
  let m = Number((a / Math.pow(10, e)).toFixed(d - 1));
  if (m >= 10) { m = m / 10; e += 1; }
  let s;
  if (e >= -2 && e <= 4) {
    s = String(Number(a.toPrecision(d))).replace('.', '{,}');
  } else {
    s = m.toFixed(d - 1).replace(/\.?0+$/, '').replace('.', '{,}') + '\\cdot 10^{' + e + '}';
  }
  return (neg ? '-' : '') + s;
}

function formatoKm_(km) { return String(km).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }

function dato_(nombre, simbolo, valor, unidad) {
  return { nombre: nombre, tex: simbolo + ' = ' + valor + (unidad ? '\\ ' + unidad : '') };
}
const U = {
  m: '\\text{m}', km: '\\text{km}', kg: '\\text{kg}', s: '\\text{s}', ms: '\\text{m/s}',
  J: '\\text{J}', g: '\\text{m/s}^2', G: '\\text{N}\\cdot\\text{m}^2/\\text{kg}^2'
};
const D_G = dato_('Constante de gravitación', 'G', tex_(G), U.G);
const D_MT = dato_('Masa de la Tierra', 'M_T', tex_(TIERRA.M), U.kg);
const D_RT = dato_('Radio de la Tierra', 'R_T', tex_(TIERRA.R), U.m);

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

// Banco completo de misiones. Solo las de MISIONES_ACTIVAS aparecen en la actividad;
// el resto se conserva para reutilizarlas al rediseñar.
const BANCO_MISIONES = [

  /* ---------------------------- ÓRBITAS ---------------------------- */
  {
    // Misión rediseñada: una sola pregunta (velocidad de inserción) y consola de acoplamiento
    id: 'O1', bloque: 'orb', estrellas: 1, icono: '🛰️', titulo: 'Bautismo orbital',
    tipo: 'acoplamiento', escala: true,
    objetivo: 'Calcular la velocidad de inserción para volar junto a la estación y acoplarte.',
    resumen: 'Acopla tu nave de carga a una estación espacial insertándote en su órbita a la velocidad exacta.',
    lore: [
      'Una estación orbita un gigante gaseoso rojizo, azotado por tormentas colosales, y necesita suministros. Tu nave de carga es la encargada de llevarlos.',
      'Para acoplarte tienes que entrar en su órbita a la velocidad exacta. Si fallas, pasarás de largo.'
    ],
    gen(rng) {
      const planeta = elegir_(rng, ['Bermeja', 'Cárdena', 'Rubrum', 'Ferrox', 'Escarlata Prime', 'Magma-9']);
      const estacion = 'Estación ' + elegir_(rng, ['Tsiolkovski', 'Gagarin', 'Tereshkova', 'Ochoa', 'Duque', 'Ride']);
      const nave = 'Carguero ' + elegir_(rng, ['Hermes', 'Iris', 'Pegaso', 'Mercurio', 'Orión']) + '-' + entero_(rng, 2, 9);
      // gigante gaseoso ficticio: radio y masa redondeados a 3 cifras (son datos)
      const R = sig_(entre_(rng, 2.2e7, 5.5e7), 3);
      const M = sig_(entre_(rng, 12, 26) * R * R / G, 3);     // gravedad en las nubes entre 12 y 26 m/s²
      // altura entre el 25 % y el 60 % del radio: así olvidar pasar los km a m falla de verdad
      const h = Math.round(entre_(rng, 0.25, 0.6) * R / 1e5) * 100;   // km, múltiplo de 100
      const mNave = entero_(rng, 8, 15) * 1000;                // kg: dato de distracción
      const r = R + h * 1e3;
      const GM = G * M;
      const v = Math.sqrt(GM / r);
      return {
        historia: `Tu nave, el ${nave} (${mNave} kg), debe acoplarse a la ${estacion}, que describe una órbita circular a ${formatoKm_(h)} km sobre las nubes de ${planeta}. Calcula la velocidad con la que hay que insertar la nave en esa órbita para volar junto a la estación.`,
        datos: [D_G, dato_('Masa del planeta', 'M', tex_(M), U.kg), dato_('Radio del planeta', 'R', tex_(R), U.m),
          dato_('Altura de la estación', 'h', h, U.km), dato_('Masa de la nave', 'm', mNave, U.kg)],
        escena: { planeta: planeta, estacion: estacion, nave: nave, h: h, mNave: mNave, R: R, M: M, G: G },
        preguntas: [{ texto: 'Velocidad de inserción en la órbita de la estación', unidad: 'm/s', sol: v }],
        errores: [
          { valor: Math.sqrt(GM / (h * 1e3)), pista: 'Parece que has usado la altura en lugar del radio de la órbita. El radio se mide desde el centro del planeta: r = R + h.' },
          { valor: Math.sqrt(GM / (R + h)), pista: 'Tu resultado equivale a orbitar a ras de las nubes: seguramente has sumado la altura en km al radio en m. Pasa primero la altura a metros: r = R + h.' },
          { valor: GM / r, pista: 'Te falta la raíz cuadrada: de GMm/r² = mv²/r sale v² = GM/r, así que v = √(GM/r).' },
          { valor: Math.sqrt(2 * GM / r), pista: 'Has calculado la velocidad de escape a esa altura (√(2GM/r)). Para mantenerse en órbita circular basta con √(GM/r).' }
        ],
        pasos: [
          String.raw`Radio de la órbita: \(r = R + h = ${tex_(R)} + ${tex_(h * 1e3)} = ${tex_(r)}\ \text{m}\)`,
          String.raw`La gravedad hace de fuerza centrípeta: \(\dfrac{G M m}{r^2} = \dfrac{m v^2}{r} \;\Rightarrow\; v = \sqrt{\dfrac{G M}{r}}\)`,
          String.raw`\(v = \sqrt{\dfrac{${tex_(G)} \cdot ${tex_(M)}}{${tex_(r)}}} = ${tex_(v)}\ \text{m/s}\)`,
          'La masa de la nave se simplifica: cualquier nave, sea cual sea su masa, necesita la misma velocidad para orbitar a esa altura.'
        ]
      };
    }
  },
  {
    id: 'O1a', bloque: 'orb', estrellas: 1, icono: '🛰️', titulo: 'Bautismo orbital',
    resumen: 'Calcula la velocidad de una estación espacial en órbita baja.',
    gen(rng) {
      const hkm = entero_(rng, 350, 450);
      const r = TIERRA.R + hkm * 1e3;
      const v = Math.sqrt(G * TIERRA.M / r);
      return {
        historia: `Una estación espacial orbita la Tierra describiendo una órbita circular a ${hkm} km de altura. Control de Misión necesita conocer su velocidad para preparar el acoplamiento de una nave de carga.`,
        datos: [D_G, D_MT, D_RT, dato_('Altura de la órbita', 'h', hkm, U.km)],
        preguntas: [{ texto: 'Velocidad orbital de la estación', unidad: 'm/s', sol: v }],
        sim: { tipo: 'orbita', cuerpo: 'tierra', R: TIERRA.R, GM: G * TIERRA.M, orbitas: [{ r: r, etiqueta: 'h = ' + hkm + ' km' }] },
        pasos: [
          String.raw`Radio de la órbita: \(r = R_T + h = ${tex_(TIERRA.R)} + ${tex_(hkm * 1e3)} = ${tex_(r)}\ \text{m}\)`,
          String.raw`La fuerza gravitatoria hace de fuerza centrípeta: \(\dfrac{G M_T m}{r^2} = \dfrac{m v^2}{r} \;\Rightarrow\; v = \sqrt{\dfrac{G M_T}{r}}\)`,
          String.raw`\(v = \sqrt{\dfrac{${tex_(G)} \cdot ${tex_(TIERRA.M)}}{${tex_(r)}}} = ${tex_(v)}\ \text{m/s}\)`
        ]
      };
    }
  },
  {
    id: 'O2', bloque: 'orb', estrellas: 2, icono: '🌦️', titulo: 'Satélite meteorológico',
    resumen: 'A partir del periodo de un satélite polar, averigua a qué altura vuela.',
    gen(rng) {
      const tmin = entero_(rng, 96, 110);
      const T = tmin * 60;
      const r = Math.cbrt(G * TIERRA.M * T * T / (4 * Math.PI * Math.PI));
      const h = r - TIERRA.R;
      const v = 2 * Math.PI * r / T;
      return {
        historia: `Un satélite meteorológico en órbita polar circular completa una vuelta a la Tierra cada ${tmin} minutos. Para calibrar sus cámaras hay que conocer su altura y su velocidad.`,
        datos: [D_G, D_MT, D_RT, dato_('Periodo orbital', 'T', tmin, '\\text{min}')],
        preguntas: [
          { texto: 'Altura del satélite sobre la superficie terrestre', unidad: 'm', sol: h },
          { texto: 'Velocidad orbital del satélite', unidad: 'm/s', sol: v }
        ],
        sim: { tipo: 'orbita', cuerpo: 'tierra', R: TIERRA.R, GM: G * TIERRA.M, orbitas: [{ r: r, etiqueta: 'T = ' + tmin + ' min' }], polar: true },
        pasos: [
          String.raw`Periodo en segundos: \(T = ${tmin}\cdot 60 = ${T}\ \text{s}\)`,
          String.raw`De \(\dfrac{G M_T}{r^2} = \dfrac{4\pi^2 r}{T^2}\) se obtiene \(r = \sqrt[3]{\dfrac{G M_T T^2}{4\pi^2}} = ${tex_(r)}\ \text{m}\)`,
          String.raw`Altura: \(h = r - R_T = ${tex_(r)} - ${tex_(TIERRA.R)} = ${tex_(h)}\ \text{m}\)`,
          String.raw`Velocidad: \(v = \dfrac{2\pi r}{T} = ${tex_(v)}\ \text{m/s}\)`
        ]
      };
    }
  },
  {
    // Misión rediseñada: caída libre desde gran altura sobre Marte. La velocidad de impacto se lee
    // en la telemetría de la caja negra y la altura sale de la conservación de la energía con Ep = −GMm/r.
    id: 'O3', bloque: 'ene', estrellas: 3, icono: '📼', titulo: 'Caja negra',
    tipo: 'cajanegra', escala: true,
    objetivo: 'Averiguar a qué altura fallaron los motores a partir de la telemetría de la caja negra.',
    resumen: 'Una nave cae sobre Marte desde una altura desconocida. La caja negra guarda la clave.',
    lore: [
      'La nave Ares se estrelló en Marte tras un fallo de motores y la agencia necesita saber qué pasó.',
      'El altímetro se destruyó en el impacto, pero la caja negra guarda la velocidad registrada durante toda la caída.'
    ],
    gen(rng) {
      const g0 = MARTE.g0, R = MARTE.R, GM = g0 * R * R;
      // entre 1300 y 2500 km: así usar mgh da un error de más del 25 %
      const H = entre_(rng, 1300, 2500) * 1e3;
      const r0 = R + H;
      const v = Math.sqrt(2 * GM * (1 / R - 1 / r0));
      // telemetría: caída radial desde el reposo, un registro por segundo con ruido del radar
      const sigma = 1.2, vel = [], frac = [];
      let r = r0, u = 0, paso = 0;
      const dt = 0.01, PASOS_S = 100;                                  // 100 pasos por segundo
      const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
      while (r > R) {
        if (paso % PASOS_S === 0) {
          const s = paso / PASOS_S;
          vel.push(Math.round((u + (s ? sigma * gauss() : 0)) * 10) / 10);
          if (s % 5 === 0) frac.push(Math.round((r - R) / H * 1000) / 1000);   // fracción de altura (sin escala)
        }
        const a = GM / (r * r);
        u += a * dt / 2; r -= u * dt; u += GM / (r * r) * dt / 2;       // leapfrog
        paso++;
      }
      const tImpacto = paso * dt;
      const nave = 'Ares-' + entero_(rng, 2, 9);
      const masa = entero_(rng, 18, 36) * 100;
      const Hkm = H / 1000;
      const conMgh = v * v / (2 * g0) / 1000;
      return {
        historia: `La nave ${nave} (${formatoKm_(masa)} kg) estaba detenida sobre Marte cuando fallaron sus motores y cayó libremente (sin atmósfera). Con la caja negra, calcula a qué altura ocurrió el fallo.`,
        datos: [dato_('Gravedad en la superficie de Marte', 'g_0', tex_(g0), U.g), dato_('Radio de Marte', 'R', tex_(R), U.m)],
        escena: { nave: nave, masa: masa, g0: g0, R: R, vel: vel, frac: frac },
        preguntas: [{ texto: 'Altura a la que fallaron los motores', unidad: 'km', sol: Hkm }],
        errores: [
          { valor: conMgh, pista: 'Has usado mgh = ½mv². A esta altura la gravedad no es constante (disminuye con la distancia), así que hay que usar la energía potencial gravitatoria Ep = −GMm/r.' },
          { valor: r0 / 1000, pista: 'Tu resultado es la distancia al centro de Marte (R + h). La altura se mide desde la superficie: resta el radio de Marte.' },
          { valor: H, pista: 'Parece que has dado la altura en metros: se pide en km.' },
          { valor: (1 / (1 / R - v * v / GM) - R) / 1000, pista: 'Revisa la energía cinética: es ½mv² (te falta el ½).' }
        ],
        extra: { v: v, tImpacto: tImpacto, conMgh: conMgh, GM: GM },
        pasos: [
          String.raw`Como no conocemos la masa de Marte: \(m g_0 = \dfrac{G M m}{R^2} \;\Rightarrow\; G M = g_0 R^2 = ${tex_(g0)}\cdot(${tex_(R)})^2 = ${tex_(GM, 4)}\ \text{m}^3/\text{s}^2\)`,
          String.raw`La caja negra registra la velocidad de impacto: \(v \approx ${tex_(v, 4)}\ \text{m/s}\) (último registro antes de que se corte la señal).`,
          String.raw`Se conserva la energía mecánica (en el punto más alto la nave está en reposo): \(-\dfrac{G M m}{R + h} = \tfrac12 m v^2 - \dfrac{G M m}{R}\)`,
          String.raw`\(\dfrac{1}{R+h} = \dfrac{1}{R} - \dfrac{v^2}{2 G M} \;\Rightarrow\; R + h = ${tex_(r0, 4)}\ \text{m} \;\Rightarrow\; h = ${tex_(H, 4)}\ \text{m} = ${tex_(Hkm, 4)}\ \text{km}\)`,
          `Con mgh = ½mv² saldrían ${formatoKm_(Math.round(conMgh))} km, un ${Math.round((1 - conMgh / Hkm) * 100)} % menos: a esa altura la gravedad es bastante más débil que en la superficie.`
        ]
      };
    }
  },
  {
    id: 'O3a', bloque: 'orb', estrellas: 3, icono: '🔴', titulo: 'Rumbo a Marte',
    resumen: 'Una sonda en órbita marciana: velocidad, periodo y vueltas al día.',
    gen(rng) {
      const hkm = entero_(rng, 250, 600);
      const GM = MARTE.g0 * MARTE.R * MARTE.R;
      const r = MARTE.R + hkm * 1e3;
      const v = Math.sqrt(GM / r);
      const T = 2 * Math.PI * r / v;
      const vueltas = 86400 / T;
      return {
        historia: `La sonda «Ares-${entero_(rng, 2, 9)}» se ha colocado en una órbita circular a ${hkm} km sobre la superficie de Marte. No tenemos la masa de Marte, pero sí su gravedad en superficie y su radio.`,
        datos: [
          dato_('Gravedad en la superficie de Marte', 'g_{0M}', tex_(MARTE.g0), U.g),
          dato_('Radio de Marte', 'R_M', tex_(MARTE.R), U.m),
          dato_('Altura de la órbita', 'h', hkm, U.km)
        ],
        preguntas: [
          { texto: 'Velocidad orbital de la sonda', unidad: 'm/s', sol: v },
          { texto: 'Periodo orbital de la sonda', unidad: 's', sol: T },
          { texto: 'Número de vueltas que da la sonda en un día terrestre (24 h). Puede tener decimales', unidad: 'vueltas', sol: vueltas }
        ],
        sim: { tipo: 'orbita', cuerpo: 'marte', R: MARTE.R, GM: GM, orbitas: [{ r: r, etiqueta: 'h = ' + hkm + ' km' }] },
        pasos: [
          String.raw`En la superficie, \(m g_0 = \dfrac{G M m}{R^2}\Rightarrow G M = g_0 R^2 = ${tex_(MARTE.g0)}\cdot(${tex_(MARTE.R)})^2 = ${tex_(GM)}\ \text{m}^3/\text{s}^2\)`,
          String.raw`\(r = R_M + h = ${tex_(r)}\ \text{m}\); \(\;v = \sqrt{\dfrac{g_0 R^2}{r}} = ${tex_(v)}\ \text{m/s}\)`,
          String.raw`\(T = \dfrac{2\pi r}{v} = ${tex_(T)}\ \text{s}\)`,
          String.raw`Vueltas en 24 h: \(\dfrac{86400}{T} = ${tex_(vueltas)}\)`
        ]
      };
    }
  },

  /* ---------------------------- ENERGÍA ---------------------------- */
  {
    id: 'E1', bloque: 'ene', estrellas: 1, icono: '⚡', titulo: 'Balance energético',
    resumen: 'Energía mecánica de un satélite en órbita circular. ¡Ojo al signo!',
    gen(rng) {
      const m = entero_(rng, 5, 15) * 100;
      const hkm = entero_(rng, 5, 15) * 100;
      const r = TIERRA.R + hkm * 1e3;
      const Em = -G * TIERRA.M * m / (2 * r);
      return {
        historia: `Un satélite de observación de ${m} kg describe una órbita circular a ${hkm} km de altura. El equipo de ingeniería quiere hacer el balance energético de la órbita.`,
        datos: [D_G, D_MT, D_RT, dato_('Masa del satélite', 'm', m, U.kg), dato_('Altura de la órbita', 'h', hkm, U.km)],
        preguntas: [{ texto: 'Energía mecánica del satélite en su órbita', unidad: 'J', sol: Em }],
        sim: { tipo: 'orbita', cuerpo: 'tierra', R: TIERRA.R, GM: G * TIERRA.M, orbitas: [{ r: r, etiqueta: 'h = ' + hkm + ' km' }] },
        pasos: [
          String.raw`\(E_m = E_c + E_p = \tfrac12 m v^2 - \dfrac{G M_T m}{r}\), y en órbita circular \(v^2 = \dfrac{G M_T}{r}\)`,
          String.raw`Por tanto \(E_m = -\dfrac{G M_T m}{2 r}\), con \(r = R_T + h = ${tex_(r)}\ \text{m}\)`,
          String.raw`\(E_m = -\dfrac{${tex_(G)}\cdot ${tex_(TIERRA.M)}\cdot ${m}}{2\cdot ${tex_(r)}} = ${tex_(Em)}\ \text{J}\)`,
          'La energía mecánica es negativa: el satélite está ligado a la Tierra.'
        ]
      };
    }
  },
  {
    // Misión rediseñada: energía mínima para poner un satélite en órbita desde la superficie (W = Em − Ep0),
    // pasada a kWh y a euros. Incógnita: el importe de la «factura».
    id: 'E2', bloque: 'ene', estrellas: 2, icono: '🧾', titulo: 'Factura energética',
    tipo: 'factura', escala: true,
    objetivo: 'Calcular el importe mínimo de la energía necesaria para poner un satélite en órbita.',
    resumen: 'Una empresa cobra la energía de cada lanzamiento al precio de la luz. ¿Cuánto cuesta, como mínimo, poner tu satélite en órbita?',
    lore: [
      'Una empresa de lanzamientos cobra la energía de cada misión al precio de la electricidad.',
      'Antes de firmar el contrato, la agencia quiere saber cuánto costaría como mínimo poner su satélite en órbita.'
    ],
    gen(rng) {
      const m = entero_(rng, 6, 20) * 100;                         // kg
      // entre 1300 y 2500 km: así olvidar la energía potencial (o la cinética) se aleja más de un 25 %
      const hkm = entero_(rng, 26, 50) * 50;
      const precio = entero_(rng, 12, 28) / 100;                   // €/kWh
      const GM = G * TIERRA.M, R = TIERRA.R, r = R + hkm * 1e3;
      const Em = -GM * m / (2 * r), Ep0 = -GM * m / R;
      const W = Em - Ep0;
      const dEp = GM * m * (1 / R - 1 / r), Ec = GM * m / (2 * r);
      const KWH = 3.6e6;
      const euros = W / KWH * precio;
      const aEuros = J => J / KWH * precio;
      return {
        historia: `La agencia va a poner un satélite de ${m} kg en una órbita circular a ${formatoKm_(hkm)} km de altura. La empresa de lanzamientos cobra la energía a ${String(precio).replace('.', ',')} €/kWh. Calcula el importe mínimo de la factura (desprecia el rozamiento y la rotación de la Tierra).`,
        datos: [D_G, D_MT, D_RT, dato_('Masa del satélite', 'm', m, U.kg), dato_('Altura de la órbita', 'h', formatoKm_(hkm), U.km),
          dato_('Precio de la energía', 'p', String(precio).replace('.', '{,}'), '\\text{€/kWh}'), dato_('Equivalencia', '1\\ \\text{kWh}', '3{,}6\\cdot 10^{6}', U.J)],
        escena: { m: m, h: hkm, precio: precio, G: G, M: TIERRA.M, R: R, kwh: KWH },
        preguntas: [{ texto: 'Importe mínimo de la factura', unidad: '€', sol: euros }],
        errores: [
          { valor: aEuros(dEp), pista: 'Solo has tenido en cuenta la energía potencial que gana al subir. En órbita, además, el satélite tiene que moverse a la velocidad orbital: falta su energía cinética.' },
          { valor: aEuros(Ec), pista: 'Solo has tenido en cuenta la energía cinética en órbita (o el valor de su energía mecánica). Falta la energía potencial que gana al subir desde la superficie: W = Em(órbita) − Ep(superficie).' },
          { valor: aEuros(m * (GM / (R * R)) * hkm * 1e3 + Ec), pista: 'Has usado mgh para la energía potencial. A esta altura la gravedad ya es apreciablemente menor que en la superficie: usa Ep = −GMm/r.' },
          { valor: aEuros(GM * m * (1 / R - 1 / (2 * hkm * 1e3))), pista: 'Parece que has usado la altura en lugar del radio de la órbita. El radio se mide desde el centro de la Tierra: r = R + h.' },
          { valor: W * precio, pista: 'Has multiplicado los julios por el precio en €/kWh. Primero pasa la energía a kWh: 1 kWh = 3,6·10⁶ J.' },
          { valor: W / 3600 * precio, pista: 'Al dividir entre 3600 has pasado a Wh, no a kWh. 1 kWh = 3,6·10⁶ J.' }
        ],
        extra: { W: W, dEp: dEp, Ec: Ec, kwh: W / KWH, r: r },
        pasos: [
          String.raw`Radio de la órbita: \(r = R_T + h = ${tex_(r, 4)}\ \text{m}\)`,
          String.raw`En órbita: \(E_m = -\dfrac{G M_T m}{2r} = ${tex_(Em, 4)}\ \text{J}\). En la superficie, en reposo: \(E_{p,0} = -\dfrac{G M_T m}{R_T} = ${tex_(Ep0, 4)}\ \text{J}\)`,
          String.raw`Energía mínima que hay que comunicar: \(W = E_m - E_{p,0} = ${tex_(W, 4)}\ \text{J}\)`,
          String.raw`De ella, \(${tex_(dEp, 3)}\ \text{J}\) se van en subirlo (\(\Delta E_p\)) y \(${tex_(Ec, 3)}\ \text{J}\) en darle la velocidad orbital (\(E_c\)): cuesta más la velocidad.`,
          String.raw`\(W = \dfrac{${tex_(W, 4)}}{3{,}6\cdot 10^{6}} = ${tex_(W / KWH, 4)}\ \text{kWh}\); importe \(= ${tex_(W / KWH, 4)} \cdot ${String(precio).replace('.', '{,}')} = ${tex_(euros, 4)}\ \text{€}\)`
        ]
      };
    }
  },
  {
    id: 'E2a', bloque: 'ene', estrellas: 2, icono: '🧾', titulo: 'Factura energética',
    resumen: '¿Cuánta energía cuesta subir un satélite desde la superficie hasta su órbita?',
    gen(rng) {
      const m = entero_(rng, 4, 12) * 100;
      const hkm = entero_(rng, 20, 40) * 50;
      const r = TIERRA.R + hkm * 1e3;
      const Em = -G * TIERRA.M * m / (2 * r);
      const Ep0 = -G * TIERRA.M * m / TIERRA.R;
      const W = Em - Ep0;
      return {
        historia: `La agencia espacial va a lanzar un satélite de ${m} kg a una órbita circular de ${hkm} km de altura y necesita estimar la energía mínima del lanzamiento (desprecia la rotación terrestre y el rozamiento con el aire).`,
        datos: [D_G, D_MT, D_RT, dato_('Masa del satélite', 'm', m, U.kg), dato_('Altura de la órbita', 'h', hkm, U.km)],
        preguntas: [
          { texto: 'Energía mecánica del satélite en su órbita', unidad: 'J', sol: Em },
          { texto: 'Energía mínima que hay que comunicarle desde la superficie para ponerlo en esa órbita', unidad: 'J', sol: W }
        ],
        sim: { tipo: 'orbita', cuerpo: 'tierra', R: TIERRA.R, GM: G * TIERRA.M, orbitas: [{ r: r, etiqueta: 'h = ' + hkm + ' km' }], lanzamiento: true },
        pasos: [
          String.raw`En órbita: \(E_m = -\dfrac{G M_T m}{2r} = ${tex_(Em)}\ \text{J}\) (con \(r = ${tex_(r)}\ \text{m}\))`,
          String.raw`En la superficie (en reposo): \(E_{m,0} = E_{p,0} = -\dfrac{G M_T m}{R_T} = ${tex_(Ep0)}\ \text{J}\)`,
          String.raw`Energía a comunicar: \(W = E_m - E_{m,0} = ${tex_(Em)} - (${tex_(Ep0)}) = ${tex_(W)}\ \text{J}\)`
        ]
      };
    }
  },
  {
    // Misión rediseñada: una sola pregunta, estrellas según la precisión y consola de vuelo propia
    id: 'E3', bloque: 'ene', estrellas: 2, icono: '⏫', titulo: 'Ascenso orbital',
    tipo: 'ascenso', escala: true,
    objetivo: 'Calcular la energía mínima para subir el satélite a su órbita de trabajo.',
    resumen: 'Sube un satélite de comunicaciones a su órbita de trabajo calculando la energía de la maniobra.',
    lore: [
      'Un satélite de comunicaciones se ha quedado en una órbita baja «de aparcamiento» y hay que subirlo a su órbita de trabajo.',
      'Ojo: la masa del planeta está corrupta. Solo tienes la telemetría del satélite.'
    ],
    gen(rng) {
      const planeta = elegir_(rng, ['Tauro IV', 'Nérida', 'Hespéride', 'Calipso', 'Orión-6', 'Ítaca Prime']);
      const color = elegir_(rng, ['#c77dff', '#4cc9f0', '#90be6d', '#f8961e', '#e76f51', '#4895ef']);
      const satelite = 'COMSAT-' + entero_(rng, 10, 99);
      const R = sig_(entre_(rng, 3.2e6, 7.8e6), 3);
      const GM = entre_(rng, 4.5, 13) * R * R;          // no se da: el alumno debe deducirlo
      const h1 = entero_(rng, 3, 9) * 100;               // km
      const h2 = h1 + entero_(rng, 12, 40) * 100;        // km
      const m = entero_(rng, 4, 15) * 100;               // kg
      const r1 = R + h1 * 1e3, r2 = R + h2 * 1e3;
      const v1 = sig_(Math.sqrt(GM / r1), 3);            // dato (redondeado): la solución sale de él
      const GMc = v1 * v1 * r1;
      const Ec1 = 0.5 * m * v1 * v1;
      const Em1 = -GMc * m / (2 * r1), Em2 = -GMc * m / (2 * r2);
      const dE = Em2 - Em1;
      const v2 = Math.sqrt(GMc / r2);
      return {
        historia: `El satélite ${satelite} (${m} kg) está en una órbita circular baja alrededor de ${planeta}. Calcula la energía mínima que hay que aportarle para pasarlo a su órbita de trabajo, también circular. La masa del planeta no está disponible: usa la telemetría.`,
        datos: [
          dato_('Radio del planeta', 'R', tex_(R), U.m),
          dato_('Masa del satélite', 'm', m, U.kg),
          dato_('Altura de la órbita actual', 'h_1', h1, U.km),
          dato_('Velocidad en la órbita actual', 'v_1', tex_(v1), U.ms),
          dato_('Altura de la órbita de destino', 'h_2', h2, U.km)
        ],
        escena: { planeta: planeta, color: color, satelite: satelite, R: R, m: m, h1: h1, h2: h2, v1: v1 },
        preguntas: [{ texto: 'Energía mínima que hay que aportar al satélite para pasar a la órbita de destino', unidad: 'J', sol: dE }],
        // resultados que delatan un error típico (solo para dar una pista tras entregar)
        errores: [
          { valor: 2 * dE, pista: 'Tu resultado coincide con la variación de energía potencial. Al subir, la energía cinética disminuye justo la mitad de lo que aumenta la potencial, así que la energía que hay que aportar es la mitad: la variación de energía mecánica.' },
          { valor: -dE, pista: 'Tu resultado coincide con la variación de energía cinética, que es negativa porque arriba el satélite va más despacio. Lo que hay que aportar es la variación de energía mecánica (cinética + potencial).' },
          { valor: 0.5 * m * v1 * v1 * (1 - h1 / h2), pista: 'Parece que has usado las alturas en lugar de los radios de las órbitas. El radio se mide desde el centro del planeta: r = R + h.' },
          { valor: Em2, pista: 'Has dado la energía mecánica de la órbita de destino, no la diferencia entre las dos órbitas.' },
          { valor: Em1, pista: 'Has dado la energía mecánica de la órbita inicial, no la diferencia entre las dos órbitas.' },
          { valor: Ec1, pista: 'Has dado la energía cinética en la órbita inicial. Lo que se pide es la variación de energía mecánica entre las dos órbitas.' }
        ],
        extra: { v2: v2, r1: r1, r2: r2 },
        pasos: [
          String.raw`Radios de las órbitas: \(r_1 = R + h_1 = ${tex_(r1)}\ \text{m}\), \(\;r_2 = R + h_2 = ${tex_(r2)}\ \text{m}\)`,
          String.raw`En la órbita baja la gravedad hace de fuerza centrípeta: \(\dfrac{GMm}{r_1^2} = \dfrac{m v_1^2}{r_1}\Rightarrow GM = v_1^2\, r_1 = ${tex_(GMc)}\ \text{m}^3/\text{s}^2\)`,
          String.raw`Energía mecánica en órbita circular: \(E_m = -\dfrac{GMm}{2r}\): \(\;E_{m1} = ${tex_(Em1)}\ \text{J}\), \(\;E_{m2} = ${tex_(Em2)}\ \text{J}\)`,
          String.raw`\(\Delta E = E_{m2} - E_{m1} = \tfrac12 m v_1^2\left(1 - \dfrac{r_1}{r_2}\right) = ${tex_(dE)}\ \text{J}\)`,
          String.raw`Arriba el satélite va más despacio (\(v_2 = ${tex_(v2)}\ \text{m/s}\)): su energía cinética baja, pero la potencial sube el doble, así que la energía mecánica aumenta.`
        ]
      };
    }
  },
  {
    id: 'E3a', bloque: 'ene', estrellas: 3, icono: '⏫', titulo: 'Ascenso orbital',
    resumen: 'Sube un satélite a una órbita más alta y calcula el coste energético.',
    gen(rng) {
      const m = entero_(rng, 3, 10) * 100;
      const h1 = entero_(rng, 3, 8) * 100;
      const h2 = h1 + entero_(rng, 10, 30) * 100;
      const r1 = TIERRA.R + h1 * 1e3, r2 = TIERRA.R + h2 * 1e3;
      const GMm = G * TIERRA.M * m;
      const Ec1 = GMm / (2 * r1);
      const Em1 = -GMm / (2 * r1);
      const Em2 = -GMm / (2 * r2);
      const W = Em2 - Em1;
      return {
        historia: `Un satélite de ${m} kg está en una órbita circular a ${h1} km de altura. Hay que subirlo a otra órbita circular a ${h2} km de altura para alargar su vida útil.`,
        datos: [D_G, D_MT, D_RT, dato_('Masa del satélite', 'm', m, U.kg),
          dato_('Altura inicial', 'h_1', h1, U.km), dato_('Altura final', 'h_2', h2, U.km)],
        preguntas: [
          { texto: 'Energía cinética del satélite en la órbita inicial', unidad: 'J', sol: Ec1 },
          { texto: 'Energía mecánica del satélite en la órbita final', unidad: 'J', sol: Em2 },
          { texto: 'Energía necesaria para pasar de la órbita inicial a la final', unidad: 'J', sol: W }
        ],
        sim: { tipo: 'orbita', cuerpo: 'tierra', R: TIERRA.R, GM: G * TIERRA.M, orbitas: [{ r: r1, etiqueta: 'Órbita 1' }, { r: r2, etiqueta: 'Órbita 2' }] },
        pasos: [
          String.raw`\(r_1 = ${tex_(r1)}\ \text{m}\), \(\;r_2 = ${tex_(r2)}\ \text{m}\)`,
          String.raw`\(E_{c1} = \tfrac12 m v_1^2 = \dfrac{G M_T m}{2 r_1} = ${tex_(Ec1)}\ \text{J}\)`,
          String.raw`\(E_{m2} = -\dfrac{G M_T m}{2 r_2} = ${tex_(Em2)}\ \text{J}\)`,
          String.raw`\(E_{m1} = -\dfrac{G M_T m}{2 r_1} = ${tex_(Em1)}\ \text{J}\;\Rightarrow\; W = E_{m2} - E_{m1} = ${tex_(W)}\ \text{J}\)`,
          'En la órbita más alta el satélite va más despacio, pero tiene más energía mecánica (menos negativa).'
        ]
      };
    }
  },

  /* ---------------------------- ESCAPE ----------------------------- */
  {
    // Misión rediseñada: tres mundos en un catálogo; hay que elegir el de menor velocidad de escape y calcularla
    id: 'X1', bloque: 'esc', estrellas: 1, icono: '🚀', titulo: 'Billete de vuelta',
    tipo: 'despegue', escala: true,
    objetivo: 'Elegir el mundo desde el que es más fácil escapar y calcular su velocidad de escape.',
    resumen: 'Tres mundos donde aterrizar y combustible para un solo despegue: elige bien desde dónde volver.',
    lore: [
      'Tu nave vuelve a casa con la bodega llena de muestras, pero una avería te obliga a aterrizar para repararla.',
      'Hay tres mundos a tu alcance y el combustible solo da para un despegue. Elige aquel del que sea más fácil escapar.'
    ],
    gen(rng) {
      // Densidades realistas: v_e² = (8/3)·π·G·ρ·R², así que v_e = R·√(kρ).
      //  A: mundo helado poco denso → la menor v_e. Nunca es el más pequeño ni el menos masivo.
      //  L: el más pequeño y el más ligero, pero muy denso (rocoso o volcánico) → v_e un 25-32 % mayor.
      //     (que sea más ligero que A y aun así más difícil de abandonar exige ρ_L/ρ_A > q⁶)
      //  H: el más masivo; según el escenario es más grande que A o algo más pequeño pero mucho más denso.
      const k = (8 / 3) * Math.PI * G;
      const rhoA = entre_(rng, 950, 1150), RA = entre_(rng, 1.5e6, 2.8e6);
      const rhoL = entre_(rng, 5000, 5600), d = rhoL / rhoA;
      const q = entre_(rng, 1.25, Math.pow(d, 1 / 6) - 0.02);
      const RL = q * RA / Math.sqrt(d);
      const densos = barajar_(rng, ['rocoso', 'volcanico']);
      let RH, rhoH, estiloH;
      const escenario = rng();
      if (escenario < 0.25) { estiloH = 'helado'; rhoH = entre_(rng, 1300, 1900); RH = RA * entre_(rng, 1.4, 1.7); }
      else if (escenario < 0.5) { estiloH = 'desertico'; rhoH = entre_(rng, 2800, 4000); RH = RA * entre_(rng, 1.1, 1.5); }
      else { estiloH = elegir_(rng, ['desertico', densos[1]]); rhoH = entre_(rng, 4500, 5500); RH = RA * entre_(rng, 0.72, 0.9); }
      const crudos = [[RA, RA * Math.sqrt(k * rhoA)], [RL, RL * Math.sqrt(k * rhoL)], [RH, RH * Math.sqrt(k * rhoH)]];

      const estilos = ['helado', densos[0], estiloH];
      const nombres = barajar_(rng, ['Albor', 'Brumario', 'Cendra', 'Erebo', 'Gélida', 'Hespera', 'Lumen', 'Nadir', 'Pirene', 'Sirte', 'Tule', 'Umbra', 'Zafra']);
      const fichas = {
        helado: { tipo: 'Mundo helado', atm: ['Inexistente', 'Trazas de nitrógeno', 'Muy tenue (metano)'], temp: [-215, -150] },
        rocoso: { tipo: 'Mundo rocoso', atm: ['Inexistente', 'Trazas de argón', 'Muy tenue (CO₂)'], temp: [-130, 30] },
        volcanico: { tipo: 'Mundo volcánico', atm: ['Tenue (dióxido de azufre)', 'Trazas de azufre'], temp: [60, 190] },
        desertico: { tipo: 'Mundo desértico', atm: ['Tenue (CO₂)', 'Muy tenue (nitrógeno)'], temp: [-70, 25] }
      };
      const mundos = crudos.map((c, i) => {
        const f = fichas[estilos[i]];
        const D = Math.round(2 * c[0] / 1e4) * 10;                     // diámetro en km, múltiplo de 10
        const M = sig_(c[1] * c[1] * c[0] / (2 * G), 3);
        return {
          nombre: nombres[i], estilo: estilos[i], tipo: f.tipo, D: D, M: M,
          temp: entero_(rng, f.temp[0], f.temp[1]), rot: sig_(entre_(rng, 9, 160), 3),
          lunas: entero_(rng, 0, 3), atm: elegir_(rng, f.atm)
        };
      });
      const ve = w => Math.sqrt(2 * G * w.M / (w.D * 500));            // R = D/2 en metros
      const orden = barajar_(rng, [0, 1, 2]);                          // orden en el catálogo
      const lista = orden.map(i => mundos[i]);
      const correcta = orden.indexOf(0);
      const A = mundos[0], RAm = A.D * 500, vSol = ve(A);
      const GM = G * A.M;
      const nave = elegir_(rng, ['Odisea', 'Tenaz', 'Vagabunda', 'Halcón Gris', 'Errante']) + '-' + entero_(rng, 2, 9);
      const mVacia = entero_(rng, 9, 16) * 1000, mCarga = entero_(rng, 12, 40) * 100;

      return {
        historia: `Una avería obliga a tu nave, la ${nave}, a aterrizar en uno de los tres mundos del catálogo, y solo queda combustible para un despegue. Elige el mundo con menor velocidad de escape y calcúlala.`,
        datos: [D_G].concat(lista.map(w => dato_('Mundo ' + w.nombre, 'M,\\ D', tex_(w.M) + '\\ \\text{kg},\\ ' + w.D, U.km))),
        escena: { nave: nave, mVacia: mVacia, mCarga: mCarga, G: G, mundos: lista },
        eleccion: {
          correcta: correcta,
          nombres: lista.map(w => w.nombre),
          ves: lista.map(ve)
        },
        preguntas: [{ texto: 'Velocidad de escape desde la superficie del mundo elegido', unidad: 'm/s', sol: vSol }],
        errores: [
          // √(GM/R) coincide con √(2GM/D): o falta el 2, o se ha usado el diámetro como radio
          { valor: Math.sqrt(GM / RAm), pista: 'Tu resultado es √(GM/R): o te ha faltado el 2 (eso es la velocidad orbital a ras del suelo), o has usado el diámetro como si fuera el radio. Recuerda: v_e = √(2GM/R) y R = D/2.' },
          { valor: Math.sqrt(2 * GM / (RAm / 1000)), pista: 'Parece que no has pasado el radio de km a m antes de sustituir.' },
          { valor: Math.sqrt(2 * GM / (2 * RAm / 1000)), pista: 'Parece que has usado el diámetro en km como si fuera el radio en m. Primero R = D/2 y después, a metros.' },
          { valor: 2 * GM / RAm, pista: 'Te falta la raíz cuadrada: de ½mv² = GMm/R sale v² = 2GM/R.' }
        ],
        extra: { ves: lista.map(ve), correcta: correcta, nombres: lista.map(w => w.nombre) },
        pasos: [
          String.raw`Para escapar, la energía mecánica tiene que llegar a 0: \(\tfrac12 m v_e^2 - \dfrac{G M m}{R} = 0 \;\Rightarrow\; v_e = \sqrt{\dfrac{2 G M}{R}}\)`,
          String.raw`Solo depende del cociente \(M/R\): no gana el mundo más pequeño ni el menos masivo, sino el de menor \(M/R\).`,
          ...lista.map(w => String.raw`${w.nombre}: \(R = \tfrac{D}{2} = ${tex_(w.D * 500, 4)}\ \text{m},\quad v_e = \sqrt{\dfrac{2\cdot ${tex_(G)}\cdot ${tex_(w.M)}}{${tex_(w.D * 500, 4)}}} = ${tex_(ve(w), 4)}\ \text{m/s}\)`),
          `El mundo más fácil de abandonar es ${A.nombre}, con ${formatoKm_(Math.round(vSol))} m/s.`,
          'La masa de la nave (y la de las muestras) se simplifica: con la bodega llena o vacía, la velocidad de escape es la misma.'
        ]
      };
    }
  },
  {
    id: 'X1a', bloque: 'esc', estrellas: 1, icono: '🚀', titulo: 'Billete de vuelta',
    resumen: 'Velocidad de escape desde la superficie de otro mundo.',
    gen(rng) {
      const cuerpo = elegir_(rng, [
        { nombre: 'la Luna', id: 'luna', M: 7.35e22, R: 1.74e6 },
        { nombre: 'Mercurio', id: 'mercurio', M: 3.30e23, R: 2.44e6 },
        { nombre: 'Marte', id: 'marte', M: 6.42e23, R: 3.39e6 },
        { nombre: 'Calisto (luna de Júpiter)', id: 'calisto', M: 1.08e23, R: 2.41e6 },
        { nombre: 'Titán (luna de Saturno)', id: 'titan', M: 1.35e23, R: 2.57e6 },
        { nombre: 'el planeta enano Ceres', id: 'ceres', M: 9.38e20, R: 4.73e5 }
      ]);
      const ve = Math.sqrt(2 * G * cuerpo.M / cuerpo.R);
      return {
        historia: `Una expedición científica en la superficie de ${cuerpo.nombre} ha terminado su trabajo y debe volver a casa. ¿Qué velocidad mínima debe alcanzar su nave para escapar de la atracción gravitatoria? (desprecia cualquier atmósfera)`,
        datos: [D_G, dato_('Masa del astro', 'M', tex_(cuerpo.M), U.kg), dato_('Radio del astro', 'R', tex_(cuerpo.R), U.m)],
        preguntas: [{ texto: 'Velocidad de escape desde la superficie', unidad: 'm/s', sol: ve }],
        sim: { tipo: 'escape', cuerpo: cuerpo.id, nombre: cuerpo.nombre },
        pasos: [
          String.raw`Para escapar, la energía mecánica debe ser al menos 0 (llegar al infinito con velocidad nula): \(\tfrac12 m v_e^2 - \dfrac{G M m}{R} = 0\)`,
          String.raw`\(v_e = \sqrt{\dfrac{2 G M}{R}} = \sqrt{\dfrac{2\cdot ${tex_(G)}\cdot ${tex_(cuerpo.M)}}{${tex_(cuerpo.R)}}} = ${tex_(ve)}\ \text{m/s}\)`,
          'No depende de la masa de la nave ni de la dirección del lanzamiento.'
        ]
      };
    }
  },
  {
    // Misión rediseñada: tres satélites en órbita alrededor de un planeta ficticio; uno lleva una velocidad
    // que no corresponde a su altura. Hay que encontrarlo y calcular la corrección Δv (con signo).
    id: 'X2', bloque: 'orb', estrellas: 2, icono: '🎯', titulo: 'Tráfico orbital',
    tipo: 'trafico', escala: true,
    objetivo: 'Encontrar el satélite que no está en órbita circular y calcular la corrección de velocidad que necesita.',
    resumen: 'Uno de los tres satélites de la constelación lleva una velocidad que no le corresponde. Encuéntralo y corrígelo.',
    lore: [
      'El centro de control vigila tres satélites de una constelación, cada uno en su órbita circular.',
      'El radar ha detectado que uno de ellos lleva una velocidad que no corresponde a su altura. Hay que encontrarlo y corregirlo antes de que se desvíe.'
    ],
    gen(rng) {
      const planeta = elegir_(rng, ['Ítaca', 'Brisa', 'Océanos de Tara', 'Marea Azul', 'Eolia', 'Nova Lusa']);
      const R = sig_(entre_(rng, 4.5e6, 8e6), 3);
      const M = sig_(entre_(rng, 7, 13) * R * R / G, 3);
      const GM = G * M;
      // tres alturas bien separadas, en orden aleatorio
      const alturas = barajar_(rng, [entero_(rng, 8, 30) * 50, entero_(rng, 50, 100) * 50, entero_(rng, 140, 280) * 50]);
      const nombres = barajar_(rng, ['TX-14', 'Atlas-3', 'Nodo-7', 'Faro-22', 'Vega-9', 'Iris-5']).slice(0, 3);
      const anom = entero_(rng, 0, 2);
      const rapido = rng() < 0.5;                                    // el anómalo va demasiado rápido o demasiado lento
      const desvio = entre_(rng, 0.04, 0.09);
      const sats = alturas.map((hkm, i) => {
        const vo = Math.sqrt(GM / (R + hkm * 1e3));
        // los correctos, con el pequeño error del radar (±0,15 %); el anómalo, un 4–9 % por encima o por debajo
        const factor = i === anom ? (rapido ? 1 + desvio : 1 - desvio) : 1 + entre_(rng, -0.0015, 0.0015);
        return { nombre: nombres[i], h: hkm, v: Math.round(vo * factor), masa: entero_(rng, 3, 30) * 100, vo: vo };
      });
      const dv = sats.map(x => x.vo - x.v);                         // corrección de cada uno
      const A = sats[anom], rA = R + A.h * 1e3;
      return {
        historia: `Uno de los tres satélites que orbitan ${planeta} lleva una velocidad que no corresponde a su órbita circular. Márcalo y calcula la corrección de velocidad que necesita.`,
        datos: [D_G, dato_('Masa del planeta', 'M', tex_(M), U.kg), dato_('Radio del planeta', 'R', tex_(R), U.m)],
        escena: { planeta: planeta, G: G, M: M, R: R, sats: sats.map(x => ({ nombre: x.nombre, h: x.h, v: x.v, masa: x.masa })) },
        eleccion: {
          correcta: anom,
          nombres: nombres,
          ves: dv,
          textos: {
            sin: 'No marcaste ningún satélite como anómalo.',
            bien: 'Tu corrección para {elegido} es correcta, pero ese satélite ya estaba en su órbita: el anómalo es {correcto}. Compara la velocidad medida de cada uno con su velocidad orbital.',
            mal: '{elegido} no es el satélite anómalo: lo es {correcto}. Compara la velocidad medida de cada uno con su velocidad orbital.'
          }
        },
        preguntas: [{ texto: 'Corrección de velocidad del satélite anómalo', unidad: 'm/s', sol: dv[anom] }],
        errores: [
          { valor: -dv[anom], pista: rapido ? 'Has invertido el signo: el satélite va demasiado rápido, así que hay que frenarlo (Δv negativo).' : 'Has invertido el signo: el satélite va demasiado lento, así que hay que acelerarlo (Δv positivo).' },
          { valor: Math.sqrt(GM / R) - A.v, pista: 'Has calculado la velocidad orbital con el radio del planeta (o sumando km con m). El radio de la órbita es r = R + h, con h en metros.' },
          { valor: Math.sqrt(GM / (A.h * 1e3)) - A.v, pista: 'Has usado la altura en lugar del radio de la órbita: r = R + h.' },
          { valor: A.vo, pista: 'Has dado la velocidad orbital que debería llevar, pero se pide la corrección: Δv = v(orbital) − v(medida).' }
        ],
        extra: { anom: anom, rapido: rapido, vo: sats.map(x => x.vo), GM: GM },
        pasos: [
          String.raw`Para una órbita circular, la gravedad es la fuerza centrípeta: \(v_{orb} = \sqrt{\dfrac{G M}{R + h}}\). No depende de la masa del satélite.`,
          ...sats.map(x => String.raw`${x.nombre}: \(v_{orb} = ${tex_(x.vo, 4)}\ \text{m/s}\), medida \(${tex_(x.v, 4)}\ \text{m/s}\) → ${Math.abs(x.v / x.vo - 1) < 0.01 ? 'coincide' : '<b>no coincide</b>'}`),
          String.raw`Corrección de ${A.nombre}: \(\Delta v = v_{orb} - v_{medida} = ${tex_(A.vo, 4)} - ${tex_(A.v, 4)} = ${tex_(dv[anom], 3)}\ \text{m/s}\) (${rapido ? 'hay que frenarlo' : 'hay que acelerarlo'}).`
        ]
      };
    }
  },
  {
    id: 'X2a', bloque: 'esc', estrellas: 2, icono: '🎯', titulo: '¿Órbita o fuga?',
    resumen: 'Predice si una sonda lanzada a cierta velocidad se queda o se escapa.',
    gen(rng) {
      const hkm = entero_(rng, 10, 40) * 100;
      const r = TIERRA.R + hkm * 1e3;
      const vo = Math.sqrt(G * TIERRA.M / r);
      const ve = Math.SQRT2 * vo;
      const f = elegir_(rng, [1.15, 1.2, 1.25, 1.3, 1.52, 1.56, 1.6, 1.65]);
      const v0 = sig_(f * vo, 3);
      const escapa = v0 >= ve;
      const textos = [
        'Describe una órbita cerrada (elíptica) alrededor de la Tierra',
        'Sigue una trayectoria abierta: escapa de la atracción terrestre',
        'Describe una órbita circular a esa altura',
        'Cae en línea recta hacia la Tierra'
      ];
      const orden = barajar_(rng, [0, 1, 2, 3]);
      const correcta = escapa ? 1 : 0;
      return {
        historia: `Desde una plataforma a ${hkm} km de altura se lanza una sonda en dirección perpendicular al radio terrestre (horizontal) con una velocidad de ${tex_(v0).replace('{,}', ',')} m/s. Desprecia el rozamiento.`,
        datos: [D_G, D_MT, D_RT, dato_('Altura del lanzamiento', 'h', hkm, U.km), dato_('Velocidad de lanzamiento', 'v_0', tex_(v0), U.ms)],
        preguntas: [
          { texto: 'Velocidad de escape a esa altura', unidad: 'm/s', sol: ve },
          { texto: '¿Qué trayectoria seguirá la sonda?', tipo: 'opcion', opciones: orden.map(i => textos[i]), sol: orden.indexOf(correcta) }
        ],
        sim: { tipo: 'lanzamiento', R: TIERRA.R, GM: G * TIERRA.M, r0: r, v0: v0 },
        pasos: [
          String.raw`\(r = R_T + h = ${tex_(r)}\ \text{m}\); \(\;v_e = \sqrt{\dfrac{2 G M_T}{r}} = ${tex_(ve)}\ \text{m/s}\)`,
          String.raw`Velocidad orbital a esa altura: \(v_{orb} = \sqrt{\dfrac{G M_T}{r}} = ${tex_(vo)}\ \text{m/s}\) \(\;(v_e = \sqrt2\, v_{orb})\)`,
          escapa
            ? String.raw`\(v_0 = ${tex_(v0)}\ \text{m/s} \ge v_e\): la energía mecánica es positiva y la sonda escapa (trayectoria hiperbólica).`
            : String.raw`\(v_{orb} < v_0 = ${tex_(v0)}\ \text{m/s} < v_e\): la energía mecánica es negativa, la sonda queda ligada en una órbita elíptica.`
        ]
      };
    }
  },
  {
    id: 'X3', bloque: 'esc', estrellas: 3, icono: '🌌', titulo: 'Escapar desde órbita',
    resumen: 'Un satélite en órbita quiere abandonar la Tierra para siempre.',
    gen(rng) {
      const m = entero_(rng, 2, 10) * 100;
      const hkm = entero_(rng, 3, 20) * 100;
      const r = TIERRA.R + hkm * 1e3;
      const vo = Math.sqrt(G * TIERRA.M / r);
      const ve = Math.sqrt(2 * G * TIERRA.M / r);
      const W = G * TIERRA.M * m / (2 * r);
      return {
        historia: `Una sonda de ${m} kg está aparcada en una órbita circular a ${hkm} km de altura. Desde ahí encenderá sus motores para abandonar la Tierra rumbo al espacio profundo.`,
        datos: [D_G, D_MT, D_RT, dato_('Masa de la sonda', 'm', m, U.kg), dato_('Altura de la órbita', 'h', hkm, U.km)],
        preguntas: [
          { texto: 'Velocidad orbital de la sonda', unidad: 'm/s', sol: vo },
          { texto: 'Velocidad de escape a esa altura', unidad: 'm/s', sol: ve },
          { texto: 'Energía mínima adicional que hay que comunicarle para que escape desde su órbita', unidad: 'J', sol: W }
        ],
        sim: { tipo: 'orbita', cuerpo: 'tierra', R: TIERRA.R, GM: G * TIERRA.M, orbitas: [{ r: r, etiqueta: 'h = ' + hkm + ' km' }], escape: true },
        pasos: [
          String.raw`\(r = ${tex_(r)}\ \text{m}\); \(\;v_{orb} = \sqrt{\dfrac{G M_T}{r}} = ${tex_(vo)}\ \text{m/s}\)`,
          String.raw`\(v_e = \sqrt{\dfrac{2 G M_T}{r}} = ${tex_(ve)}\ \text{m/s}\)`,
          String.raw`En órbita \(E_m = -\dfrac{G M_T m}{2r}\); para escapar debe llegar a \(E_m = 0\): \(\;W = \dfrac{G M_T m}{2r} = ${tex_(W)}\ \text{J}\)`
        ]
      };
    }
  },

  /* ------------------------ GEOESTACIONARIA ------------------------ */
  {
    // Misión rediseñada: el periodo de rotación de un planeta ficticio se mide en la cámara orbital
    // (vista desde el polo); con M y R se calcula la altura de la órbita estacionaria.
    id: 'G1', bloque: 'geo', estrellas: 3, icono: '📡', titulo: 'Vigilante fijo',
    tipo: 'estacionaria', escala: true,
    objetivo: 'Medir la rotación de un planeta y calcular la altura de su órbita estacionaria.',
    resumen: 'Coloca un satélite que esté siempre sobre la misma colonia de un planeta lejano.',
    lore: [
      'Una colonia en el ecuador de un planeta lejano necesita un satélite de comunicaciones que esté siempre sobre ella.',
      'Nadie ha medido todavía cuánto tarda el planeta en girar: tendrás que averiguarlo con la cámara orbital.'
    ],
    gen(rng) {
      const planeta = elegir_(rng, ['Nereida', 'Tálasa', 'Orfeo', 'Véspera', 'Calíope', 'Aurelia']);
      const colonia = elegir_(rng, ['Nueva Esperanza', 'Puerto Alba', 'Base Horizonte', 'Ciudad Faro', 'Estación Cumbre']);
      const R = sig_(entre_(rng, 4e6, 9e6), 3);
      const M = sig_(entre_(rng, 6, 14) * R * R / G, 3);           // gravedad en superficie entre 6 y 14 m/s²
      const GM = G * M;
      // planeta de rotación rápida: la órbita estacionaria queda a 1,5–3 radios del centro,
      // así que dar r en lugar de h siempre se aleja más de un 50 %
      const r = entre_(rng, 1.5, 3) * R;
      const T = 2 * Math.PI * Math.sqrt(r * r * r / GM), Th = T / 3600;
      const h = r - R, hkm = h / 1000;
      // cámara orbital: 48 h, una imagen cada 2 minutos; ángulo de la colonia en décimas de grado
      const HORAS = 48, PASO_MIN = 2;
      const a0 = entre_(rng, 0, 360);
      const angulos = [];
      for (let k = 0; k * PASO_MIN <= HORAS * 60; k++) {
        const t = k * PASO_MIN / 60;
        angulos.push(Math.round(((a0 + 360 * t / Th) % 360) * 10));
      }
      const alturaCon = Tx => (Math.cbrt(GM * Tx * Tx / (4 * Math.PI * Math.PI)) - R) / 1000;
      return {
        historia: `La colonia ${colonia}, en el ecuador de ${planeta}, necesita un satélite siempre en su vertical. Mide con la cámara cuánto tarda el planeta en girar y su tamaño, y calcula a qué altura colocarlo.`,
        datos: [D_G, dato_('Masa del planeta', 'M', tex_(M), U.kg)],
        // el radio no se envía: la cámara solo da la longitud del arco entre dos marcas (km por grado de giro)
        escena: { planeta: planeta, colonia: colonia, G: G, M: M, kmPorGrado: R * Math.PI / 180 / 1000, pasoMin: PASO_MIN, angulos: angulos },
        preguntas: [{ texto: 'Altura de la órbita estacionaria', unidad: 'km', sol: hkm }],
        errores: [
          // r y «R calculado con θ en grados» dan casi lo mismo: un solo diagnóstico para ambos
          { valor: r / 1000, pista: 'Tu resultado es prácticamente el radio de la órbita, medido desde el centro del planeta. O no has restado el radio del planeta (h = r − R), o te ha salido un radio diminuto: en s = R·θ el ángulo va en radianes, no en grados.' },
          { valor: alturaCon(Th), pista: 'Parece que has usado el periodo en horas. Pásalo a segundos antes de sustituir.' },
          { valor: (Math.sqrt(GM * T * T / (4 * Math.PI * Math.PI)) - R) / 1000, pista: 'Revisa la raíz: de GMm/r² = m·4π²r/T² sale r³ = GMT²/(4π²), así que es una raíz cúbica.' },
          { valor: alturaCon(T / 2), pista: 'Parece que has medido media vuelta del planeta en lugar de una vuelta completa.' },
          { valor: alturaCon(2 * T), pista: 'Parece que has medido dos vueltas del planeta como si fueran una.' },
          { valor: h, pista: 'Parece que has dado la altura en metros: se pide en km.' },
          { valor: (Math.cbrt(GM * T * T) - R) / 1000, pista: 'Te falta el factor 4π²: la velocidad orbital es v = 2πr/T.' }
        ],
        extra: { Th: Th, r: r, GM: GM, R: R },
        pasos: [
          String.raw`Para estar siempre sobre la colonia, el satélite debe girar en el plano del ecuador, en el mismo sentido que el planeta y con su mismo periodo: \(T = ${tex_(Th, 4)}\ \text{h} = ${tex_(T, 4)}\ \text{s}\). Medir varias vueltas y dividir reduce el error.`,
          String.raw`Radio: entre las marcas A y B el planeta gira \(\theta = 360^\circ \cdot \dfrac{\Delta t}{T}\) (si \(\Delta t\) supera una vuelta, solo cuenta lo que sobra de la última). Con el arco medido sobre el ecuador, \(s = R\,\theta\) (θ en radianes), así que \(R = \dfrac{s}{\theta} = ${tex_(R)}\ \text{m}\).`,
          String.raw`La gravedad es la fuerza centrípeta: \(\dfrac{G M m}{r^2} = m\,\dfrac{4\pi^2 r}{T^2} \;\Rightarrow\; r = \sqrt[3]{\dfrac{G M T^2}{4\pi^2}}\)`,
          String.raw`\(r = \sqrt[3]{\dfrac{${tex_(G)} \cdot ${tex_(M)} \cdot (${tex_(T, 4)})^2}{4\pi^2}} = ${tex_(r, 4)}\ \text{m}\)`,
          String.raw`\(h = r - R = ${tex_(r, 4)} - ${tex_(R)} = ${tex_(h, 4)}\ \text{m} = ${tex_(hkm, 4)}\ \text{km}\)`,
          'La masa del satélite no interviene: cualquier satélite necesita la misma altura para ser estacionario.'
        ]
      };
    }
  },
  {
    id: 'G1a', bloque: 'geo', estrellas: 2, icono: '📡', titulo: 'Vigilante fijo',
    resumen: 'Coloca un satélite que esté siempre sobre la misma ciudad.',
    gen(rng) {
      const ciudad = elegir_(rng, ['Quito', 'Singapur', 'Macapá', 'Kampala', 'Pontianak']);
      const m = entero_(rng, 15, 40) * 100;
      const r = Math.cbrt(G * TIERRA.M * DIA_SIDEREO * DIA_SIDEREO / (4 * Math.PI * Math.PI));
      const h = r - TIERRA.R;
      const Em = -G * TIERRA.M * m / (2 * r);
      return {
        historia: `Una empresa de telecomunicaciones quiere un satélite de ${m} kg que permanezca siempre en la vertical de ${ciudad}, ciudad situada prácticamente sobre el ecuador. Es decir, una órbita geoestacionaria.`,
        datos: [D_G, D_MT, D_RT, dato_('Periodo de rotación terrestre (día sidéreo)', 'T', '86164', U.s + '\\ (23\\text{ h } 56\\text{ min } 4\\text{ s})'), dato_('Masa del satélite', 'm', m, U.kg)],
        preguntas: [
          { texto: 'Altura de la órbita geoestacionaria sobre la superficie', unidad: 'm', sol: h, fija: true },
          { texto: 'Energía mecánica del satélite en esa órbita', unidad: 'J', sol: Em }
        ],
        sim: { tipo: 'geo', cuerpo: 'tierra', R: TIERRA.R, GM: G * TIERRA.M, Trot: DIA_SIDEREO, ciudad: ciudad, campo: 'h', pregunta: 0 },
        pasos: [
          'El satélite debe girar con el mismo periodo que la Tierra respecto a las estrellas: el día sidéreo, no 24 h.',
          String.raw`\(r = \sqrt[3]{\dfrac{G M_T T^2}{4\pi^2}} = ${tex_(r, 4)}\ \text{m}\); \(\;h = r - R_T = ${tex_(h, 4)}\ \text{m}\)`,
          String.raw`\(E_m = -\dfrac{G M_T m}{2r} = ${tex_(Em)}\ \text{J}\)`
        ]
      };
    }
  },
  {
    id: 'G2', bloque: 'geo', estrellas: 3, icono: '🛸', titulo: 'Areoestacionaria',
    resumen: 'La versión marciana: un satélite fijo sobre el ecuador de Marte.',
    gen(rng) {
      const m = entero_(rng, 3, 12) * 100;
      const GM = G * MARTE.M;
      const r = Math.cbrt(GM * MARTE.dia * MARTE.dia / (4 * Math.PI * Math.PI));
      const v = 2 * Math.PI * r / MARTE.dia;
      const Em = -GM * m / (2 * r);
      return {
        historia: `La futura red de comunicaciones marciana necesita un satélite de ${m} kg que permanezca siempre sobre la misma base del ecuador de Marte: una órbita «areoestacionaria».`,
        datos: [D_G, dato_('Masa de Marte', 'M_M', tex_(MARTE.M), U.kg), dato_('Radio de Marte', 'R_M', tex_(MARTE.R), U.m),
          dato_('Periodo de rotación de Marte', 'T', '88620', U.s + '\\ (24\\text{ h } 37\\text{ min})'), dato_('Masa del satélite', 'm', m, U.kg)],
        preguntas: [
          { texto: 'Radio de la órbita areoestacionaria (medido desde el centro de Marte)', unidad: 'm', sol: r, fija: true },
          { texto: 'Velocidad orbital del satélite', unidad: 'm/s', sol: v, fija: true },
          { texto: 'Energía mecánica del satélite en esa órbita', unidad: 'J', sol: Em }
        ],
        sim: { tipo: 'geo', cuerpo: 'marte', R: MARTE.R, GM: GM, Trot: MARTE.dia, ciudad: 'Base Ares', campo: 'r', pregunta: 0 },
        pasos: [
          String.raw`\(r = \sqrt[3]{\dfrac{G M_M T^2}{4\pi^2}} = ${tex_(r, 4)}\ \text{m}\)`,
          String.raw`\(v = \dfrac{2\pi r}{T} = ${tex_(v)}\ \text{m/s}\)`,
          String.raw`\(E_m = -\dfrac{G M_M m}{2r} = ${tex_(Em)}\ \text{J}\)`
        ]
      };
    }
  },

  /* ----------------------------- KEPLER ---------------------------- */
  {
    // Misión rediseñada: 3.ª ley de Kepler en forma de proporción, con un planeta de referencia
    // que no es la Tierra (su radio y su periodo no valen 1). Incógnita: el periodo del asteroide en días.
    id: 'K1', bloque: 'kep', estrellas: 1, icono: '☄️', titulo: 'El año de un asteroide',
    tipo: 'kepler', escala: true,
    objetivo: 'Calcular cuánto dura el año de un asteroide comparándolo con un planeta de su sistema.',
    resumen: 'Una colonia descubre un asteroide en su sistema. ¿Cuánto tarda en dar una vuelta a la estrella?',
    lore: [
      'Una colonia minera ha detectado un asteroide rico en metales que orbita su misma estrella.',
      'Para planificar la expedición necesita saber cuánto dura su «año». Su propio planeta es la mejor referencia.'
    ],
    gen(rng) {
      const estrella = elegir_(rng, ['Tau Arcadia', 'Helios Menor', 'Kalé', 'Sirena Austral', 'Lumen-3']);
      const planeta = elegir_(rng, ['Hespérides', 'Nueva Gaia', 'Teodora', 'Arcadia IV', 'Selene Prima']);
      const asteroide = entero_(rng, 1100, 9800) + ' ' + elegir_(rng, ['Vulcania', 'Ferrum', 'Atalanta', 'Corvina', 'Pirita', 'Orfelia']);
      // planeta de referencia: radio redondeado y periodo entero en días (coherente con una estrella de 0,5–1,8 M☉)
      const Ms = entre_(rng, 0.5, 1.8) * M_SOL;
      const rp = sig_(entre_(rng, 0.5, 1.6) * UA, 3);                 // en metros
      const Tp = Math.round(2 * Math.PI * Math.sqrt(Math.pow(rp, 3) / (G * Ms)) / 86400);
      // asteroide entre 2,4 y 4,2 veces más lejos: así la proporción lineal falla por más de un 35 %
      const ra = sig_(rp * entre_(rng, 2.4, 4.2), 3);
      const k = ra / rp;
      const Ta = Tp * Math.pow(k, 1.5);
      const masaAst = sig_(entre_(rng, 2, 90) * 1e15, 2), diamAst = entero_(rng, 8, 60);
      return {
        historia: `La colonia de ${planeta}, en el sistema ${estrella}, ha detectado el asteroide ${asteroide} en una órbita casi circular. Calcula cuántos días tarda en dar una vuelta completa a la estrella.`,
        datos: [dato_('Radio orbital de ' + planeta, 'r_p', tex_(rp), U.m), dato_('Periodo de ' + planeta, 'T_p', Tp, '\\text{días}'),
          dato_('Radio orbital del asteroide', 'r_a', tex_(ra), U.m)],
        escena: { estrella: estrella, planeta: planeta, asteroide: asteroide, rp: rp, Tp: Tp, ra: ra, masaAst: masaAst, diamAst: diamAst },
        preguntas: [{ texto: 'Periodo del asteroide', unidad: 'días', sol: Ta }],
        errores: [
          { valor: Tp * k, pista: 'Has supuesto que el periodo es proporcional al radio. La 3.ª ley de Kepler dice que T² es proporcional a r³: T = Tₚ·(r/rₚ)^(3/2).' },
          { valor: Tp * Math.pow(k, 2 / 3), pista: 'Has elevado el cociente de radios a 2/3. De T² ∝ r³ sale T ∝ r^(3/2), no r^(2/3).' },
          { valor: Tp * Math.pow(1 / k, 1.5), pista: 'Has invertido el cociente: el asteroide está más lejos que el planeta, así que su año tiene que ser más largo.' },
          { valor: Tp * k * k, pista: 'Revisa el exponente: T² ∝ r³, así que T = Tₚ·(r/rₚ)^(3/2) (ni al cuadrado ni al cubo).' },
          { valor: Tp * k * k * k, pista: 'Te falta la raíz: T² = Tₚ²·(r/rₚ)³, así que hay que hacer la raíz cuadrada al final.' },
          { valor: Tp * Tp * k * k * k, pista: 'Has calculado T² en lugar de T: falta hacer la raíz cuadrada.' }
        ],
        extra: { Ta: Ta, k: k },
        pasos: [
          String.raw`3.ª ley de Kepler: para todos los cuerpos que orbitan la misma estrella, \(\dfrac{T^2}{r^3}\) vale lo mismo. Ni la masa ni el tamaño del asteroide importan.`,
          String.raw`\(\dfrac{T_a^2}{r_a^3} = \dfrac{T_p^2}{r_p^3} \;\Rightarrow\; T_a = T_p\left(\dfrac{r_a}{r_p}\right)^{3/2}\)`,
          String.raw`\(T_a = ${Tp}\cdot\left(\dfrac{${tex_(ra)}}{${tex_(rp)}}\right)^{3/2} = ${Tp}\cdot ${tex_(k, 4)}^{3/2} = ${tex_(Ta, 4)}\ \text{días}\)`,
          'En una proporción las unidades se simplifican: los radios pueden ir en cualquier unidad (siempre la misma) y el periodo sale en las unidades del dato, días.'
        ]
      };
    }
  },
  {
    id: 'K1a', bloque: 'kep', estrellas: 1, icono: '☄️', titulo: 'El año de un asteroide',
    resumen: 'Usa la 3ª ley de Kepler y la Tierra como referencia.',
    gen(rng) {
      const d = entero_(rng, 220, 340) / 100;
      const nombre = String(entero_(rng, 1000, 9999)) + ' ' + elegir_(rng, ['Ceniza', 'Atenea', 'Vesta-B', 'Lucía', 'Hipatia', 'Orión']);
      const T = Math.pow(d, 1.5);
      const dTex = String(d).replace('.', '{,}');
      return {
        historia: `Se ha descubierto el asteroide (${nombre}) en el cinturón principal. Su órbita, prácticamente circular, tiene un radio de ${String(d).replace('.', ',')} UA (unidades astronómicas). ¿Cuánto dura su «año»?`,
        datos: [dato_('Radio de la órbita terrestre', 'r_T', '1', '\\text{UA}'), dato_('Periodo de la Tierra', 'T_T', '1', '\\text{año}'),
          dato_('Radio de la órbita del asteroide', 'r_a', dTex, '\\text{UA}')],
        preguntas: [{ texto: 'Periodo orbital del asteroide', unidad: 'años', sol: T }],
        sim: { tipo: 'solar', orbitas: [{ a: 1, nombre: 'Tierra', color: '#4cc9f0' }, { a: d, nombre: 'Asteroide', color: '#c9a66b' }] },
        pasos: [
          String.raw`3ª ley de Kepler: \(\dfrac{T^2}{r^3}\) es igual para todos los cuerpos que orbitan el Sol.`,
          String.raw`\(\dfrac{T_a^2}{r_a^3} = \dfrac{T_T^2}{r_T^3}\Rightarrow T_a = T_T\left(\dfrac{r_a}{r_T}\right)^{3/2} = ${dTex}^{3/2} = ${tex_(T)}\ \text{años}\)`
        ]
      };
    }
  },
  {
    id: 'K2', bloque: 'kep', estrellas: 2, icono: '⚖️', titulo: 'Pesando un gigante',
    resumen: 'Con los datos de sus lunas, calcula la masa de un planeta gigante.',
    gen(rng) {
      const sistemas = [
        { planeta: 'Júpiter', lunas: [['Ío', 4.22e8, 1.769], ['Europa', 6.71e8, 3.551], ['Ganímedes', 1.07e9, 7.155], ['Calisto', 1.88e9, 16.69]] },
        { planeta: 'Saturno', lunas: [['Tetis', 2.95e8, 1.888], ['Dione', 3.77e8, 2.737], ['Rea', 5.27e8, 4.518], ['Titán', 1.22e9, 15.95]] }
      ];
      const s = elegir_(rng, sistemas);
      const ratios = s.lunas.map(l => Math.pow(l[2] * 86400, 2) / Math.pow(l[1], 3));
      const k = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const M = 4 * Math.PI * Math.PI / (G * k);
      return {
        historia: `La sonda «Juno-B» ha medido los radios orbitales y los periodos de cuatro lunas de ${s.planeta}. Con la 3ª ley de Kepler podemos «pesar» el planeta sin tocarlo.`,
        datos: [D_G],
        tabla: {
          cabecera: ['Luna', 'Radio orbital r (m)', 'Periodo T (días)'],
          filas: s.lunas.map(l => [l[0], tex_(l[1]), String(l[2]).replace('.', '{,}')])
        },
        preguntas: [
          { texto: 'Valor de la constante T²/r³ para este sistema (en unidades del SI)', unidad: 's²/m³', sol: k },
          { texto: 'Masa de ' + s.planeta, unidad: 'kg', sol: M }
        ],
        sim: { tipo: 'kepler', puntos: s.lunas.map(l => ({ nombre: l[0], x: Math.pow(l[1], 3), y: Math.pow(l[2] * 86400, 2) })) },
        pasos: [
          'Pasa los periodos a segundos (1 día = 86400 s) y calcula T²/r³ para cada luna: sale prácticamente lo mismo.',
          String.raw`\(\dfrac{T^2}{r^3} \approx ${tex_(k)}\ \text{s}^2/\text{m}^3\) (pendiente de la recta \(T^2\) frente a \(r^3\))`,
          String.raw`De \(\dfrac{GM}{r^2} = \dfrac{4\pi^2 r}{T^2}\): \(\;\dfrac{T^2}{r^3} = \dfrac{4\pi^2}{GM}\Rightarrow M = \dfrac{4\pi^2}{G\cdot T^2/r^3} = ${tex_(M)}\ \text{kg}\)`
        ]
      };
    }
  },
  {
    // Misión rediseñada: T se mide en la curva de luz (tránsitos) y r en las imágenes del coronógrafo
    // (la órbita se ve de canto: r es la máxima separación). Incógnita: la masa de la estrella.
    id: 'K3', bloque: 'kep', estrellas: 3, icono: '🔭', titulo: 'Cazador de exoplanetas',
    tipo: 'exoplaneta', escala: true,
    objetivo: 'Medir el periodo y el radio de la órbita de un exoplaneta para calcular la masa de su estrella.',
    resumen: 'Con la curva de luz y las imágenes del coronógrafo, pesa una estrella lejana.',
    lore: [
      'El telescopio espacial ha descubierto un planeta que pasa por delante de una estrella lejana, y la agencia quiere saber cuánto pesa esa estrella antes de enviar una sonda.',
      'Solo tienes las observaciones: la curva de luz y las imágenes del coronógrafo.'
    ],
    gen(rng) {
      const Ms = entre_(rng, 0.6, 1.5) * M_SOL;
      const Tdias = entre_(rng, 6, 16), T = Tdias * 86400;
      const r = Math.cbrt(G * Ms * T * T / (4 * Math.PI * Math.PI));
      const estrella = 'CMX-' + entero_(rng, 1200, 9800);

      // fotometría: 100 días, un punto cada 30 min; tránsitos trapezoidales con ruido gaussiano
      const DIAS = 100, CAD = 1 / 48;
      const Rest = 6.96e8 * Math.pow(Ms / M_SOL, 0.8);
      const dur = T / Math.PI * Math.asin(Rest / r) / 86400;           // duración del tránsito (días)
      const prof = entre_(rng, 0.005, 0.012), sigma = entre_(rng, 0.0006, 0.0009);
      const tc = entre_(rng, 0.3, 0.8) * Tdias;                         // centro del primer tránsito
      const transitos = [];
      for (let t = tc; t < DIAS; t += Tdias) transitos.push(t);
      // dos huecos de observación (descarga de datos) que no tapan ningún tránsito
      const huecos = [];
      for (let k = 0; k < 2; k++) {
        for (let intento = 0; intento < 80; intento++) {
          const ini = entre_(rng, 6, DIAS - 8), fin = ini + entre_(rng, 1.2, 2.6);
          const libre = transitos.every(x => x < ini - dur - 0.4 || x > fin + dur + 0.4) && huecos.every(h => fin < h[0] - 4 || ini > h[1] + 4);
          if (libre) { huecos.push([ini, fin]); break; }
        }
      }
      const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
      const flujo = [];
      for (let i = 0; i * CAD <= DIAS; i++) {
        const t = i * CAD;
        if (huecos.some(h => t >= h[0] && t <= h[1])) { flujo.push(null); continue; }
        let caida = 0;
        transitos.forEach(x => {
          const d = Math.abs(t - x), rampa = 0.15 * dur;
          if (d < dur / 2) caida = prof * Math.min(1, (dur / 2 - d) / rampa);
        });
        flujo.push(Math.round((-caida + sigma * gauss()) * 1e5));     // (brillo − 1)·10⁵
      }

      // coronógrafo: imágenes cada 0,1 días; separación proyectada s = r·sen(2π(t − tc)/T) en px
      const escala = sig_(r / entre_(rng, 300, 420), 3);                // metros por píxel
      const rPx = r / escala;
      const sep = [];
      for (let t = 0; t <= DIAS + 1e-9; t += 0.1) sep.push(Math.round(rPx * Math.sin(2 * Math.PI * (t - tc) / Tdias) * 10) / 10);
      const barM = [1e9, 2e9, 2.5e9, 5e9, 1e10].reduce((a, b) => Math.abs(b / escala - 150) < Math.abs(a / escala - 150) ? b : a);
      const angulo = entero_(rng, 15, 70) * (rng() < 0.5 ? 1 : -1);

      const M = Ms;
      const N = transitos.length - 1;
      return {
        historia: `El telescopio ha observado durante ${DIAS} días la estrella ${estrella} y su planeta, que describe una órbita circular. Los huecos de la curva de luz son pausas para enviar datos a la Tierra. Mide el periodo y el radio de la órbita y calcula la masa de la estrella.`,
        datos: [D_G],
        escena: {
          estrella: estrella, G: G, dias: DIAS, cadencia: CAD, flujo: flujo,
          imagen: { paso: 0.1, sep: sep, angulo: angulo, escala: escala, barM: barM, mascara: 58 }
        },
        preguntas: [{ texto: 'Masa de la estrella', unidad: 'kg', sol: M }],
        errores: [
          { valor: 4 * Math.PI * Math.PI * r * r * r / (G * Tdias * Tdias), pista: 'Parece que has usado el periodo en días. Pásalo a segundos (× 86 400) antes de sustituir.' },
          { valor: 8 * M, pista: 'Tu masa es 8 veces mayor: parece que has usado el doble del radio (la distancia entre las dos posiciones extremas del planeta, que es el diámetro de la órbita).' },
          { valor: M / 4, pista: 'Tu masa es 4 veces menor: parece que has medido el doble del periodo. Comprueba cuántos periodos hay entre tus marcadores.' },
          { valor: 4 * M, pista: 'Tu masa es 4 veces mayor: parece que has medido medio periodo.' },
          { valor: M / r, pista: 'Revisa el exponente del radio: de GMm/r² = m·4π²r/T² sale M = 4π²r³/(GT²).' },
          { valor: M / (4 * Math.PI * Math.PI), pista: 'Te falta el factor 4π²: la velocidad orbital es v = 2πr/T.' }
        ],
        extra: { Tdias: Tdias, r: r, rPx: rPx, tc: tc },
        pasos: [
          String.raw`Periodo: entre el primer y el último tránsito hay ${N} periodos. Midiendo esos ${N} periodos y dividiendo se obtiene \(T = ${tex_(Tdias, 4)}\ \text{días} = ${tex_(T, 4)}\ \text{s}\). Cuantos más periodos abarca la medida, menor es el error.`,
          String.raw`Radio: como el planeta transita, la órbita se ve de canto y en las imágenes oscila sobre una línea. Su máxima separación es el radio: \(r = ${tex_(rPx, 4)}\ \text{px} \cdot ${tex_(escala)}\ \text{m/px} = ${tex_(r, 4)}\ \text{m}\)`,
          String.raw`La gravedad de la estrella es la fuerza centrípeta: \(\dfrac{G M m}{r^2} = m\,\dfrac{4\pi^2 r}{T^2} \;\Rightarrow\; M = \dfrac{4\pi^2 r^3}{G T^2}\)`,
          String.raw`\(M = \dfrac{4\pi^2 \cdot (${tex_(r, 4)})^3}{${tex_(G)} \cdot (${tex_(T, 4)})^2} = ${tex_(M)}\ \text{kg} \approx ${tex_(M / M_SOL)}\ M_\odot\)`,
          'Ojo con la precisión: r va al cubo, así que un 1 % de error al medir el radio se convierte en un 3 % en la masa.'
        ]
      };
    }
  },
  {
    id: 'K3a', bloque: 'kep', estrellas: 3, icono: '🔭', titulo: 'Cazador de exoplanetas',
    resumen: 'Deduce la masa de una estrella lejana a partir de su planeta.',
    gen(rng) {
      const Ms = entre_(rng, 0.5, 2.0) * M_SOL;
      const a = sig_(entre_(rng, 0.03, 0.5) * UA, 3);
      const Tdias = sig_(2 * Math.PI * Math.sqrt(a * a * a / (G * Ms)) / 86400, 3);
      const T = Tdias * 86400;
      const M = 4 * Math.PI * Math.PI * a * a * a / (G * T * T);
      const k = elegir_(rng, [1.5, 2, 2.5, 3, 4]);
      const a2 = sig_(a * k, 3);
      const T2 = Tdias * Math.pow(a2 / a, 1.5);
      const estrella = 'Kepler-' + entero_(rng, 100, 999);
      return {
        historia: `El telescopio ha detectado el planeta ${estrella} b, que orbita su estrella en una órbita casi circular. Más tarde aparece un segundo planeta, ${estrella} c, más alejado.`,
        datos: [D_G, dato_('Masa del Sol', 'M_\\odot', tex_(M_SOL), U.kg),
          dato_('Radio orbital del planeta b', 'r_b', tex_(a), U.m),
          dato_('Periodo del planeta b', 'T_b', tex_(Tdias), '\\text{días}'),
          dato_('Radio orbital del planeta c', 'r_c', tex_(a2), U.m)],
        preguntas: [
          { texto: 'Masa de la estrella', unidad: 'kg', sol: M },
          { texto: 'Masa de la estrella en masas solares', unidad: 'M☉', sol: M / M_SOL },
          { texto: 'Periodo del planeta c', unidad: 'días', sol: T2 }
        ],
        sim: { tipo: 'solar', estrella: true, orbitas: [{ a: 1, nombre: 'b', color: '#f8961e' }, { a: a2 / a, nombre: 'c', color: '#43aa8b' }] },
        pasos: [
          String.raw`\(T_b = ${tex_(Tdias)}\cdot 86400 = ${tex_(T)}\ \text{s}\)`,
          String.raw`\(M = \dfrac{4\pi^2 r_b^3}{G T_b^2} = ${tex_(M)}\ \text{kg} = ${tex_(M / M_SOL)}\,M_\odot\)`,
          String.raw`3ª ley de Kepler: \(T_c = T_b\left(\dfrac{r_c}{r_b}\right)^{3/2} = ${tex_(T2)}\ \text{días}\)`
        ]
      };
    }
  },

  /* --------------------------- CONCEPTOS --------------------------- */
  {
    id: 'M1', bloque: 'mit', estrellas: 2, icono: '🧠', titulo: 'Mitos orbitales',
    resumen: 'Dos preguntas conceptuales para cazar errores típicos. Sin cálculos.',
    gen(rng) {
      const banco = [
        ['Dos satélites de 100 kg y 1000 kg describen órbitas circulares del mismo radio alrededor de la Tierra. ¿Cuál va más rápido?',
          ['Van a la misma velocidad', 'El de 100 kg', 'El de 1000 kg', 'Depende de cuándo se lanzaron']],
        ['Un satélite pasa de una órbita circular a otra de mayor radio. Su energía mecánica…',
          ['Aumenta (se hace menos negativa)', 'Disminuye', 'No cambia', 'Pasa a ser positiva']],
        ['Un satélite pasa de una órbita circular a otra de mayor radio. Su velocidad orbital…',
          ['Disminuye', 'Aumenta', 'No cambia', 'Se hace cero']],
        ['La velocidad de escape desde la superficie de un planeta depende de…',
          ['La masa y el radio del planeta', 'La masa del objeto lanzado', 'La dirección del lanzamiento', 'La masa del objeto y la del planeta']],
        ['Un satélite en órbita circular tiene energía mecánica −E. ¿Cuánto vale su energía cinética?',
          ['E', '2E', '−E', 'E/2']],
        ['Los astronautas de la Estación Espacial Internacional flotan porque…',
          ['Están en caída libre continua alrededor de la Tierra', 'A esa altura la gravedad es nula', 'Están fuera de la atmósfera', 'El vacío anula su peso']],
        ['Si el radio de una órbita circular se multiplica por 4, el periodo se multiplica por…',
          ['8', '4', '16', '2']],
        ['Un satélite geoestacionario puede estar situado en la vertical de…',
          ['Un punto del ecuador', 'Cualquier ciudad', 'Uno de los polos', 'Cualquier punto con latitud menor de 45°']],
        ['A la misma distancia del centro de la Tierra, la velocidad de escape y la orbital cumplen…',
          ['v_escape = √2 · v_orbital', 'v_escape = 2 · v_orbital', 'v_escape = v_orbital / 2', 'v_escape = v_orbital']],
        ['Si la masa de la Tierra fuese el doble (con la Luna a la misma distancia), el periodo de la Luna…',
          ['Se dividiría entre √2', 'Se duplicaría', 'Se reduciría a la mitad', 'No cambiaría']]
      ];
      const elegidas = barajar_(rng, banco).slice(0, 2);
      const preguntas = elegidas.map(b => {
        const orden = barajar_(rng, [0, 1, 2, 3]);
        return { texto: b[0], tipo: 'opcion', opciones: orden.map(i => b[1][i]), sol: orden.indexOf(0), correcta: b[1][0] };
      });
      return {
        historia: 'Control de Misión ha detectado ideas equivocadas circulando entre la tripulación. Demuestra que no te dejas engañar.',
        datos: [],
        preguntas: preguntas,
        sim: null,
        pasos: preguntas.map((p, i) => (i + 1) + '. Respuesta correcta: ' + p.correcta)
      };
    }
  }
];

// 9 misiones: 3 de cada dificultad (en total 18 ★; el objetivo son 7, así que hacen falta al menos 3 misiones)
const MISIONES_ACTIVAS = [
  'O1', 'X1', 'K1',   // ★   velocidad orbital · velocidad de escape · 3.ª ley de Kepler
  'E2', 'E3', 'X2',   // ★★  energía de lanzamiento · ascenso orbital · órbita o escape
  'O3', 'G1', 'K3'    // ★★★ caja negra · geoestacionaria · masa de una estrella
];
const CATALOGO = MISIONES_ACTIVAS.map(id => BANCO_MISIONES.find(m => m.id === id));

const MISIONES_POR_ID = CATALOGO.reduce((o, m) => { o[m.id] = m; return o; }, {});

/* ------------------------------------------------------------------ */
/* Corrección: común a la app de Apps Script y a la versión web        */
/* ------------------------------------------------------------------ */

// Misiones «de escala»: una sola respuesta y estrellas según el error relativo
// (<5 % → todas las estrellas de la misión; cada tramo siguiente resta una)
const ESCALA_TRAMOS = [0.05, 0.10, 0.25];

// Textos por defecto de las misiones con elección («Billete de vuelta»); {elegido} y {correcto} se sustituyen
const TEXTOS_ELECCION_ = {
  sin: 'No fijaste ningún destino.',
  bien: 'Tu cálculo para {elegido} es correcto, pero no es el mundo más fácil de abandonar: lo es {correcto}. Compara M/R en los tres.',
  mal: '{elegido} no es el mundo con menor velocidad de escape: lo es {correcto}. Compara M/R en los tres.'
};

/** Lee "mantisa · 10^exponente". Admite coma decimal. */
function leerNumero_(m, e) {
  const ms = String(m === undefined || m === null ? '' : m).trim().replace(',', '.').replace(/\s/g, '');
  const es = String(e === undefined || e === null ? '' : e).trim().replace('−', '-').replace(/\s/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(ms)) return null;
  if (es !== '' && !/^[-+]?\d+$/.test(es)) return null;
  const valor = parseFloat(ms) * Math.pow(10, es === '' ? 0 : parseInt(es, 10));
  return isFinite(valor) ? valor : null;
}

/** Lo que se envía al alumno de una misión (nunca la solución ni los errores típicos). */
function misionPublica_(def, m) {
  return {
    id: def.id,
    bloque: def.bloque,
    titulo: def.titulo,
    icono: def.icono,
    estrellas: def.estrellas,
    tipo: def.tipo || null,
    escala: !!def.escala,
    escena: m.escena || null,
    historia: m.historia,
    datos: m.datos,
    tabla: m.tabla || null,
    sim: m.sim || null,
    preguntas: m.preguntas.map(p => ({
      texto: p.texto,
      unidad: p.unidad || '',
      tipo: p.tipo || 'num',
      opciones: p.opciones || null
    }))
  };
}

/** Corrección de una misión de escala: estrellas según el error relativo y pista si coincide con un error típico. */
function corregirEscala_(def, mision, resp, extra) {
  extra = extra || {};
  const sol = mision.preguntas[0].sol;
  const r = resp[0] || {};
  const valor = leerNumero_(r.m, r.e);
  let error = null, estrellas = 0;
  if (valor !== null && valor !== 0 && Math.sign(valor) === Math.sign(sol)) {
    error = Math.abs(valor - sol) / Math.abs(sol);
    const tramo = ESCALA_TRAMOS.findIndex(t => error < t);
    estrellas = tramo < 0 ? 0 : Math.max(0, def.estrellas - tramo);
  }
  let pista = null;
  if (valor !== null && estrellas < 3) {
    const tipico = (mision.errores || []).find(e => Math.abs(valor - e.valor) <= 0.04 * Math.abs(e.valor));
    if (tipico) pista = tipico.pista;
  }
  // misiones con elección (p. ej. el mundo de despegue): elegir mal anula las estrellas
  let destino = null;
  if (mision.eleccion) {
    const el = mision.eleccion;
    destino = Number.isInteger(extra.destino) && extra.destino >= 0 && extra.destino < el.nombres.length ? extra.destino : null;
    if (destino !== el.correcta) {
      estrellas = 0;
      const bien = el.nombres[el.correcta];
      const tx = el.textos || TEXTOS_ELECCION_;
      const rellena = t => t.replace('{elegido}', destino === null ? '' : el.nombres[destino]).replace('{correcto}', bien);
      if (destino === null) pista = rellena(tx.sin);
      else if (valor !== null && Math.abs(valor - el.ves[destino]) <= 0.04 * Math.abs(el.ves[destino])) pista = rellena(tx.bien);
      else pista = rellena(tx.mal);
    }
  }
  const prediccion = ['rapido', 'lento', 'igual', 'mayor', 'menor'].indexOf(extra.prediccion) >= 0 ? extra.prediccion : null;
  return {
    estrellas: estrellas,
    respuesta: valor,
    sol: sol,
    error: error,
    pista: pista,
    prediccion: prediccion,
    destino: destino,
    extra: mision.extra || null,
    pasos: mision.pasos
  };
}
