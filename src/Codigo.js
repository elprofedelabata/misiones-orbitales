/**
 * Misiones orbitales · 2º Bachillerato
 * Servidor de la aplicación web (Google Apps Script).
 *
 * La app se despliega "ejecutar como: yo" y "acceso: usuarios del dominio",
 * así el alumnado se identifica con su cuenta educaand y los resultados
 * quedan en una Hoja de cálculo del profesor sin que tengan acceso a ella.
 *
 * Es un script independiente: la hoja de resultados la crea el profesor desde
 * la configuración (/exec, y una nueva en cada campaña). Su ID se guarda en las
 * propiedades del script.
 */

const PROP_HOJA = 'ID_HOJA';
const PROP_APUNTES = 'ID_APUNTES';              // PDF de apuntes (en el Drive del profesor)
const PROP_APUNTES_NOMBRE = 'NOMBRE_APUNTES';
const HOJA_ALUMNOS = 'Alumnos';
const HOJA_REGISTRO = 'Registro';
const OBJETIVO_ESTRELLAS = 7;   // con 7 hacen falta al menos tres misiones (una da como máximo 3 ★)
const TOLERANCIA = 0.03; // ±3 % en respuestas numéricas
const EN_CURSO = 'EN CURSO';

const COLS_FIJAS = ['Correo', 'Indicativo', 'Estrellas', 'Rango', 'Misiones', 'En curso', 'Inicio misión', 'Última actividad', 'Hora estrellas'];

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rutas: /exec → configuración (profesor); ?vista=puente → puente (profesor); ?vista=alumno → app de alumnos.
 * El alumnado siempre llega a su app, le pasen el enlace que le pasen.
 */
