// Este es el motor de renderizado puro. No usa React. Usa escapes ANSI.

const WIDTH = 60;
const HEIGHT = 30;
const buffer: string[] = new Array(WIDTH * HEIGHT).fill(' ');

export function clearScreen() {
  // Escape ANSI para limpiar pantalla y poner cursor en 0,0
  process.stdout.write('\x1B[2J\x1B[H');
}

export function setPixel(x: number, y: number, char: string) {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
    buffer[y * WIDTH + x] = char;
  }
}

export function render() {
  let output = '';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      output += buffer[y * WIDTH + x];
    }
    output += '\n';
  }
  // Mover cursor a 0,0 y imprimir el frame completo (evita parpadeo)
  process.stdout.write('\x1B[H' + output);
  // Limpiar buffer para el siguiente frame
  buffer.fill(' ');
}

export function getWidth() { return WIDTH; }
export function getHeight() { return HEIGHT; }
