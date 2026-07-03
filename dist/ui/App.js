import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import pc from 'picocolors';
import { SecureGenerator } from '../core/secureGenerator.js';
import { FileReaderUtil } from '../system/fileReader.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
export default function App() {
    const { exit } = useApp();
    const [view, setView] = useState('menu');
    const [lang, setLang] = useState('ts');
    const [prompt, setPrompt] = useState('');
    const [filePath, setFilePath] = useState('');
    const [fileData, setFileData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [logs, setLogs] = useState([]);
    const [finalCode, setFinalCode] = useState('');
    const [simPath, setSimPath] = useState('');
    const addLog = (msg, type) => {
        setLogs(prev => [...prev, { msg, type }]);
    };
    const handleFileLoad = async () => {
        setErrorMsg('');
        try {
            addLog(`Cargando archivo: ${filePath}...`, 'info');
            const data = await FileReaderUtil.readFile(filePath);
            setFileData(data);
            setView('file_mode');
        }
        catch (err) {
            setErrorMsg(err.message);
        }
    };
    const handleGenerate = async (isSimulation = false) => {
        setView('processing');
        setLogs([]);
        const generator = new SecureGenerator();
        await generator.init();
        let resolvedPrompt = prompt;
        let imgBase64;
        let mimeType;
        // Si hay datos de archivo adjuntos, los inyectamos en el prompt o como imagen de visión
        if (fileData) {
            if (fileData.type === 'text') {
                resolvedPrompt = `[EJERCICIO EXTRAÍDO DEL PDF]\n${fileData.content}\n\n[INSTRUCCIÓN DEL USUARIO]\n${prompt}`;
            }
            else {
                imgBase64 = fileData.content;
                mimeType = fileData.mimeType;
            }
        }
        try {
            const result = await generator.generate(lang, resolvedPrompt, addLog, isSimulation, imgBase64, mimeType);
            if (result.success) {
                if (isSimulation) {
                    const tempSimPath = path.join(process.cwd(), 'safevibe_output', 'simulation.html');
                    await fs.mkdir(path.dirname(tempSimPath), { recursive: true });
                    await fs.writeFile(tempSimPath, result.code);
                    setSimPath(tempSimPath);
                    setView('running_sim');
                }
                else {
                    setFinalCode(result.code);
                    setView('result');
                }
            }
            else {
                setFinalCode('');
                setView('result');
            }
        }
        catch (err) {
            addLog(`Error fatal: ${err.message}`, 'error');
            setFinalCode('');
            setView('result');
        }
    };
    useEffect(() => {
        if (view === 'running_sim' && simPath) {
            spawn('xdg-open', [simPath], { stdio: 'ignore' });
        }
    }, [view, simPath]);
    useInput((input) => {
        if (view === 'result' && input === 'q') {
            exit();
        }
        if (view === 'running_sim' && input === 'return') {
            setView('menu');
            setPrompt('');
            setFilePath('');
            setFileData(null);
        }
    });
    if (view === 'menu') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: "cyan", bold: true, children: pc.bgCyan(pc.black(' SAFEVIBE CLI // PROTOCOL ACTIVE ')) }) }), _jsx(SelectInput, { items: [
                        { label: '[>] Generate Secure Code', value: 'generate' },
                        { label: '[~] Run 3D Physics Simulation (AI)', value: 'sim' },
                        { label: '[i] Upload Image / PDF Exercise', value: 'upload' },
                        { label: '[x] Exit Protocol', value: 'exit' },
                    ], onSelect: (item) => {
                        if (item.value === 'generate')
                            setView('lang');
                        if (item.value === 'sim') {
                            setLang('web');
                            setView('sim_prompt');
                        }
                        if (item.value === 'upload') {
                            setErrorMsg('');
                            setView('file_path');
                        }
                        if (item.value === 'exit')
                            exit();
                    } })] }));
    }
    if (view === 'file_path') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "cyan", children: "Enter absolute or relative path to Image (PNG/JPG) or PDF file:" }), _jsx(TextInput, { value: filePath, onChange: setFilePath, onSubmit: handleFileLoad, placeholder: "e.g., assets/exercise.png" }), errorMsg ? (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "red", children: ["Error: ", errorMsg] }) })) : null] }));
    }
    if (view === 'file_mode') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "green", children: "File loaded successfully! Select what to do with the exercise:" }), _jsx(SelectInput, { items: [
                        { label: '[>] Solve and Simulate (3D Interactive Lab)', value: 'sim_file' },
                        { label: '[>] Generate Python script', value: 'py_file' },
                        { label: '[>] Generate TypeScript code', value: 'ts_file' },
                    ], onSelect: (item) => {
                        if (item.value === 'sim_file') {
                            setLang('web');
                            setView('file_prompt');
                        }
                        if (item.value === 'py_file') {
                            setLang('py');
                            setView('file_prompt');
                        }
                        if (item.value === 'ts_file') {
                            setLang('ts');
                            setView('file_prompt');
                        }
                    } })] }));
    }
    if (view === 'file_prompt') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "cyan", children: "Add specific instructions (e.g., \"Add spring constant controls\", or leave empty):" }), _jsx(TextInput, { value: prompt, onChange: setPrompt, onSubmit: () => handleGenerate(lang === 'web'), placeholder: ">" })] }));
    }
    if (view === 'lang') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "cyan", children: "Select target language:" }), _jsx(SelectInput, { items: [
                        { label: '[TS] TypeScript', value: 'ts' },
                        { label: '[PY] Python', value: 'py' },
                    ], onSelect: (item) => {
                        setLang(item.value);
                        setView('prompt');
                    } })] }));
    }
    if (view === 'prompt') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "cyan", children: "Describe the code you need:" }), _jsx(TextInput, { value: prompt, onChange: setPrompt, onSubmit: () => handleGenerate(false), placeholder: ">" })] }));
    }
    if (view === 'sim_prompt') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "cyan", children: "Describe the 3D physics/math to simulate:" }), _jsx(TextInput, { value: prompt, onChange: setPrompt, onSubmit: () => handleGenerate(true), placeholder: ">" })] }));
    }
    if (view === 'processing') {
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", padding: 1, width: 80, children: [_jsx(Text, { color: "cyan", bold: true, children: "[ SAFEVIBE SCIENTIFIC PROTOCOL RUNNING ]" }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: logs.map((log, i) => {
                        const color = log.type === 'error' ? 'red' : log.type === 'success' ? 'green' : log.type === 'warn' ? 'yellow' : 'white';
                        return _jsxs(Text, { color: color, children: ["- ", log.msg] }, i);
                    }) })] }));
    }
    if (view === 'result') {
        return (_jsxs(Box, { flexDirection: "column", children: [finalCode ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: "green", bold: true, children: "[SECURE] Code passed security and compilation." }), _jsx(Box, { marginY: 1, flexDirection: "column", children: finalCode.split('\n').map((line, i) => _jsx(Text, { color: "cyan", children: line }, i)) })] })) : (_jsx(Text, { color: "red", bold: true, children: "[FATAL] Code generation failed or API configuration incomplete." })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press 'q' to exit..." }) })] }));
    }
    if (view === 'running_sim') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "green", bold: true, children: "[SUCCESS] Scientific simulation opened in your browser!" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Press Enter to return to the menu." }) })] }));
    }
    return null;
}