function doGet(e) {
  const vista = e && e.parameter ? e.parameter.vista : '';
  const profesor = esProfesor_();
  const pagina = (archivo, titulo) => HtmlService.createTemplateFromFile(archivo)
    .evaluate()
    .setTitle(titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  // sin hoja de resultados todavía, el profesor va siempre a la configuración para crearla
  if (profesor && (!vista || vista === 'configuracion' || !idHoja_())) return pagina('Configuracion', 'Configuración · Misiones orbitales');
  if (!idHoja_()) {
    return HtmlService.createHtmlOutput('<p style="font:16px sans-serif;padding:40px">La actividad aún no está preparada. Vuelve a intentarlo más tarde.</p>')
      .setTitle('Misiones orbitales');
  }
  if (profesor && vista === 'puente') return pagina('Puente', 'Puente de mando · Misiones orbitales');
  return pagina('Index', 'Misiones orbitales');
}

/** El profesor es quien ha desplegado la web app (la app se ejecuta como él). */
function esProfesor_() {
  const quien = Session.getActiveUser().getEmail();
  return !!quien && quien === Session.getEffectiveUser().getEmail();
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/* ------------------------------------------------------------------ */
/* API llamada desde el cliente                                        */
/* ------------------------------------------------------------------ */

function getInicio() {
  const correo = correo_();
  // sin bloqueo: solo el alta de un alumno nuevo hace cola (dentro de leerAlumno_)
  return resumen_(correo, leerAlumno_(correo, true));
}

/** Para quien ya tenía avatar pero no indicativo: lo elige una sola vez. */
function ponerIndicativo(indicativo) {
  const correo = correo_();
  const nombre = String(indicativo || '').replace(/[<>]/g, '').trim().slice(0, 20);
  exigirCampana_('avatar');
  return conBloqueo_(() => {
    const alumno = leerAlumno_(correo, true);
    if (alumno.indicativo) throw new Error('Tu indicativo ya está guardado y no se puede cambiar.');
    const hoja = hojas_().alumnos;
    const cab = cabecera_(hoja);
    validarIndicativo_(hoja, cab, nombre, alumno.fila);
    escribirIndicativo_(hoja, alumno.fila, cab, nombre);
    return resumen_(correo, leerAlumno_(correo, false));
  });
}

// Letras, números, espacios, guion, punto y guion bajo, empezando por letra o número: así la hoja nunca
// lo toma por una fórmula (=, +, -, @)
const INDICATIVO_VALIDO = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

/** Indicativo obligatorio: entre 3 y 20 caracteres, con caracteres seguros y distinto del de cualquier otro tripulante. */
function validarIndicativo_(hoja, cab, nombre, filaPropia) {
  if (nombre.length < 3) throw new Error('Tu indicativo debe tener entre 3 y 20 caracteres.');
  if (!INDICATIVO_VALIDO.test(nombre)) throw new Error('Tu indicativo solo puede llevar letras, números, espacios, guiones, puntos y guiones bajos, y debe empezar por letra o número.');
  const normal = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();
  const filas = hoja.getLastRow() - 2;
  if (filas < 1) return;
  const valores = hoja.getRange(3, cab.indexOf('Indicativo') + 1, filas, 1).getValues();
  const clave = normal(nombre);
  valores.forEach((v, i) => {
    if (i + 3 !== filaPropia && normal(v[0]) === clave) throw new Error('Ese indicativo ya lo usa otro tripulante. Elige otro.');
  });
}

/** Se guarda como texto: «007» no debe convertirse en el número 7. */
function escribirIndicativo_(hoja, fila, cab, nombre) {
  hoja.getRange(fila, cab.indexOf('Indicativo') + 1).setNumberFormat('@').setValue(nombre);
}

function guardarAvatar(avatar, indicativo) {
  const correo = correo_();
  const limpio = limpiarAvatar_(avatar);
  const nombre = String(indicativo || '').replace(/[<>]/g, '').trim().slice(0, 20);
  exigirCampana_('avatar');
  return conBloqueo_(() => {
    const alumno = leerAlumno_(correo, true);
    // la apariencia es definitiva (para cambiarla, el profesor borra la celda «Avatar» de la hoja)
    if (alumno.avatar) throw new Error('Tu apariencia ya está guardada y no se puede cambiar.');
    const hoja = hojas_().alumnos;
    const cab = cabecera_(hoja);
    validarIndicativo_(hoja, cab, nombre, alumno.fila);
    escribirIndicativo_(hoja, alumno.fila, cab, nombre);
    hoja.getRange(alumno.fila, cab.indexOf('Avatar') + 1).setValue(JSON.stringify(limpio));
    hoja.getRange(alumno.fila, cab.indexOf('Última actividad') + 1).setValue(new Date());
    return resumen_(correo, leerAlumno_(correo, false));
  });
}

// Empezar y entregar no hacen cola: cada alumno solo escribe en su propia fila, y así, al despegar toda la
// clase a la vez tras la cuenta atrás, nadie espera a los demás.

function empezarMision(id) {
  const correo = correo_();
  const def = MISIONES_POR_ID[id];
  if (!def) throw new Error('Misión desconocida.');
  exigirCampana_('mision');
  const alumno = leerAlumno_(correo, true);
  if (alumno.enCurso && alumno.enCurso !== id) {
    throw new Error('Ya tienes otra misión en curso. Termínala primero.');
  }
  if (typeof alumno.misiones[id] === 'number') {
    throw new Error('Esta misión ya está completada.');
  }
  const mision = generarMision_(def, correo);
  if (alumno.enCurso !== id) {
    const hoja = hojas_().alumnos;
    const cab = cabecera_(hoja);
    const ahora = new Date();
    hoja.getRange(alumno.fila, cab.indexOf(id) + 1).setValue(EN_CURSO);
    hoja.getRange(alumno.fila, cab.indexOf('En curso') + 1).setValue(id);
    hoja.getRange(alumno.fila, cab.indexOf('Inicio misión') + 1).setValue(ahora);
    hoja.getRange(alumno.fila, cab.indexOf('Última actividad') + 1).setValue(ahora);
    registrar_(correo, id, 'Inicio', {
      preguntas: mision.preguntas.map(p => ({ texto: p.texto, sol: p.sol }))
    });
  }
  return misionPublica_(def, mision);
}

function entregarMision(id, respuestas, extra) {
  const correo = correo_();
  const def = MISIONES_POR_ID[id];
  if (!def) throw new Error('Misión desconocida.');
  exigirCampana_('mision');
  const alumno = leerAlumno_(correo, true);
  if (alumno.enCurso !== id) throw new Error(MISION_RETIRADA);
  const mision = generarMision_(def, correo);
  const resp = Array.isArray(respuestas) ? respuestas : [];

  if (def.escala) return entregarEscala_(correo, alumno, def, mision, resp, extra || {});

  const detalle = mision.preguntas.map((p, i) => {
    const r = resp[i] || {};
    if (p.tipo === 'opcion') {
      const elegida = Number(r.opcion);
      return { correcta: elegida === p.sol, respuesta: elegida, sol: p.sol };
    }
    const valor = leerNumero_(r.m, r.e);
    const ok = valor !== null && Math.abs(valor - p.sol) <= TOLERANCIA * Math.abs(p.sol);
    return { correcta: ok, respuesta: valor, sol: p.sol };
  });
  const estrellas = detalle.filter(d => d.correcta).length;

  const hoja = hojas_().alumnos;
  const cab = cabecera_(hoja);
  hoja.getRange(alumno.fila, cab.indexOf(id) + 1).setValue(estrellas);
  hoja.getRange(alumno.fila, cab.indexOf('En curso') + 1).setValue('');
  hoja.getRange(alumno.fila, cab.indexOf('Inicio misión') + 1).setValue('');
  hoja.getRange(alumno.fila, cab.indexOf('Última actividad') + 1).setValue(new Date());
  actualizarTotales_(hoja, alumno.fila, cab);
  registrar_(correo, id, 'Entrega', { estrellas: estrellas, detalle: detalle });

  return {
    estrellas: estrellas,
    resultados: detalle.map((d, i) => ({
      correcta: d.correcta,
      respuesta: d.respuesta,
      sol: mision.preguntas[i].fija ? null : d.sol
    })),
    pasos: mision.pasos,
    inicio: resumen_(correo, leerAlumno_(correo, false))
  };
}

// el profesor desbloqueó o reinició la misión mientras el alumno la tenía abierta
const MISION_RETIRADA = 'Esta misión ya no está en curso: puede que tu profesor la haya desbloqueado. Vuelves al panel para empezarla de nuevo.';

/** Entrega de una misión de escala: la corrección es común (corregirEscala_, en Misiones.js); aquí se guarda en la hoja. */
function entregarEscala_(correo, alumno, def, mision, resp, extra) {
  const res = corregirEscala_(def, mision, resp, extra);

  const hoja = hojas_().alumnos;
  const cab = cabecera_(hoja);
  hoja.getRange(alumno.fila, cab.indexOf(def.id) + 1).setValue(res.estrellas);
  hoja.getRange(alumno.fila, cab.indexOf('En curso') + 1).setValue('');
  hoja.getRange(alumno.fila, cab.indexOf('Inicio misión') + 1).setValue('');
  hoja.getRange(alumno.fila, cab.indexOf('Última actividad') + 1).setValue(new Date());
  actualizarTotales_(hoja, alumno.fila, cab);
  registrar_(correo, def.id, 'Entrega', { estrellas: res.estrellas, respuesta: res.respuesta, sol: res.sol, error: res.error,
    prediccion: res.prediccion, destino: res.destino, pista: !!res.pista });

  res.inicio = resumen_(correo, leerAlumno_(correo, false));
  return res;
}

/**
 * Puente de mando (solo el profesor): avatar, indicativo, estrellas, rango y misión en curso de cada
 * tripulante con avatar. No se envían correos: cada tripulante se identifica con una clave opaca.
 */
function getTripulacion() {
  if (!esProfesor_()) throw new Error('Solo el profesor puede ver el puente de mando.');
  const hoja = hojas_().alumnos;
  const cab = cabecera_(hoja);
  const n = hoja.getLastRow() - 2;
  const filas = n > 0 ? hoja.getRange(3, 1, n, cab.length).getValues() : [];
  const col = c => cab.indexOf(c);
  const campana = leerCampana_();
  const profe = String(Session.getEffectiveUser().getEmail()).toLowerCase();
  const tripulantes = [];
  let enHangar = 0;
  filas.forEach(f => {
    const correo = f[col('Correo')], indicativo = String(f[col('Indicativo')] || '').trim();
    let avatar = null;
    try { avatar = f[col('Avatar')] ? JSON.parse(f[col('Avatar')]) : null; } catch (e) { avatar = null; }
    // el profesor puede probar la app de alumnos, pero nunca sale en el puente
    if (!correo || String(correo).toLowerCase() === profe) return;
    // ha abierto la app pero aún no ha confirmado su astronauta
    if (!avatar || !indicativo) { enHangar++; return; }
    let estrellas = 0;
    CATALOGO.forEach(m => { const v = f[col(m.id)]; if (typeof v === 'number') estrellas += v; });
    const hora = col('Hora estrellas') >= 0 ? f[col('Hora estrellas')] : '';
    // con la campaña terminada, una misión a medias ya no está «en misión»
    const enCurso = campana.estado === 'curso' && MISIONES_POR_ID[f[col('En curso')]] ? MISIONES_POR_ID[f[col('En curso')]].titulo : null;
    tripulantes.push({
      id: claveOpaca_(correo), indicativo: indicativo, avatar: avatar, estrellas: estrellas,
      hora: hora instanceof Date ? hora.getTime() : 0, enCurso: enCurso
    });
  });
  return {
    objetivo: OBJETIVO_ESTRELLAS,
    total: CATALOGO.reduce((t, m) => t + m.estrellas, 0),
    rangos: RANGOS_ESTRELLAS,
    campana: campanaPublica_(campana),
    enHangar: enHangar,
    tripulantes: tripulantes
  };
}

/* ------------------------------------------------------------------ */
/* Campaña: cerrada → hangar → en curso → finalizada                   */
/* ------------------------------------------------------------------ */

const HOJA_CAMPANA = 'Campaña';
const ESTADOS_CAMPANA = { cerrada: 'Cerrada', hangar: 'Hangar', curso: 'En curso', finalizada: 'Finalizada' };
const SIGUIENTE_CAMPANA = { cerrada: 'hangar', hangar: 'curso', curso: 'finalizada' };
const CUENTA_ATRAS_MS = 10000;          // al iniciar, las misiones se abren tras la cuenta atrás
const CAMPANA_TERMINADA = 'La campaña ha terminado: ya no se aceptan envíos.';

/** Estado de la campaña. Es ligero: lo consulta cada alumno cada pocos segundos mientras espera. */
function getCampana() {
  correo_();
  return campanaPublica_(leerCampana_());
}

/** Lo que ven los clientes: el estado y, al iniciar, cuánto falta para que se abran las misiones. */
function campanaPublica_(c) {
  return { estado: c.estado, faltan: c.estado === 'curso' ? Math.max(0, c.inicio - Date.now()) : 0 };
}

/** Lee el estado de la hoja «Campaña» (con caché de 20 s: el profesor también puede cambiarlo a mano). */
function leerCampana_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('campana');
  if (guardado) return JSON.parse(guardado);
  const v = hojaCampana_().getRange(1, 2, 4, 1).getValues();
  const normal = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const estado = Object.keys(ESTADOS_CAMPANA).find(k => normal(ESTADOS_CAMPANA[k]) === normal(v[0][0])) || 'cerrada';
  const c = { estado: estado, inicio: v[2][0] instanceof Date ? v[2][0].getTime() : 0 };
  cache.put('campana', JSON.stringify(c), 20);
  return c;
}

function hojaCampana_() {
  const libro = libro_();
  let hoja = libro.getSheetByName(HOJA_CAMPANA);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_CAMPANA);
    hoja.getRange(1, 1, 4, 2).setValues([['Estado', ESTADOS_CAMPANA.cerrada], ['Hangar abierto', ''], ['Inicio', ''], ['Fin', '']]);
    hoja.getRange(1, 1, 4, 1).setFontWeight('bold');
    hoja.getRange(2, 2, 3, 1).setNumberFormat('dd/mm/yyyy HH:mm:ss');
    hoja.getRange(1, 2).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(Object.keys(ESTADOS_CAMPANA).map(k => ESTADOS_CAMPANA[k]), true).build());
    hoja.getRange(6, 1).setValue('Se controla desde el puente de mando. Si terminas la campaña por error, pon el estado en «En curso»: los alumnos lo notarán en unos segundos.')
      .setFontStyle('italic').setFontColor('#666666');
  }
  return hoja;
}

