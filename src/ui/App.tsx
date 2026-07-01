import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import pc from 'picocolors';
import { SecureGenerator, LogType } from '../core/secureGenerator.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

type View = 'menu' | 'lang' | 'prompt' | 'sim_prompt' | 'processing' | 'result' | 'running_sim';
interface LogEntry { msg: string; type: LogType; }

export default function App() {
  const { exit } = useApp();
  const [view, setView] = useState<View>('menu');
  const [lang, setLang] = useState<'ts' | 'py' | 'web'>('ts');
  const [prompt, setPrompt] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [finalCode, setFinalCode] = useState('');
  const [simPath, setSimPath] = useState('');

  const addLog = (msg: string, type: LogType) => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  const handleGenerate = async (isSimulation: boolean = false) => {
    setView('processing');
    setLogs([]);
    
    const generator = new SecureGenerator();
    await generator.init();
    
    const result = await generator.generate(lang, prompt, addLog, isSimulation);
    
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
  };

  useEffect(() => {
    if (view === 'running_sim' && simPath) {
      // Abrimos el navegador. Ignoramos el 'exit' porque xdg-open termina al instante.
      spawn('xdg-open', [simPath], { stdio: 'ignore' });
    }
  }, [view, simPath]);

  // Aquí capturamos las teclas correctamente
  useInput((input) => {
    if (view === 'result' && input === 'q') {
      exit();
    }
    // Si estamos en la simulación, Enter nos devuelve al menú
    if (view === 'running_sim' && input === 'return') {
      setView('menu');
      setPrompt(''); // Limpiamos el prompt para la próxima vez
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
            { label: '[x] Exit Protocol', value: 'exit' },
          ]}
          onSelect={(item) => {
            if (item.value === 'generate') setView('lang');
            if (item.value === 'sim') {
              setLang('web');
              setView('sim_prompt');
            }
            if (item.value === 'exit') exit();
          }}
        />
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
        <Text color="cyan">Describe the 3D physics to simulate:</Text>
        <TextInput value={prompt} onChange={setPrompt} onSubmit={() => handleGenerate(true)} placeholder=">" />
      </Box>
    );
  }

  if (view === 'processing') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} width={80}>
        <Text color="cyan" bold>[ REACT PROTOCOL RUNNING ]</Text>
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
          <Text color="red" bold>[FATAL] Code generation failed after max retries.</Text>
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
