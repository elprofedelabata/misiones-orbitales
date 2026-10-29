// Construye la versión web (modo práctica, sin servidor) en docs/index.html a partir de los mismos archivos
// de src/ que usa la app de Apps Script, más web/partida.js, que sustituye al servidor.
// La carpeta docs/ es la que publica GitHub Pages.
// Uso: node herramientas/construir-web.js
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const src = path.join(raiz, 'src');
const leer = f => fs.readFileSync(path.join(src, f), 'utf8');

// código común (misiones y corrección), imágenes y el «servidor» del navegador, antes que la app
const comun = [
  '<script>\n' + leer('Misiones.js') + '\n</script>',
  '<script>\n' + leer('Imagenes.js') + '\n</script>',
  '<script>\n' + fs.readFileSync(path.join(raiz, 'web', 'partida.js'), 'utf8') + '\n</script>'
].join('\n');

const ICONO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="22" fill="#070c1d"/><polygon points="60,10 103,35 103,85 60,110 17,85 17,35" fill="none" stroke="#3fe0ff" stroke-width="8"/><polygon points="60,42 78,60 60,78 42,60" fill="#ffb92e"/></svg>');

let html = leer('Index.html');
html = html.replace('  <base target="_top">\n', '');
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Misiones orbitales · Modo práctica</title>
  <meta name="description" content="Misiones de campo gravitatorio para 2.º de Bachillerato: crea tu astronauta y resuelve misiones con simuladores. Modo práctica. Por El profe de la bata.">
  <meta name="author" content="El profe de la bata · https://elprofedelabata.es/">
  <link rel="icon" href="${ICONO}">`);
let incluidos = 0;
html = html.replace(/<\?!= include\('(\w+)'\); \?>/g, (_, nombre) => {
  incluidos++;
  return (nombre === 'Avatar' ? comun + '\n' : '') + leer(nombre + '.html');
});
if (/<\?/.test(html)) throw new Error('Queda alguna etiqueta de plantilla de Apps Script sin resolver.');

fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'docs', 'index.html'), html);
console.log('docs/index.html ·', incluidos, 'archivos incluidos ·', Math.round(Buffer.byteLength(html) / 1024), 'KB');