/** Avanza la campaña un paso (solo el profesor, desde el puente). Devuelve la tripulación actualizada. */
function cambiarCampana(destino) {
  if (!esProfesor_()) throw new Error('Solo el profesor puede controlar la campaña.');
  conBloqueo_(() => {
    const cache = CacheService.getScriptCache();
    cache.remove('campana');
    // doble clic o dos pestañas abiertas: nunca se salta un paso
    if (SIGUIENTE_CAMPANA[leerCampana_().estado] !== destino) return;
    const hoja = hojaCampana_(), ahora = new Date();
    hoja.getRange(1, 2).setValue(ESTADOS_CAMPANA[destino]);
    if (destino === 'hangar') hoja.getRange(2, 2).setValue(ahora);
    if (destino === 'curso') hoja.getRange(3, 2).setValue(new Date(ahora.getTime() + CUENTA_ATRAS_MS));
    if (destino === 'finalizada') hoja.getRange(4, 2).setValue(ahora);
    SpreadsheetApp.flush();
    cache.remove('campana');
  });
  return getTripulacion();
}

/** El servidor hace cumplir el estado: el avatar se guarda con el hangar abierto y las misiones, solo durante la campaña. */
function exigirCampana_(accion) {
  const c = leerCampana_();
  if (c.estado === 'finalizada') throw new Error(CAMPANA_TERMINADA);
  if (accion === 'avatar' && (c.estado === 'hangar' || c.estado === 'curso')) return;
  if (accion === 'mision' && c.estado === 'curso' && Date.now() >= c.inicio - 1500) return;
  throw new Error(accion === 'avatar' ? 'El hangar todavía no está abierto.' : 'Las misiones todavía no están abiertas.');
}

