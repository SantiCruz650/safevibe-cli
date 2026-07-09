export function generateHtmlBoilerplate(jsCode) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeVibe Scientific Simulation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a1a; font-family: monospace; }
    canvas { display: block; }
    #hud {
      position: absolute; top: 12px; left: 12px;
      color: #c8e0ff; background: rgba(8,12,30,0.82);
      padding: 14px 18px; font-size: 13px; line-height: 1.7;
      border-radius: 10px; border: 1px solid rgba(80,160,255,0.2);
      pointer-events: none; z-index: 100; white-space: pre;
      max-width: 360px; backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      font-family: 'Consolas','Courier New',monospace;
    }
    #hud input, #hud button, #hud select { pointer-events: all; cursor: pointer; }
    #hud input[type="range"] { width: 100%; margin: 4px 0; }
    #fps {
      position: absolute; bottom: 12px; right: 16px;
      color: rgba(255,255,255,0.25); font-size: 11px;
      z-index: 100; pointer-events: none;
      font-family: 'Consolas','Courier New',monospace;
    }
  </style>
</head>
<body>
  <div id="hud"></div>
  <div id="fps"></div>

  <!-- Fisica: Cannon.js 0.6.2 (global CANNON). Script clasico: corre ANTES del modulo. -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"></script>

  <!-- Three.js r160: import map (NO existe three.min.js ni examples/js en r160) -->
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>

  <script type="module">
    import * as THREE_CORE   from 'three';
    import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
    import { UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

    // import * as THREE produce un Module namespace de solo-lectura. Hacemos una copia mutable
    // para poder colgar los addons (OrbitControls, etc.) sin tocar el namespace congelado.
    const THREE_NS = Object.assign({}, THREE_CORE);
    THREE_NS.OrbitControls   = OrbitControls;
    THREE_NS.EffectComposer  = EffectComposer;
    THREE_NS.RenderPass      = RenderPass;
    THREE_NS.UnrealBloomPass = UnrealBloomPass;

    // A partir de aqui TODO el codigo (boilerplate + IA) usa esta copia como "THREE".
    const THREE = THREE_NS;
    window.THREE = THREE;


    // ================================================================
    // SafeVibe Runtime r160 — Motor 3D Cinematográfico
    // scene, camera, renderer, controls, composer, clock ya existen.
    // Post-processing con UnrealBloom activo.
    // ================================================================

    var hud = document.getElementById('hud');
    var fpsEl = document.getElementById('fps');

    /* --- Escena --- */
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000008);
    scene.fog = new THREE.FogExp2(0x000008, 0.0015);

    /* --- Camara --- */
    var camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 5000);
    camera.position.set(0, 8, 28);

    /* --- Renderer r160 (color management moderno) --- */
    var renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;  // r160 API
    document.body.appendChild(renderer.domElement);

    /* --- Post-processing: UnrealBloom --- */
    var composer = new THREE.EffectComposer(renderer);
    var renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    var bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.8,    // strength: cuánto brilla
      0.4,    // radius: tamaño del halo
      0.85    // threshold: solo brilla lo más luminoso (planetas, sol)
    );
    composer.addPass(bloomPass);

    /* --- Controles Orbitales --- */
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = 1000;
    controls.target.set(0, 0, 0);

    /* --- Iluminacion PBR --- */
    var ambientLight = new THREE.AmbientLight(0x334466, 0.25);
    scene.add(ambientLight);

    var dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(15, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    (function(d){
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
    })(50);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 100;
    scene.add(dirLight);

    var fillLight = new THREE.DirectionalLight(0x4488ff, 0.2);
    fillLight.position.set(-15, 0, 15);
    scene.add(fillLight);

    var rimLight = new THREE.DirectionalLight(0x88ccff, 0.1);
    rimLight.position.set(0, -10, -20);
    scene.add(rimLight);

    /* --- 10,000 Estrellas de Fondo --- */
    (function createStarfield() {
      var starGeo = new THREE.BufferGeometry();
      var starCount = 10000;
      var starPos = new Float32Array(starCount * 3);
      var starColors = new Float32Array(starCount * 3);
      for (var i = 0; i < starCount; i++) {
        // Distribución esférica uniforme
        var r = 800 + Math.random() * 400;
        var theta = Math.random() * Math.PI * 2;
        var phi = Math.acos(2 * Math.random() - 1);
        starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPos[i * 3 + 2] = r * Math.cos(phi);
        // Colores variados: blancas, azuladas, amarillentas
        var c = Math.random();
        if (c > 0.95) { // azules (5%)
          starColors[i*3] = 0.7; starColors[i*3+1] = 0.85; starColors[i*3+2] = 1.0;
        } else if (c > 0.85) { // amarillas (10%)
          starColors[i*3] = 1.0; starColors[i*3+1] = 0.92; starColors[i*3+2] = 0.7;
        } else if (c > 0.75) { // naranjas (10%)
          starColors[i*3] = 1.0; starColors[i*3+1] = 0.75; starColors[i*3+2] = 0.5;
        } else { // blancas (75%)
          var v = 0.85 + Math.random() * 0.15;
          starColors[i*3] = v; starColors[i*3+1] = v; starColors[i*3+2] = v;
        }
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
      var starMat = new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        fog: false
      });
      var starfield = new THREE.Points(starGeo, starMat);
      scene.add(starfield);
    })();

    /* --- Reloj --- */
    var clock = new THREE.Clock();

    /* --- FPS Tracker --- */
    var _svFC = 0;
    var _svLastFps = performance.now();

    /* --- Resize (incluye composer) --- */
    addEventListener('resize', function(){
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
      bloomPass.resolution.set(innerWidth, innerHeight);
    });

    /* --- Default animate (usa composer, no renderer directo) --- */
    function __svAnimate() {
      requestAnimationFrame(__svAnimate);
      var dt = Math.min(clock.getDelta(), 0.05);
      controls.update();
      composer.render();  // ← usa composer para activar bloom
      _svFC++;
      var now = performance.now();
      if (now - _svLastFps >= 500) {
        fpsEl.textContent = Math.round(_svFC * 2) + ' FPS';
        _svFC = 0;
        _svLastFps = now;
      }
    }

    // CRITICO: en modulos, 'var scene' NO crea window.scene automaticamente.
    // El validador lee window.scene / window.renderer / window.camera -> exponerlos a mano.
    window.scene    = scene;
    window.camera   = camera;
    window.renderer = renderer;
    window.composer = composer;

    // ================================================================
    //  INICIO — CODIGO GENERADO POR IA
    // ================================================================
 ${jsCode}
    // ================================================================
    //  FIN — CODIGO GENERADO POR IA
    // ================================================================

    // Si el codigo de la IA definio su propio animate(), usarlo; si no, usar el del boilerplate.
    (typeof animate === 'function' ? animate : __svAnimate)();
  </script>
</body>
</html>`;
}
