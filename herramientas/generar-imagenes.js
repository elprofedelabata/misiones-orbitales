// Genera src/Imagenes.js a partir de las imágenes de /imagenes.
// Cada archivo debe empezar por el código de la misión: «E3-ascenso-orbital.webp» → misión E3.
// Uso: node herramientas/generar-imagenes.js
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const carpeta = path.join(raiz, 'imagenes');
const tipos = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const mapa = {};
fs.readdirSync(carpeta).sort().forEach(f => {
  const ext = path.extname(f).toLowerCase();
  const id = f.split('-')[0];
  if (!tipos[ext] || !id) return;
  mapa[id] = 'data:' + tipos[ext] + ';base64,' + fs.readFileSync(path.join(carpeta, f)).toString('base64');
  console.log(id, '←', f, Math.round(fs.statSync(path.join(carpeta, f)).size / 1024) + ' KB');
});
const salida = `/**
 * Imágenes ilustrativas de las misiones (generado por herramientas/generar-imagenes.js; no editar a mano).
 * Se envían al navegador una sola vez, en segundo plano, cuando se abre el registro de misiones.
 */
const IMAGENES_MISION = ${JSON.stringify(mapa, null, 2)};

function getImagenes() {
  return IMAGENES_MISION;
}
`;
fs.writeFileSync(path.join(raiz, 'src', 'Imagenes.js'), salida);
console.log('src/Imagenes.js:', Math.round(salida.length / 1024) + ' KB');