function claveOpaca_(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/* ------------------------------------------------------------------ */
/* Misiones                                                            */
/* ------------------------------------------------------------------ */

function generarMision_(def, correo) {
  const rng = rngDesde_(correo + '|' + def.id + '|orbitas-2bach');
  return def.gen(rng);
}

/* ------------------------------------------------------------------ */
/* Hoja de cálculo                                                     */
/* ------------------------------------------------------------------ */

function hojas_() {
  const libro = libro_();
  let alumnos = libro.getSheetByName(HOJA_ALUMNOS);
  if (!alumnos) {
    alumnos = libro.insertSheet(HOJA_ALUMNOS, 0);
    const cab = COLS_FIJAS.concat(CATALOGO.map(m => m.id), ['Avatar']);
    alumnos.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1d2b53').setFontColor('#ffffff');
    alumnos.getRange(2, 1, 1, cab.length).setValues([CATALOGO_NOTAS_()]).setFontStyle('italic').setFontColor('#666666');
    alumnos.setFrozenRows(2);
    alumnos.setFrozenColumns(3);
    alumnos.getRange('G:I').setNumberFormat('dd/mm/yyyy HH:mm:ss');
    const defecto = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1');
    if (defecto && libro.getSheets().length > 1) libro.deleteSheet(defecto);
  }
  let registro = libro.getSheetByName(HOJA_REGISTRO);
  if (!registro) {
    registro = libro.insertSheet(HOJA_REGISTRO);
    registro.getRange(1, 1, 1, 5).setValues([['Fecha', 'Correo', 'Misión', 'Evento', 'Detalle']])
      .setFontWeight('bold').setBackground('#1d2b53').setFontColor('#ffffff');
    registro.setFrozenRows(1);
    registro.getRange('A:A').setNumberFormat('dd/mm/yyyy HH:mm:ss');
  }
  return { libro: libro, alumnos: alumnos, registro: registro };
}

function CATALOGO_NOTAS_() {
  return COLS_FIJAS.map(() => '').concat(CATALOGO.map(m => m.titulo + ' (' + m.estrellas + '★)'), ['']);
}

function cabecera_(hoja) {
  return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
}

function filaAlumno_(hoja, correo) {
  const encontrado = hoja.getRange('A:A').createTextFinder(correo).matchEntireCell(true).findNext();
  return encontrado ? encontrado.getRow() : 0;
}

function leerAlumno_(correo, crear) {
  const hoja = hojas_().alumnos;
  const cab = cabecera_(hoja);
  let fila = filaAlumno_(hoja, correo);
  if (!fila) {
    if (!crear) throw new Error('Alumno no encontrado.');
    // alta: appendRow es atómico (dos alumnos nuevos a la vez nunca comparten fila) y la cola evita que
    // quien entra con dos pestañas a la vez quede dado de alta dos veces
    fila = conBloqueo_(() => {
      const ya = filaAlumno_(hoja, correo);
      if (ya) return ya;
      hoja.appendRow(cab.map(c => {
        if (c === 'Correo') return correo;
        if (c === 'Estrellas' || c === 'Misiones') return 0;
        if (c === 'Rango') return RANGOS_ESTRELLAS[0].n;
        if (c === 'Última actividad') return new Date();
        return '';
      }));
      SpreadsheetApp.flush();
      return filaAlumno_(hoja, correo);
    });
  }
  const fila_ = hoja.getRange(fila, 1, 1, cab.length).getValues()[0];
  const valor = c => fila_[cab.indexOf(c)];
  const misiones = {};
  CATALOGO.forEach(m => {
    const v = valor(m.id);
    misiones[m.id] = (v === '' || v === null) ? null : (v === EN_CURSO ? EN_CURSO : Number(v));
  });
  let avatar = null;
  try { avatar = valor('Avatar') ? JSON.parse(valor('Avatar')) : null; } catch (e) { avatar = null; }
  return {
    fila: fila,
    indicativo: valor('Indicativo') || '',
    avatar: avatar,
    // una misión retirada del catálogo no cuenta como «en curso»
    enCurso: MISIONES_POR_ID[valor('En curso')] ? valor('En curso') : null,
    misiones: misiones
  };
}

function actualizarTotales_(hoja, fila, cab) {
  const valores = hoja.getRange(fila, 1, 1, cab.length).getValues()[0];
  let estrellas = 0, hechas = 0;
  CATALOGO.forEach(m => {
    const v = valores[cab.indexOf(m.id)];
    if (typeof v === 'number') { estrellas += v; hechas++; }
  });
  const antes = valores[cab.indexOf('Estrellas')];
  hoja.getRange(fila, cab.indexOf('Estrellas') + 1).setValue(estrellas);
  hoja.getRange(fila, cab.indexOf('Misiones') + 1).setValue(hechas);
  hoja.getRange(fila, columna_(hoja, cab, 'Rango') + 1).setValue(nombreRango_(estrellas));
  // hora a la que alcanzó sus estrellas actuales: desempata el ranking del puente (llegó antes, va delante)
  if (Number(antes) !== estrellas) hoja.getRange(fila, columna_(hoja, cab, 'Hora estrellas') + 1).setValue(new Date());
}

/** Índice de una columna; en hojas antiguas que no la tienen, se añade al final. */
function columna_(hoja, cab, nombre) {
  let col = cab.indexOf(nombre);
  if (col < 0) {
    col = hoja.getLastColumn();
    hoja.getRange(1, col + 1).setValue(nombre).setFontWeight('bold').setBackground('#1d2b53').setFontColor('#ffffff');
    cab.push(nombre);
  }
  return col;
}

function registrar_(correo, id, evento, detalle) {
  hojas_().registro.appendRow([new Date(), correo, id, evento, JSON.stringify(detalle)]);
}

function resumen_(correo, alumno) {
  let estrellas = 0;
  const catalogo = CATALOGO.map(m => {
    const v = alumno.misiones[m.id];
    const hecha = typeof v === 'number';
    if (hecha) estrellas += v;
    return {
      id: m.id, bloque: m.bloque, titulo: m.titulo, icono: m.icono,
      estrellas: m.estrellas, resumen: m.resumen,
      lore: m.lore || null, objetivo: m.objetivo || null, imagen: m.imagen || null, escala: !!m.escala, preguntas: m.escala ? 1 : m.estrellas,
      estado: v === EN_CURSO ? 'curso' : (hecha ? 'hecha' : 'pendiente'),
      obtenidas: hecha ? v : null
    };
  });
  return {
    correo: correo,
    indicativo: alumno.indicativo,
    avatar: alumno.avatar,
    enCurso: alumno.enCurso,
    estrellas: estrellas,
    objetivo: OBJETIVO_ESTRELLAS,
    rangos: RANGOS_ESTRELLAS,
    bloques: BLOQUES,
    campana: campanaPublica_(leerCampana_()),
    apuntes: PropertiesService.getScriptProperties().getProperty(PROP_APUNTES_NOMBRE),
    catalogo: catalogo
  };
}

function correo_() {
  const correo = Session.getActiveUser().getEmail();
  if (!correo) throw new Error('No se ha podido identificar tu cuenta. Entra con tu cuenta @g.educaand.es.');
  return correo.toLowerCase();
}

/**
 * Cola para lo que no puede hacerse a la vez (altas, indicativos únicos, cambios del profesor).
 * Antes de dejar pasar al siguiente se escribe todo en la hoja, para que lea datos al día.
 * Es reentrante: una función con cola puede llamar a otra que también la use.
 */
let EN_COLA_ = false;
function conBloqueo_(fn) {
  if (EN_COLA_) return fn();
  const lock = LockService.getScriptLock();
  lock.waitLock(45000);
  EN_COLA_ = true;
  try {
    const r = fn();
    SpreadsheetApp.flush();
    return r;
  } finally {
    EN_COLA_ = false;
    lock.releaseLock();
  }
}

function limpiarAvatar_(a) {
  a = a || {};
  const color = c => /^#[0-9a-fA-F]{6}$/.test(String(c)) ? String(c) : '#888888';
  const opcion = (v, lista, def) => lista.indexOf(v) >= 0 ? v : def;
  return {
    piel: color(a.piel),
    pelo: opcion(a.pelo, ['corto', 'largo', 'coleta', 'mono', 'rizado', 'rapado'], 'corto'),
    colorPelo: color(a.colorPelo),
    cara: opcion(a.cara, ['sonriente', 'seria', 'guino', 'sorpresa', 'gafas'], 'sonriente'),
    traje: color(a.traje),
    casco: color(a.casco)
  };
}


/* ------------------------------------------------------------------ */
/* Configuración (solo el profesor, en /exec)                          */
/* ------------------------------------------------------------------ */

function idHoja_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_HOJA);
}

