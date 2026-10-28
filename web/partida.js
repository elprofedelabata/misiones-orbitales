/* =====================================================================
 * Misiones orbitales · versión web (modo práctica)
 *
 * Sustituye al servidor de Apps Script: implementa en el navegador las mismas llamadas
 * (google.script.run) y guarda la partida en localStorage. Usa el código común de
 * Misiones.js (generación de misiones y corrección), así que puntúa igual que la app de clase.
 *
 * Diferencias con la app de clase: sin cuentas ni campañas, cada misión se puede repetir con
 * datos nuevos (cuenta el mejor resultado) y una sola partida por navegador.
 * ===================================================================== */

window.MODO_PRACTICA = true;

const CLAVE_PARTIDA = 'misiones-orbitales:partida';
const OBJETIVO_PRACTICA = 7;
const INDICATIVO_OK = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;   // las mismas reglas que en la app de clase

function partidaNueva() {
  // semilla propia: cada partida (y cada intento) tiene sus propios datos
  const semilla = Array.from(crypto.getRandomValues(new Uint32Array(4)), x => x.toString(36)).join('');
  return { version: 1, semilla: semilla, avatar: null, indicativo: '', misiones: {}, enCurso: null };
}

function leerPartida() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_PARTIDA));
    if (p && p.version === 1 && p.semilla) return p;
  } catch (e) { /* sin almacenamiento o datos dañados: partida nueva */ }
  return partidaNueva();
}

let PARTIDA = leerPartida();

function guardarPartida() {
  // en una ventana privada puede fallar: la partida dura lo que dure la pestaña
  try { localStorage.setItem(CLAVE_PARTIDA, JSON.stringify(PARTIDA)); } catch (e) { /* sin almacenamiento */ }
}

/** Datos de la misión en el intento actual (el mismo intento da siempre los mismos datos). */
function misionDelIntento(id) {
  const reg = PARTIDA.misiones[id] || { intentos: 1 };
  return MISIONES_POR_ID[id].gen(rngDesde_(PARTIDA.semilla + '|' + id + '|' + reg.intentos));
}

/** Lo mismo que devuelve el servidor en la app de clase (resumen_ de Codigo.js). */
function resumenPartida() {
  let estrellas = 0;
  const catalogo = CATALOGO.map(m => {
    const reg = PARTIDA.misiones[m.id] || {};
    const hecha = typeof reg.mejor === 'number';
    if (hecha) estrellas += reg.mejor;
    return {
      id: m.id, bloque: m.bloque, titulo: m.titulo, icono: m.icono,
      estrellas: m.estrellas, resumen: m.resumen,
      lore: m.lore || null, objetivo: m.objetivo || null, imagen: m.imagen || null, escala: !!m.escala, preguntas: 1,
      estado: PARTIDA.enCurso === m.id ? 'curso' : (hecha ? 'hecha' : 'pendiente'),
      obtenidas: hecha ? reg.mejor : null
    };
  });
  return {
    correo: 'tripulante@local',
    indicativo: PARTIDA.indicativo,
    avatar: PARTIDA.avatar,
    enCurso: PARTIDA.enCurso,
    estrellas: estrellas,
    objetivo: OBJETIVO_PRACTICA,
    rangos: RANGOS_ESTRELLAS,
    bloques: BLOQUES,
    campana: { estado: 'curso', faltan: 0 },
    apuntes: null,
    catalogo: catalogo
  };
}

const API_LOCAL = {
  getInicio() { return resumenPartida(); },
  getCampana() { return { estado: 'curso', faltan: 0 }; },
  getImagenes() { return typeof IMAGENES_MISION === 'undefined' ? {} : IMAGENES_MISION; },
  getApuntes() { throw new Error('Esta versión no incluye apuntes.'); },

  guardarAvatar(avatar, indicativo) {
    const nombre = String(indicativo || '').replace(/[<>]/g, '').trim().slice(0, 20);
    if (nombre.length < 3) throw new Error('Tu indicativo debe tener entre 3 y 20 caracteres.');
    if (!INDICATIVO_OK.test(nombre)) throw new Error('Tu indicativo solo puede llevar letras, números, espacios, guiones, puntos y guiones bajos, y debe empezar por letra o número.');
    PARTIDA.avatar = avatar;
    PARTIDA.indicativo = nombre;
    guardarPartida();
    return resumenPartida();
  },
  ponerIndicativo(indicativo) { return API_LOCAL.guardarAvatar(PARTIDA.avatar, indicativo); },

  empezarMision(id) {
    const def = MISIONES_POR_ID[id];
    if (!def) throw new Error('Misión desconocida.');
    if (PARTIDA.enCurso && PARTIDA.enCurso !== id) throw new Error('Ya tienes otra misión en curso. Termínala primero.');
    if (PARTIDA.enCurso !== id) {
      // intento nuevo: datos nuevos (el mejor resultado anterior se conserva)
      const reg = PARTIDA.misiones[id] || (PARTIDA.misiones[id] = { mejor: null, intentos: 0 });
      reg.intentos++;
      PARTIDA.enCurso = id;
      guardarPartida();
    }
    return misionPublica_(def, misionDelIntento(id));
  },

  entregarMision(id, respuestas, extra) {
    const def = MISIONES_POR_ID[id];
    if (!def) throw new Error('Misión desconocida.');
    if (PARTIDA.enCurso !== id) throw new Error('Esta misión ya no está en curso. Vuelves al panel para empezarla de nuevo.');
    const res = corregirEscala_(def, misionDelIntento(id), Array.isArray(respuestas) ? respuestas : [], extra || {});
    const reg = PARTIDA.misiones[id];
    reg.mejor = Math.max(typeof reg.mejor === 'number' ? reg.mejor : 0, res.estrellas);
    PARTIDA.enCurso = null;
    guardarPartida();
    res.inicio = resumenPartida();
    return res;
  },

  nuevaPartida() {
    try { localStorage.removeItem(CLAVE_PARTIDA); } catch (e) { /* sin almacenamiento */ }
    PARTIDA = partidaNueva();
    return true;
  }
};

// google.script.run en el navegador: misma forma de uso que en Apps Script (con respuesta asíncrona)
window.google = { script: { get run() {
  let ok = () => {}, mal = () => {};
  const llamada = new Proxy({}, { get(_, nombre) {
    if (nombre === 'withSuccessHandler') return f => { ok = f; return llamada; };
    if (nombre === 'withFailureHandler') return f => { mal = f; return llamada; };
    return (...args) => setTimeout(() => {
      let r;
      try { r = API_LOCAL[nombre](...args); } catch (e) { mal(e); return; }
      // copia, como si viniera del servidor: la app nunca comparte objetos con la partida guardada
      ok(r === undefined ? r : JSON.parse(JSON.stringify(r)));
    }, 30);
  } });
  return llamada;
} } };
