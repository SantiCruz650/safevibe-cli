import React, { useState } from 'react';
import { render } from 'ink';
import Box from 'ink-box';

// Este es un componente de React, igual que en una web, pero se dibuja en tu terminal
const SafeVibeUI = () => {
  const [status, setStatus] = useState('STANDBY');
  
  return (
    <Box flexDirection="column" margin={1}>
      {/* Barra Superior */}
      <Box borderStyle="bold" borderColor="cyan" paddingX={2}>
        SAFEVIBE CLI // {status}
      </Box>

      {/* Panel Principal (Aquí iría el código o el chat en el futuro) */}
      <Box height={10} borderStyle="round" borderColor="gray" marginTop={1} paddingX={1}>
        {status === 'STANDBY' ? (
          <Box>Waiting for prompt...</Box>
        ) : (
          <Box>
            <Box color="green">[SECURE] Code validated.</Box>
            <Box marginTop={1} color="cyan">
              class Calculadora {'{'} ... {'}'}
            </Box>
          </Box>
        )}
      </Box>

      {/* Barra de Entrada Inferior */}
      <Box borderStyle="single" borderColor="white" marginTop={1} paddingX={1}>
        <Box color="magenta">{'> '}</Box>
        <Box>_</Box>
      </Box>
    </Box>
  );
};

// Ink toma el componente de React y lo "pinta" en la terminal
render(React.createElement(SafeVibeUI));
