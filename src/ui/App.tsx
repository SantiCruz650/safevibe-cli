import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import pc from 'picocolors';
import { SecureGenerator, LogType } from '../core/secureGenerator.js';

type View = 'menu' | 'lang' | 'prompt' | 'processing' | 'result';
interface LogEntry { msg: string; type: LogType; }

export default function App() {
  const { exit } = useApp();
  const [view, setView] = useState<View>('menu');
  const [lang, setLang] = useState<'ts' | 'py'>('ts');
  const [prompt, setPrompt] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [finalCode, setFinalCode] = useState('');

  const addLog = (msg: string, type: LogType) => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  const handleGenerate = async () => {
    setView('processing');
    setLogs([]);
    const generator = new SecureGenerator();
    await generator.init();
    const result = await generator.generate(lang, prompt, addLog);
    if (result.success) {
      setFinalCode(result.code);
    } else {
      setFinalCode('');
    }
    setView('result');
  };

  useInput((input) => {
    if (view === 'result' && input === 'q') {
      exit();
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
            { label: '[x] Exit Protocol', value: 'exit' },
          ]}
          onSelect={(item) => {
            if (item.value === 'generate') setView('lang');
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
        <TextInput value={prompt} onChange={setPrompt} onSubmit={handleGenerate} placeholder=">" />
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

  return null;
}
