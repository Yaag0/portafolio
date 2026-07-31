// --- Vertex shader principal ---
const vertexShaderSource = `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// --- Shader ---
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

float starField(vec2 uv) {
    float rotSpeed = u_time * 0.01; 
    vec2 rotatedUV = rotate2D(uv - vec2(0.5), rotSpeed) + vec2(0.5);

    float stars = 0.0;

    vec2 grid1 = floor(rotatedUV * 80.0);
    vec2 subUV1 = fract(rotatedUV * 80.0) - 0.5;
    float n1 = hash(grid1);
    if (n1 > 0.85) {
        float dist1 = length(subUV1);
        float sparkle1 = sin(u_time * 2.0 + n1 * 6.28) * 0.3 + 0.7;
        stars += smoothstep(0.06, 0.0, dist1) * 0.4 * sparkle1; 
    }

    vec2 grid2 = floor(rotatedUV * 45.0);
    vec2 subUV2 = fract(rotatedUV * 45.0) - 0.5;
    float n2 = hash(grid2);
    if (n2 > 0.91) {
        float dist2 = length(subUV2);
        float sparkle2 = sin(u_time * 1.5 + n2 * 6.28) * 0.3 + 0.7;
        stars += smoothstep(0.08, 0.0, dist2) * 0.7 * sparkle2;
    }

    return clamp(stars, 0.0, 1.0);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p *= vec2(2.1, 2.8);
        amp *= 0.48;
    }
    return value;
}

float cloudShape(vec2 p) {
    vec2 st = p * vec2(1.2, 1.8); 
    vec2 q = vec2(fbm(st + 0.015 * u_time), fbm(st + vec2(5.2, 1.3) + 0.01 * u_time));
    vec2 r = vec2(fbm(st + 3.0 * q + 0.02 * u_time), fbm(st + 3.0 * q + vec2(8.3, 2.8) + 0.015 * u_time));
    return fbm(st + 2.5 * r);
}

float engravingStyle(vec2 fragCoord, float density) {
    if (density < 0.38) return 0.0;
    float lineFreq = 1.2; 
    vec2 pos = fragCoord * lineFreq;
    float lines = abs(sin((pos.y + pos.x * 0.25) * 0.8));

    if (density > 0.78) return 1.0;
    else if (density > 0.58) return lines > 0.3 ? 1.0 : 0.0;
    else if (density > 0.45) return lines > 0.6 ? 1.0 : 0.0;
    else return lines > 0.82 ? 1.0 : 0.0;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 uvAspect = st;
    uvAspect.x *= u_resolution.x / u_resolution.y;

    // 1. Nubes
    float density = cloudShape(uvAspect);
    vec2 center = gl_FragCoord.xy / u_resolution.xy;
    float distFromCenter = distance(center, vec2(0.55, 0.45));
    
    density = smoothstep(0.2, 0.7, density);
    density *= smoothstep(0.1, 0.4, distFromCenter);

    float cloudFade = smoothstep(0.8, 0.0, u_scroll);
    density *= cloudFade;

    float cloudColor = engravingStyle(gl_FragCoord.xy, density);

    // 2. Estrellas
    float stars = starField(uvAspect);
    float starMask = smoothstep(0.4, 0.05, density);
    float finalStars = stars * starMask;

    vec3 finalColor = vec3(clamp(cloudColor + finalStars, 0.0, 1.0));

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
            heroCenter.style.opacity = 1 - progress * 2.5;
            heroCenter.style.transform = `translateY(${progress * -80}px)`;
        }

        if (topRightContacts) {
            topRightContacts.style.opacity = 1 - progress * 2;
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