function libro_() {
  const id = idHoja_();
  if (!id) throw new Error('La actividad aún no está preparada: el profesor tiene que crear la hoja de resultados.');
  return SpreadsheetApp.openById(id);
}

function exigirProfesor_() {
  if (!esProfesor_()) throw new Error('Solo el profesor puede cambiar la configuración.');
}

/** Nombre propuesto para la hoja: el curso escolar (desde agosto se propone el siguiente). */
function nombreCampanaSugerido_() {
  const hoy = new Date(), ano = hoy.getMonth() >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return 'Misiones orbitales · ' + ano + '-' + String(ano + 1).slice(2);
}

/** Hoja de resultados, enlaces, estado de la campaña y tripulación (con correos: no es para proyectar). */
function getConfiguracion() {
  exigirProfesor_();
  let url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { /* sin enlaces: la página los oculta */ }
  const datos = { app: url ? url + '?vista=alumno' : '', puente: url ? url + '?vista=puente' : '', sugerido: nombreCampanaSugerido_(), estados: ESTADOS_CAMPANA, hoja: null,
    faltaDrive: faltaPermisoDrive_(), apuntes: null };
  const idApuntes = PropertiesService.getScriptProperties().getProperty(PROP_APUNTES);
  if (idApuntes) datos.apuntes = { nombre: PropertiesService.getScriptProperties().getProperty(PROP_APUNTES_NOMBRE), url: 'https://drive.google.com/file/d/' + idApuntes + '/view' };
  if (!idHoja_()) return datos;
  const libro = libro_();
  const hoja = hojas_().alumnos;
  const cab = cabecera_(hoja);
  const col = c => cab.indexOf(c);
  const n = hoja.getLastRow() - 2;
  const filas = n > 0 ? hoja.getRange(3, 1, n, cab.length).getValues() : [];
  datos.hoja = { nombre: libro.getName(), url: libro.getUrl() };
  datos.campana = leerCampana_().estado;
  datos.tripulantes = filas.filter(f => f[col('Correo')]).map(f => {
    let estrellas = 0, hechas = 0;
    CATALOGO.forEach(m => { const v = f[col(m.id)]; if (typeof v === 'number') { estrellas += v; hechas++; } });
    const enCurso = MISIONES_POR_ID[f[col('En curso')]];
    const actividad = f[col('Última actividad')];
    return {
      correo: String(f[col('Correo')]), indicativo: String(f[col('Indicativo')] || ''), avatar: !!f[col('Avatar')],
      estrellas: estrellas, hechas: hechas, enCurso: enCurso ? { id: enCurso.id, titulo: enCurso.titulo } : null,
      actividad: actividad instanceof Date ? actividad.getTime() : 0
    };
  });
  return datos;
}

