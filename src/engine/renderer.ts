// Motor de renderizado 3D a 2D para terminal

const WIDTH = 80;
const HEIGHT = 40;
const buffer: string[] = new Array(WIDTH * HEIGHT).fill(' ');

export function clearScreen() {
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
  process.stdout.write('\x1B[H' + output);
  buffer.fill(' ');
}

export function getWidth() { return WIDTH; }
export function getHeight() { return HEIGHT; }

// NUEVA FUNCIÓN: Proyectar punto 3D a 2D con perspectiva
export function project3D(x: number, y: number, z: number, camZ: number = 5) {
  const distance = camZ + z;
  if (distance <= 0) return { x: 0, y: 0, visible: false };
  
  const fov = 20;
  const scale = fov / distance;
  
  const screenX = (x * scale) + WIDTH / 2;
  const screenY = (y * scale) + HEIGHT / 2;
  
  return { x: screenX, y: screenY, visible: true };
}

// NUEVA FUNCIÓN: Dibujar línea 2D (Algoritmo de Bresenham)
export function drawLine(x0: number, y0: number, x1: number, y1: number, char: string = '.') {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = (x0 < x1) ? 1 : -1;
  const sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  while(true) {
    setPixel(x0, y0, char);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

// NUEVA FUNCIÓN: Dibujar línea 3D con perspectiva
export function drawLine3D(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, char: string = '#') {
  const p0 = project3D(x0, y0, z0);
  const p1 = project3D(x1, y1, z1);
  if (p0.visible && p1.visible) {
    drawLine(p0.x, p0.y, p1.x, p1.y, char);
  }
}
