import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React, { useState } from 'react';
import { render } from 'ink';
import Box from 'ink-box';
// Este es un componente de React, igual que en una web, pero se dibuja en tu terminal
const SafeVibeUI = () => {
    const [status, setStatus] = useState('STANDBY');
    return (_jsxs(Box, { flexDirection: "column", margin: 1, children: [_jsxs(Box, { borderStyle: "bold", borderColor: "cyan", paddingX: 2, children: ["SAFEVIBE CLI // ", status] }), _jsx(Box, { height: 10, borderStyle: "round", borderColor: "gray", marginTop: 1, paddingX: 1, children: status === 'STANDBY' ? (_jsx(Box, { children: "Waiting for prompt..." })) : (_jsxs(Box, { children: [_jsx(Box, { color: "green", children: "[SECURE] Code validated." }), _jsxs(Box, { marginTop: 1, color: "cyan", children: ["class Calculadora ", '{', " ... ", '}'] })] })) }), _jsxs(Box, { borderStyle: "single", borderColor: "white", marginTop: 1, paddingX: 1, children: [_jsx(Box, { color: "magenta", children: '> ' }), _jsx(Box, { children: "_" })] })] }));
};
// Ink toma el componente de React y lo "pinta" en la terminal
render(React.createElement(SafeVibeUI));