/**
 * Crea una hoja de resultados nueva y pasa a usarla (la primera instalación y cada «Nueva campaña»).
 * La anterior se queda intacta en el Drive del profesor.
 */
function crearHojaResultados(nombre) {
  exigirProfesor_();
  const titulo = String(nombre || '').replace(/[<>]/g, '').trim().slice(0, 80) || nombreCampanaSugerido_();
  return conBloqueo_(() => {
    const libro = SpreadsheetApp.create(titulo);
    const fallo = moverJuntoAlScript_(libro.getId());
    PropertiesService.getScriptProperties().setProperty(PROP_HOJA, libro.getId());
    CacheService.getScriptCache().remove('campana');
    hojas_();
    hojaCampana_();
    SpreadsheetApp.flush();
    const datos = getConfiguracion();
    // solo cuando Google dice que falta el permiso (no cualquier «no tienes permiso») se sugiere autorizar
    if (fallo) datos.avisoCarpeta = 'La hoja se ha creado en «Mi unidad» porque no se pudo mover a la carpeta del script. ' +
      (/required permissions|permisos necesarios/i.test(fallo) ? 'Falta el permiso de Drive: ejecuta la función «autorizar» desde el editor del script y marca la casilla de Google Drive. ' : '') +
      'Mensaje de Google: ' + fallo;
    return datos;
  });
}

