import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import pc from 'picocolors';
import { SecureGenerator, LogType } from '../core/secureGenerator.js';
import { FileReaderUtil, FileData } from '../system/fileReader.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

type View = 'menu' | 'lang' | 'prompt' | 'sim_prompt' | 'processing' | 'result' | 'running_sim' | 'file_path' | 'file_mode' | 'file_prompt';
interface LogEntry { msg: string; type: LogType; }

export default function App() {
  const { exit } = useApp();
  const [view, setView] = useState<View>('menu');
  const [lang, setLang] = useState<'ts' | 'py' | 'web'>('ts');
  const [prompt, setPrompt] = useState('');
  const [filePath, setFilePath] = useState('');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [finalCode, setFinalCode] = useState('');
  const [simPath, setSimPath] = useState('');

  const addLog = (msg: string, type: LogType) => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  const handleFileLoad = async () => {
    setErrorMsg('');
    try {
      addLog(`Cargando archivo: ${filePath}...`, 'info');
      const data = await FileReaderUtil.readFile(filePath);
      setFileData(data);
      setView('file_mode');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleGenerate = async (isSimulation: boolean = false) => {
    setView('processing');
    setLogs([]);
    
    const generator = new SecureGenerator();
    await generator.init();

    let resolvedPrompt = prompt;
    let imgBase64: string | undefined;
    let mimeType: string | undefined;

    // Si hay datos de archivo adjuntos, los inyectamos en el prompt o como imagen de visión
    if (fileData) {
      if (fileData.type === 'text') {
        resolvedPrompt = `[EJERCICIO EXTRAÍDO DEL PDF]\n${fileData.content}\n\n[INSTRUCCIÓN DEL USUARIO]\n${prompt}`;
      } else {
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
        } else {
          setFinalCode(result.code);
          setView('result');
        }
      } else {
        setFinalCode('');
        setView('result');
      }
    } catch (err: any) {
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
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>{pc.bgCyan(pc.black(' SAFEVIBE CLI // PROTOCOL ACTIVE '))}</Text>
        </Box>
        <SelectInput
          items={[
            { label: '[>] Generate Secure Code', value: 'generate' },
            { label: '[~] Run 3D Physics Simulation (AI)', value: 'sim' },
            { label: '[i] Upload Image / PDF Exercise', value: 'upload' },
            { label: '[x] Exit Protocol', value: 'exit' },
          ]}
          onSelect={(item) => {
            if (item.value === 'generate') setView('lang');
            if (item.value === 'sim') {
              setLang('web');
              setView('sim_prompt');
            }
            if (item.value === 'upload') {
              setErrorMsg('');
              setView('file_path');
            }
            if (item.value === 'exit') exit();
          }}
        />
      </Box>
    );
  }

  if (view === 'file_path') {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Enter absolute or relative path to Image (PNG/JPG) or PDF file:</Text>
        <TextInput value={filePath} onChange={setFilePath} onSubmit={handleFileLoad} placeholder="e.g., assets/exercise.png" />
        {errorMsg ? (
          <Box marginTop={1}>
            <Text color="red">Error: {errorMsg}</Text>
          </Box>
        ) : null}
      </Box>
    );
  }

  if (view === 'file_mode') {
    return (
      <Box flexDirection="column">
        <Text color="green">File loaded successfully! Select what to do with the exercise:</Text>
        <SelectInput
          items={[
            { label: '[>] Solve and Simulate (3D Interactive Lab)', value: 'sim_file' },
            { label: '[>] Generate Python script', value: 'py_file' },
            { label: '[>] Generate TypeScript code', value: 'ts_file' },
          ]}
          onSelect={(item) => {
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
          }}
        />
      </Box>
    );
  }

  if (view === 'file_prompt') {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Add specific instructions (e.g., "Add spring constant controls", or leave empty):</Text>
        <TextInput value={prompt} onChange={setPrompt} onSubmit={() => handleGenerate(lang === 'web')} placeholder=">" />
      </Box>
    );
  }

  if (view === 'lang') {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Select target language:</Text>
        <SelectInput
          items={[
            { label: '[TS] TypeScript', value: 'ts' },
            { label: '[PY] Python', value: 'py' },
          ]}
          onSelect={(item) => {
            setLang(item.value as 'ts' | 'py');
            setView('prompt');
          }}
        />
      </Box>
    );
  }

  if (view === 'prompt') {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Describe the code you need:</Text>
        <TextInput value={prompt} onChange={setPrompt} onSubmit={() => handleGenerate(false)} placeholder=">" />
      </Box>
    );
  }

  if (view === 'sim_prompt') {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Describe the 3D physics/math to simulate:</Text>
        <TextInput value={prompt} onChange={setPrompt} onSubmit={() => handleGenerate(true)} placeholder=">" />
      </Box>
    );
  }

  if (view === 'processing') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} width={80}>
        <Text color="cyan" bold>[ SAFEVIBE SCIENTIFIC PROTOCOL RUNNING ]</Text>
        <Box marginTop={1} flexDirection="column">
          {logs.map((log, i) => {
            const color = log.type === 'error' ? 'red' : log.type === 'success' ? 'green' : log.type === 'warn' ? 'yellow' : 'white';
            return <Text key={i} color={color as any}>- {log.msg}</Text>;
          })}
        </Box>
      </Box>
    );
  }

  if (view === 'result') {
    return (
      <Box flexDirection="column">
        {finalCode ? (
          <>
            <Text color="green" bold>[SECURE] Code passed security and compilation.</Text>
            <Box marginY={1} flexDirection="column">
              {finalCode.split('\n').map((line, i) => <Text key={i} color="cyan">{line}</Text>)}
            </Box>
          </>
        ) : (
          <Text color="red" bold>[FATAL] Code generation failed or API configuration incomplete.</Text>
        )}
        <Box marginTop={1}>
          <Text dimColor>Press 'q' to exit...</Text>
        </Box>
      </Box>
    );
  }

  if (view === 'running_sim') {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>[SUCCESS] Scientific simulation opened in your browser!</Text>
        <Box marginTop={1}>
          <Text color="cyan">Press Enter to return to the menu.</Text>
        </Box>
      </Box>
    );
  }

  return null;
}
