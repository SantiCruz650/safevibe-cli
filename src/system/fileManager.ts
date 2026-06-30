import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export class FileManager {
  private tempDir: string;

  constructor() {
    // Creamos una carpeta temporal segura en el directorio tmp del sistema Linux
    this.tempDir = path.join(os.tmpdir(), 'safevibe-sandbox');
  }

  // Inicializa el entorno seguro (sandbox)
  async initSandbox(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  // Escribe el código generado por la IA en un archivo temporal
  async writeCode(filename: string, code: string): Promise<string> {
    const filePath = path.join(this.tempDir, filename);
    await fs.writeFile(filePath, code, 'utf-8');
    return filePath;
  }

  // Limpia el sandbox (buena práctica de seguridad: no dejar rastros)
  async cleanup(): Promise<void> {
    await fs.rm(this.tempDir, { recursive: true, force: true });
  }
}
