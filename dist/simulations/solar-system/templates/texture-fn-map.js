/// <reference types="three" />
// Mapper textureType → funcion (JS PURO - sin tipos TypeScript)
// Esto se concatena al HTML final, debe ser JavaScript válido
var TEXTURE_FN_MAP = {
    sun: function () { return createSunTexture(); },
    mercury: function () { return createMercuryTexture(); },
    venus: function () { return createVenusTexture(); },
    earth: function () { return createEarthTexture(); },
    mars: function () { return createMarsTexture(); },
    jupiter: function () { return createJupiterTexture(); },
    saturn: function () { return createSaturnTexture(); },
    uranus: function () { return createUranusTexture(); },
    neptune: function () { return createNeptuneTexture(); }
};
function getPlanetTexture(textureType) {
    var fn = TEXTURE_FN_MAP[textureType];
    if (!fn) {
        console.warn('TextureType desconocido:', textureType, '- usando Luna');
        if (typeof createMoonTexture === 'function') {
            return createMoonTexture();
        }
        return createMercuryTexture();
    }
    return fn();
}
export {};
