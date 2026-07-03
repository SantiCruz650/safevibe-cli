export function generateHtmlBoilerplate(jsCode) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeVibe Scientific Simulation</title>
  <style>
    body { margin: 0; overflow: hidden; background-color: #111; }
    canvas { display: block; }
    #hud {
      position: absolute; top: 10px; left: 10px;
      color: #e0f0ff; background-color: rgba(0,0,0,0.75);
      padding: 12px 16px; font-family: monospace; font-size: 13px;
      border-radius: 8px; border: 1px solid rgba(100,180,255,0.3);
      pointer-events: none; z-index: 100; white-space: pre-line;
      max-width: 320px; line-height: 1.6;
    }
    #hud input, #hud button, #hud select { pointer-events: all; }
  </style>
</head>
<body>
  <div id="hud"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <script>
    // SafeVibe runtime bootstrap
    var hud = document.getElementById('hud');
    window.addEventListener('resize', function() {
      if (window._svCamera) {
        window._svCamera.aspect = window.innerWidth / window.innerHeight;
        window._svCamera.updateProjectionMatrix();
      }
      if (window._svRenderer) {
        window._svRenderer.setSize(window.innerWidth, window.innerHeight);
      }
    });
    ${jsCode}
  </script>
</body>
</html>`;
}
