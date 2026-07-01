const WIDTH = 40;
const HEIGHT = 20;

let A = 0;
let B = 0;

const charRamp = ".,-~:;=!*#$@";

setInterval(() => {
  try {
    const b = new Array(WIDTH * HEIGHT).fill(' ');
    const z = new Array(WIDTH * HEIGHT).fill(0);

    for (let j = 0; j < 6.28; j += 0.07) {
      for (let i = 0; i < 6.28; i += 0.02) {
        const c = Math.sin(i);
        const d = Math.cos(j);
        const e = Math.sin(A);
        const f = Math.sin(j);
        const g = Math.cos(A);
        const h = d + 2;
        const D = 1 / (c * h * e + f * g + 5);
        const l = Math.cos(i);
        const m = Math.cos(B);
        const n = Math.sin(B);
        const t = c * h * g - f * e;

        const x = Math.floor(WIDTH / 2 + (WIDTH / 4) * D * (l * h * m - t * n));
        const y = Math.floor(HEIGHT / 2 + (HEIGHT / 4) * D * (l * h * n + t * m));
        const o = Math.floor(x + WIDTH * y);
        const N = Math.floor(8 * ((f * e - c * d * g) * m - c * d * e - f * g - l * d * n));

        if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) {
          if (D > z[o]) {
            z[o] = D;
            b[o] = charRamp[Math.max(0, Math.min(charRamp.length - 1, N))];
          }
        }
      }
    }

    let output = '\x1B[H'; // Mover cursor a la esquina superior izquierda
    for (let k = 0; k < WIDTH * HEIGHT; k++) {
      output += k % WIDTH ? b[k] : b[k] + '\n';
    }
    process.stdout.write(output);
    
    A += 0.04;
    B += 0.02;
  } catch (err) {
    // Si hay un error, lo mostramos y detenemos el bucle
    clearInterval(1);
    console.error('\nError en el motor:', err);
    process.exit(1);
  }
}, 33); // ~30 FPS
