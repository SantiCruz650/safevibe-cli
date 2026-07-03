import fs from 'node:fs/promises';
import path from 'node:path';
// 2. CONFIGURACIÓN POR DEFECTO
// Si el archivo no existe, usamos esta para no romper el sistema.
const DEFAULT_CONFIG = {
    ai: {
        provider: 'ollama-local', // Por defecto empezamos en local para proteger tu privacidad
        model: 'llama3',
        apiKey: undefined
    },
    voice: {
        enabled: false, // Desactivado por defecto para ahorrar batería y CPU en tu Chromebook
        sttEngine: 'whisper-cpp',
        ttsEngine: 'piper'
    },
    graphics: {
        asciiRenderFps: 30
    },
    security: {
        autoFixLoop: true
    }
};
// Ruta donde vivirá el archivo config.json (fuera de src, en la raíz del proyecto)
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
// 3. FUNCIONES DE MANEJO (CRUD)
// Leer configuración
export async function loadConfig() {
    try {
        const fileContent = await fs.readFile(CONFIG_PATH, 'utf-8');
        const parsedData = JSON.parse(fileContent);
        // Validación básica: asegurarnos de que las propiedades principales existan
        if (!parsedData.ai || !parsedData.voice) {
            throw new Error('Estructura de config.json inválida');
        }
        return parsedData;
    }
    catch (error) {
        // Si el archivo no existe o está corrupto, devolvemos la configuración por defecto
        // y lo guardamos para que el usuario lo tenga visible.
        await saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }
}
// Guardar configuración
export async function saveConfig(newConfig) {
    // JSON.stringify con "null, 2" hace que el archivo se vea ordenado e indentado
    const jsonString = JSON.stringify(newConfig, null, 2);
    await fs.writeFile(CONFIG_PATH, jsonString, 'utf-8');
}