/**
 * Apuntes en PDF: el profesor pega el enlace de Drive en la configuración y el servidor se los envía al
 * alumnado (que así no necesita acceso al archivo).
 */
function getApuntes() {
  correo_();
  const id = PropertiesService.getScriptProperties().getProperty(PROP_APUNTES);
  if (!id) throw new Error('Tu profesor todavía no ha añadido los apuntes.');
  const archivo = DriveApp.getFileById(id);
  return { nombre: archivo.getName().replace(/\.pdf$/i, ''), datos: Utilities.base64Encode(archivo.getBlob().getBytes()) };
}

/** Guarda (o quita, con el enlace vacío) el PDF de apuntes a partir de su enlace o ID de Drive. */
function ponerApuntes(enlace) {
  exigirProfesor_();
  const props = PropertiesService.getScriptProperties();
  const texto = String(enlace || '').trim();
  if (!texto) {
    props.deleteProperty(PROP_APUNTES);
    props.deleteProperty(PROP_APUNTES_NOMBRE);
    return getConfiguracion();
  }
  const id = (texto.match(/[-\w]{25,}/) || [])[0];
  if (!id) throw new Error('No reconozco ese enlace. Cópialo desde Drive: botón derecho sobre el PDF › Compartir › Copiar enlace.');
  let archivo, tipo;
  try {
    archivo = DriveApp.getFileById(id);
    tipo = archivo.getMimeType();
  } catch (e) {
    throw new Error('No puedo abrir ese archivo con tu cuenta. Comprueba que el PDF está en tu Drive o compartido contigo.');
  }
  if (tipo !== MimeType.PDF) throw new Error('Ese archivo no es un PDF.');
  if (archivo.getSize() > 25 * 1024 * 1024) throw new Error('El PDF es demasiado grande (como máximo, 25 MB).');
  props.setProperty(PROP_APUNTES, id);
  props.setProperty(PROP_APUNTES_NOMBRE, archivo.getName().replace(/\.pdf$/i, ''));
  return getConfiguracion();
}

