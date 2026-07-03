import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
export class FileManager {
    tempDir;
    constructor() {
        // Creamos una carpeta temporal segura en el directorio tmp del sistema Linux
        this.tempDir = path.join(os.tmpdir(), 'safevibe-sandbox');
    }
    // Inicializa el entorno seguro (sandbox)
    async initSandbox() {
        await fs.mkdir(this.tempDir, { recursive: true });
    }
    // Escribe el código generado por la IA en un archivo temporal
    async writeCode(filename, code) {
        const filePath = path.join(this.tempDir, filename);
        await fs.writeFile(filePath, code, 'utf-8');
        return filePath;
    }
    // Limpia el sandbox (buena práctica de seguridad: no dejar rastros)
    async cleanup() {
        await fs.rm(this.tempDir, { recursive: true, force: true });
    }
}
