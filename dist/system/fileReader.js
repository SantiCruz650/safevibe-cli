import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
export class FileReaderUtil {
    /**
     * Lee un archivo y extrae su información dependiendo de su tipo (imagen o PDF).
     */
    static async readFile(filePath) {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        try {
            await fs.access(absolutePath);
        }
        catch {
            throw new Error(`El archivo no existe en la ruta especificada: ${filePath}`);
        }
        const ext = path.extname(absolutePath).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
            // Leer imagen y pasarla a Base64
            const buffer = await fs.readFile(absolutePath);
            const base64 = buffer.toString('base64');
            let mimeType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg')
                mimeType = 'image/jpeg';
            else if (ext === '.webp')
                mimeType = 'image/webp';
            return {
                type: 'image',
                content: base64,
                mimeType,
                extension: ext
            };
        }
        else if (ext === '.pdf') {
            // Leer PDF y extraer texto plano
            const dataBuffer = await fs.readFile(absolutePath);
            const data = await pdf(dataBuffer);
            if (!data.text || data.text.trim().length === 0) {
                throw new Error('El archivo PDF parece estar vacío o contener solo imágenes (sin texto extraíble).');
            }
            return {
                type: 'text',
                content: data.text.trim(),
                extension: ext
            };
        }
        else {
            throw new Error(`Formato de archivo no soportado (${ext}). Usa PNG, JPG, JPEG o PDF.`);
        }
    }
}
