export function generateHtmlBoilerplate(jsCode: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeVibe Scientific Simulation</title>
  <style>
    body { margin: 0; overflow: hidden; background-color: #000; }
    canvas { display: block; }
    #hud { position: absolute; top: 10px; left: 10px; color: white; background-color: rgba(0,0,0,0.7); padding: 10px; font-family: monospace; border-radius: 5px; pointer-events: none; z-index: 100; white-space: pre; }
  </style>
</head>
<body>
  <div id="hud"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <script>
    const hud = document.getElementById('hud');
    ${jsCode}
  </script>
</body>
</html>`;
}
