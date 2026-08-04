// --- Vertex shader principal ---
const vertexShaderSource = `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// --- Fragment Shader ---
const fragmentShaderSource = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scroll;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 rotate2D(vec2 uv, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c) * uv;
}

float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p *= vec2(2.2, 2.5);
        amp *= 0.48;
    }
    return value;
}

// --- NUBES  ---
float cloudDensity(vec2 p) {
    vec2 st = p * vec2(1.6, 2.0);
    vec2 flow = vec2(u_time * 0.015, sin(u_time * 0.007) * 0.08);
    vec2 q = vec2(fbm(st + flow), fbm(st + flow + vec2(3.2, 2.3)));
    vec2 r = vec2(fbm(st + 3.0 * q + 0.004 * u_time), fbm(st + 3.0 * q + vec2(6.3, 4.8)));
    return fbm(st + 3.0 * r);
}

// --- ESTRELLAS FONDO  ---
float starField(vec2 uv) {
    float rotSpeed = u_time * 0.005; 
    vec2 rotatedUV = rotate2D(uv, rotSpeed);

    float stars = 0.0;

    // estrellas lejanas
    vec2 grid1 = floor(rotatedUV * 85.0);
    vec2 subUV1 = fract(rotatedUV * 85.0) - 0.5;
    float n1 = hash(grid1);
    if (n1 > 0.87) {
        float dist1 = length(subUV1);
        float sparkle1 = sin(u_time * 2.5 + n1 * 6.28) * 0.3 + 0.7;
        stars += smoothstep(0.05, 0.0, dist1) * 0.35 * sparkle1; 
    }

    // estrellas brillantes
    vec2 grid2 = floor(rotatedUV * 50.0);
    vec2 subUV2 = fract(rotatedUV * 50.0) - 0.5;
    float n2 = hash(grid2);
    if (n2 > 0.93) {
        float dist2 = length(subUV2);
        float sparkle2 = sin(u_time * 1.8 + n2 * 6.28) * 0.3 + 0.7;
        stars += smoothstep(0.07, 0.0, dist2) * 0.6 * sparkle2;
    }

    return clamp(stars, 0.0, 1.0);
}

// GRABADO
float engravingStyle(vec2 fragCoord, float density) {
    if (density < 0.22) return 0.0;
    
    float lineFreq = 2.0; 
    vec2 pos = fragCoord * lineFreq;
    float lines = abs(sin((pos.y + pos.x * 0.4) * 0.85));

    if (density > 0.62) return 1.0;
    else if (density > 0.40) return lines > 0.35 ? 1.0 : 0.3;
    else if (density > 0.28) return lines > 0.65 ? 1.0 : 0.0;
    else return lines > 0.82 ? 0.8 : 0.0;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    vec2 centerUV = st - 0.5;
    centerUV.x *= u_resolution.x / u_resolution.y;

    float distToCenter = length(centerUV);
    float angleToCenter = atan(centerUV.y, centerUV.x);

    // --- LUZ  ---
    float lightRotSpeed = u_time * 0.01; 
    vec2 rotCenterUV = rotate2D(centerUV, lightRotSpeed);

    vec2 uvRot1 = rotate2D(rotCenterUV, 0.785398); 
    vec2 uvRot2 = rotate2D(rotCenterUV, 0.0);      
    
    float rayH1 = 1.0 / (abs(uvRot1.y) * 55.0 + 0.08);
    float rayV1 = 1.0 / (abs(uvRot1.x) * 55.0 + 0.08);
    float rayH2 = 1.0 / (abs(uvRot2.y) * 65.0 + 0.08);
    float rayV2 = 1.0 / (abs(uvRot2.x) * 65.0 + 0.08);
    
    float starCross = ((rayH1 + rayV1) * 0.6 + (rayH2 + rayV2) * 0.4) * exp(-distToCenter * 7.5);
    float coreFlash = 0.0018 / (distToCenter * distToCenter + 0.001);
    
    vec3 lightBeamColor = mix(vec3(4.0, 4.0, 4.0), vec3(3.0, 3.5, 4.2), sin(angleToCenter * 2.0 + u_time * 0.1) * 0.5 + 0.5);
    float lightMask = (starCross * 0.45 + coreFlash) * 3.0;
    vec3 underlyingLight = lightBeamColor * lightMask;

    // --- DENSIDAD DE NUBES ---
    vec2 cloudUV = (gl_FragCoord.xy / u_resolution.xy);
    cloudUV.x *= u_resolution.x / u_resolution.y;
    
    float rawCloud = cloudDensity(cloudUV);
    float cloudFade = smoothstep(1.0, 0.0, u_scroll);
    
    float centerDensityBoost = smoothstep(0.5, 0.0, distToCenter) * 0.35;
    float density = (smoothstep(0.25, 0.8, rawCloud) + centerDensityBoost) * cloudFade;

    float crackMask = smoothstep(0.40, 0.12, density);
    vec3 filteredLight = underlyingLight * crackMask;

    // --- COLOR FONDO+ ---
    vec3 deepSpaceColor = vec3(0.039, 0.102, 0.184); 
    
    float stars = starField(centerUV);
    float starOclusion = smoothstep(0.4, 0.05, density); 
    vec3 starColor = vec3(stars * starOclusion * 1.2); 

    vec3 finalColor = deepSpaceColor + starColor + filteredLight;

    // --- TINTA DE LAS NUBES ---
    float cloudMask = engravingStyle(gl_FragCoord.xy, density);
    vec3 cloudInkColor = vec3(0.006, 0.008, 0.014); 
    
    finalColor = mix(finalColor, cloudInkColor, cloudMask);

    // --- BORDES ---
    float edgeGradient = smoothstep(0.24, 0.35, density) * (1.0 - smoothstep(0.35, 0.46, density));
    float strictCollision = edgeGradient * crackMask * clamp(lightMask * 0.8, 0.0, 1.0) * 12.0;
    
    vec3 rimLightColor = vec3(0.9, 0.95, 1.0); 
    finalColor += rimLightColor * strictCollision;

    finalColor = clamp(finalColor, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- Inicio ---
function init() {
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uScroll = gl.getUniformLocation(program, "u_scroll");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    const heroCenter = document.querySelector('.hero-center');
    const topRightContacts = document.querySelector('.top-right-contacts');

    function onScroll() {
        const scrollTop = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        
        if (maxScroll <= 0) return;

        const progress = Math.min(Math.max(scrollTop / maxScroll, 0.0), 1.0);
        gl.uniform1f(uScroll, progress);

        if (heroCenter) {
            const rawFade = (progress * 2.8 - 0.25) / (0.36 - 0.25);
            const opacityFade = 1.0 - Math.min(Math.max(rawFade, 0.0), 1.0);
            heroCenter.style.opacity = opacityFade;
            heroCenter.style.pointerEvents = opacityFade === 0 ? 'none' : 'auto';
        }

        if (topRightContacts) {
            const rawFadeContacts = (progress * 2.5 - 0.2) / (0.4 - 0.2);
            topRightContacts.style.opacity = 1.0 - Math.min(Math.max(rawFadeContacts, 0.0), 1.0);
        }
    }

    window.addEventListener('scroll', onScroll);
    onScroll();

    let start = performance.now();
    function render() {
        const now = (performance.now() - start) * 0.001;
        gl.uniform1f(uTime, now);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }

    render();
}

window.onload = init;