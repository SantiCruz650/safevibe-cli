/// <reference types="three" />
// ===== HELPERS SISTEMA SOLAR (Three.js r128) =====
// Estructura devuelta por createPlanetMesh:
//   { mesh: THREE.Mesh, pivot: THREE.Object3D, group: THREE.Group }
function createOrbitLine(radius, color) {
    var segments = 128;
    var points = [];
    for (var i = 0; i <= segments; i++) {
        var a = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    var geo = new THREE.BufferGeometry().setFromPoints(points);
    var mat = new THREE.LineBasicMaterial({
        color: color || 0x444444, transparent: true, opacity: 0.5
    });
    return new THREE.Line(geo, mat);
}
function createOrbitalPivot(distance, initialAngle) {
    var pivot = new THREE.Object3D();
    pivot.position.set(0, 0, 0);
    pivot.rotation.y = initialAngle || 0;
    return pivot;
}
function updateOrbitalPosition(pivot, dt, period, axialTilt) {
    // Velocidad orbital inversamente proporcional al periodo
    var orbitalSpeed = (2 * Math.PI) / Math.max(period, 1);
    pivot.rotation.y += orbitalSpeed * dt * 0.5;
}
function createPlanetMesh(radius, texture, distance, color, config) {
    config = config || {};
    // Pivot orbital (centro del sistema)
    var pivot = new THREE.Object3D();
    scene.add(pivot);
    // Group del planeta (se mueve a la distancia orbital)
    var group = new THREE.Group();
    group.position.x = distance;
    pivot.add(group);
    // Malla del planeta
    var geo = new THREE.SphereGeometry(Math.max(0.1, radius), 64, 64);
    var mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.85,
        metalness: 0.05
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (config.axialTilt)
        mesh.rotation.z = THREE.MathUtils.degToRad(config.axialTilt);
    group.add(mesh);
    return { mesh: mesh, pivot: pivot, group: group };
}
function createSun(radius, texture, config) {
    config = config || {};
    var geo = new THREE.SphereGeometry(radius, 64, 64);
    var mat = new THREE.MeshBasicMaterial({ map: texture });
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    // Glow
    var glowGeo = new THREE.SphereGeometry(radius * 1.3, 32, 32);
    var glowMat = new THREE.MeshBasicMaterial({
        color: 0xff8800, transparent: true, opacity: 0.25, side: THREE.BackSide
    });
    var glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);
    // Luz puntual
    var light = new THREE.PointLight(0xffffff, 2, 1000);
    light.position.set(0, 0, 0);
    scene.add(light);
    return { mesh: mesh, glow: glow, light: light };
}
function createMoonMesh(radius, texture, orbitalDistance, color) {
    var pivot = new THREE.Object3D();
    scene.add(pivot);
    var geo = new THREE.SphereGeometry(Math.max(0.05, radius), 32, 32);
    var mat = new THREE.MeshStandardMaterial({
        map: texture, roughness: 0.95, color: color || 0xffffff
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = orbitalDistance;
    pivot.add(mesh);
    return { mesh: mesh, pivot: pivot };
}
function setupRaycaster(camera, domElement, meshes, onClick) {
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    domElement.addEventListener('click', function (event) {
        var rect = domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        var intersects = raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0 && onClick) {
            onClick(intersects[0].object, intersects[0]);
        }
    });
    return raycaster;
}
function setupCameraFollow(camera, controls, target, distance) {
    if (!target)
        return;
    var pos = new THREE.Vector3();
    target.getWorldPosition(pos);
    camera.position.set(pos.x + distance, pos.y + distance * 0.5, pos.z + distance);
    controls.target.copy(pos);
    controls.update();
}
function createAtmosphereGlow(planetMesh, color, intensity) {
    var radius = planetMesh.geometry.parameters.radius;
    var atmGeo = new THREE.SphereGeometry(radius * 1.08, 32, 32);
    var atmMat = new THREE.MeshBasicMaterial({
        color: color || 0x4488ff, transparent: true, opacity: 0.2,
        side: THREE.BackSide
    });
    var atm = new THREE.Mesh(atmGeo, atmMat);
    planetMesh.parent.add(atm);
    return atm;
}
export {};