/**
 * La hoja se guarda en la misma carpeta que el script; si no se puede, se queda en «Mi unidad»
 * y se devuelve el motivo para avisar al profesor.
 */
function moverJuntoAlScript_(idArchivo) {
  try {
    const carpetas = DriveApp.getFileById(ScriptApp.getScriptId()).getParents();
    if (carpetas.hasNext()) DriveApp.getFileById(idArchivo).moveTo(carpetas.next());
    return null;
  } catch (e) {
    console.warn('No se pudo mover la hoja junto al script: ' + e.message);
    return e.message;
  }
}

/**
 * Ejecútala una vez desde el editor de Apps Script si Google no ha pedido algún permiso
 * (por ejemplo, el de Drive para guardar la hoja junto al script).
 */
function autorizar() {
  // Google pide los permisos con casillas: si alguna se quedó sin marcar, esto vuelve a mostrar la pantalla
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  const script = DriveApp.getFileById(ScriptApp.getScriptId());
  script.setStarred(script.isStarred());               // prueba de escritura en Drive (no cambia nada)
  const carpeta = script.getParents().hasNext() ? script.getParents().next().getName() : 'Mi unidad';
  console.log('Permisos concedidos. Las hojas de resultados se crearán en la carpeta «' + carpeta + '».');
}

/** ¿Tiene el script el permiso completo de Drive? (sin él, la hoja no se puede mover junto al script) */
function faltaPermisoDrive_() {
  try {
    const concedidos = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL).getAuthorizedScopes() || [];
    return concedidos.length > 0 && concedidos.indexOf('https://www.googleapis.com/auth/drive') < 0;
  } catch (e) {
    return false;
  }
}

/**
 * Restablece la app a su estado inicial: desconecta la hoja de resultados (que se queda intacta en el Drive)
 * y el profesor vuelve a ver «Crear hoja de resultados».
 */
function restablecerApp() {
  exigirProfesor_();
  return conBloqueo_(() => {
    PropertiesService.getScriptProperties().deleteProperty(PROP_HOJA);
    CacheService.getScriptCache().remove('campana');
    return getConfiguracion();
  });
}

/** Cambio manual del estado (p. ej. reabrir una campaña terminada por error), sin cuenta atrás. */
function ponerEstadoCampana(estado) {
  exigirProfesor_();
  if (!ESTADOS_CAMPANA[estado]) throw new Error('Estado desconocido.');
  return conBloqueo_(() => {
    const hoja = hojaCampana_(), ahora = new Date();
    hoja.getRange(1, 2).setValue(ESTADOS_CAMPANA[estado]);
    const inicio = hoja.getRange(3, 2).getValue();
    if (estado === 'curso' && (!(inicio instanceof Date) || inicio > ahora)) hoja.getRange(3, 2).setValue(ahora);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('campana');
    return getConfiguracion();
  });
}

/** Acciones sobre un tripulante: desbloquear su misión en curso, reiniciar su progreso o dejarle rediseñar el avatar. */
function accionTripulante(correo, accion) {
  exigirProfesor_();
  return conBloqueo_(() => {
    const hoja = hojas_().alumnos;
    const cab = cabecera_(hoja);
    const encontrado = hoja.getRange('A:A').createTextFinder(String(correo)).matchEntireCell(true).findNext();
    if (!encontrado || encontrado.getRow() < 3) throw new Error('Tripulante no encontrado.');
    const fila = encontrado.getRow();
    const celda = c => hoja.getRange(fila, cab.indexOf(c) + 1);
    if (accion === 'desbloquear') {
      // podrá volver a empezarla (con los mismos datos)
      const id = celda('En curso').getValue();
      if (id) {
        if (cab.indexOf(id) >= 0) celda(id).setValue('');
        celda('En curso').setValue('');
        celda('Inicio misión').setValue('');
        registrar_(correo, id, 'Desbloqueo (profesor)', {});
      }
    } else if (accion === 'reiniciar') {
      // borra misiones y estrellas; el avatar y el indicativo se conservan
      CATALOGO.forEach(m => celda(m.id).setValue(''));
      celda('En curso').setValue('');
      celda('Inicio misión').setValue('');
      actualizarTotales_(hoja, fila, cab);
      registrar_(correo, '-', 'Reinicio (profesor)', {});
    } else if (accion === 'avatar') {
      // al volver a entrar, el alumno pasa por el editor (conserva su indicativo, que podrá revisar)
      celda('Avatar').setValue('');
      registrar_(correo, '-', 'Rediseño de avatar (profesor)', {});
    } else {
      throw new Error('Acción desconocida.');
    }
    return getConfiguracion();
  });
}
