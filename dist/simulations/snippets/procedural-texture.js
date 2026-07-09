function createCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
}
function createGradientTexture(colors, width = 512, height = 512, vertical = true) {
    const { canvas, ctx } = createCanvas(width, height);
    const gradient = vertical
        ? ctx.createLinearGradient(0, 0, 0, height)
        : ctx.createLinearGradient(0, 0, width, 0);
    colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return new THREE.CanvasTexture(canvas);
}
function createNoiseTexture(baseColor, opacity = 0.3, scale = 8) {
    const { canvas, ctx } = createCanvas(256, 256);
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
            const n = Math.sin(x * scale * 0.1 + y * scale * 0.1) * Math.cos(y * scale * 0.05 - x * scale * 0.05);
            const v = Math.floor(128 + 127 * n);
            ctx.fillStyle = `rgba(${v},${v},${v},${opacity * (0.5 + 0.5 * n)})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return new THREE.CanvasTexture(canvas);
}
function createCraterTexture(baseColor = '#a0a0a0', craterColor = '#606060', count = 50) {
    const { canvas, ctx } = createCanvas(512, 512);
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < count; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const r = 5 + Math.random() * 30;
        ctx.fillStyle = craterColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.arc(cx + 2, cy + 2, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}
function createBandedTexture(colors, turbulence = 0.15) {
    const { canvas, ctx } = createCanvas(512, 256);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x++) {
            const nx = x / 512;
            const ny = y / 256;
            const offset = Math.sin(nx * 20) * turbulence;
            const bandIdx = Math.floor((ny + offset) * colors.length) % colors.length;
            ctx.fillStyle = colors[Math.max(0, Math.min(colors.length - 1, bandIdx))];
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return new THREE.CanvasTexture(canvas);
}
function createStarfieldTexture(starCount = 3000) {
    const { canvas, ctx } = createCanvas(1024, 512);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < starCount; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512;
        const brightness = 0.2 + Math.random() * 0.8;
        const size = 0.5 + Math.random() * 2;
        const c = Math.floor(255 * brightness);
        ctx.fillStyle = `rgb(${c},${c},${c})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}
export {};
