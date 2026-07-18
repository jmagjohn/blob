const ball = document.getElementById("stress-ball");
const blobCanvas = document.getElementById("blob-canvas");
const floatingLayer = document.getElementById("floating-layer");
const quoteBox = document.getElementById("quote-box");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const emojis = [
  "✨", "🌿", "💫", "🌙", "⭐", "🫧",
  "🩵", "🌸", "☁️", "🌈", "🍃", "💜",
];

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// --- Quotes ---

const quotes = [
  "You are allowed to take up space exactly as you are right now.",
  "You have survived every single hard day so far. That is not an accident.",
  "Rest is not a reward. Rest is a requirement.",
  "You don't have to fix everything today. Showing up is enough.",
  "Your worth is not tied to how productive you are.",
  "You are allowed to feel tired and still be proud of yourself.",
  "Your feelings are valid, even when they don't make sense to anyone else.",
  "You are learning, not failing.",
  "You haven't missed your chance. Life is not a single deadline.",
  "You are allowed to be a work in progress and still be worthy of love.",
  "Small steps count. Microscopic steps also count.",
  "You are not behind. You are on your own timeline.",
  "It's okay if the best you can do today is breathe.",
  "You can start again at any moment. There is no penalty.",
  "Your brain's harshest thoughts are not objective truth.",
  "You deserve gentleness—from yourself too.",
  "You are allowed to say no and still be a good person.",
  "Even on days you feel stuck, you are still growing.",
  "Progress is rarely loud. Quiet effort still counts.",
  "You have handled so much already. You can handle this too.",
  "You do not need to earn your own kindness.",
  "You are more than your worst moment.",
  "It's okay if today is about survival, not success.",
  "Future-you is cheering for you right now.",
  "You are allowed to take breaks without calling it quitting.",
  "Your pace is valid. Your journey is yours.",
  "You are not a burden for needing support.",
  "You can hold both: gratitude for what you have and hope for more.",
  "Right now, you are enough, even if nothing else changes.",
  "You are allowed to rest without explaining why.",
];

let quoteOrder = [];
let quoteIndex = 0;

function shuffleQuotes() {
  quoteOrder = quotes.map((_, i) => i);
  for (let i = quoteOrder.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [quoteOrder[i], quoteOrder[j]] = [quoteOrder[j], quoteOrder[i]];
  }
  quoteIndex = 0;
}

function setNextQuote(animate = true) {
  if (!quoteBox) return;
  if (!quoteOrder.length || quoteIndex >= quoteOrder.length) {
    shuffleQuotes();
  }
  const idx = quoteOrder[quoteIndex];
  quoteIndex += 1;

  if (!animate || reduceMotion) {
    quoteBox.textContent = quotes[idx];
    return;
  }

  quoteBox.classList.add("is-swapping");
  window.setTimeout(() => {
    quoteBox.textContent = quotes[idx];
    quoteBox.classList.remove("is-swapping");
  }, 320);
}

function spawnEmojiFromBall(count = 4) {
  if (!floatingLayer || reduceMotion) return;

  const layerRect = floatingLayer.getBoundingClientRect();
  const ballRect = ball.getBoundingClientRect();

  const centerX = ballRect.left + ballRect.width / 2;
  const centerY = ballRect.top + ballRect.height / 2;

  for (let i = 0; i < count; i += 1) {
    const emoji = document.createElement("div");
    emoji.className = "floating-emoji";
    emoji.textContent = randomFrom(emojis);

    const jitterX = (Math.random() - 0.5) * 12;
    const jitterY = (Math.random() - 0.5) * 12;

    const relativeX = centerX - layerRect.left + jitterX;
    const relativeY = centerY - layerRect.top + jitterY;

    emoji.style.left = `${relativeX}px`;
    emoji.style.top = `${relativeY}px`;

    const angle = Math.random() * Math.PI * 2;
    const strength = 160 + Math.random() * 220;
    const burstX = Math.cos(angle) * strength;
    const burstY = Math.sin(angle) * strength * 1.1;

    emoji.style.setProperty("--burst-x", `${burstX}px`);
    emoji.style.setProperty("--burst-y", `${burstY}px`);

    floatingLayer.appendChild(emoji);

    emoji.addEventListener("animationend", () => {
      emoji.remove();
    });
  }
}

// --- three.js orb ---------------------------------------------------------

const MAX_RIPPLES = 10;

let scene;
let camera;
let renderer;
let orb;
let glow;
let motes;
let orbUniforms;
let glowUniforms;
let motesMaterial;
let time = 0;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// active ripple events (constructive / destructive interference)
const ripples = [];

let rotationX = 0;
let rotationY = 0;
let velX = 0;
let velY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

// Shared GLSL: Ashima simplex noise (3D)
const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}
float fbm(vec3 p){
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    f += a * snoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return f;
}
`;

const ORB_VERTEX = /* glsl */ `
#define MAX_RIPPLES ${MAX_RIPPLES}
uniform float uTime;
uniform float uAmp;
uniform int uRippleCount;
uniform vec3 uRippleDir[MAX_RIPPLES];
uniform float uRippleStart[MAX_RIPPLES];
uniform float uRippleStrength[MAX_RIPPLES];

varying vec3 vNormalV;
varying vec3 vViewDirV;
varying vec3 vObjNormal;
varying float vDisp;
varying float vHit;

${NOISE_GLSL}

float rippleAt(vec3 n, out float hit) {
  hit = 0.0;
  float total = 0.0;
  for (int i = 0; i < MAX_RIPPLES; i++) {
    if (i >= uRippleCount) break;
    float age = uTime - uRippleStart[i];
    if (age < 0.0 || age > 9.0) continue;

    // full geodesic angle from the impact point: 0 at impact, PI at the antipode
    float angle = acos(clamp(dot(n, uRippleDir[i]), -1.0, 1.0));
    float front = age * 1.6;              // how far the wave has travelled
    float decay = exp(-age * 0.26) * uRippleStrength[i];

    // outgoing wave sweeping toward the far side
    float d1 = angle - front;
    float env1 = exp(-abs(d1) * 2.6);
    // wave that wrapped over the antipode and is refocusing on the near side
    float d2 = (6.2831853 - angle) - front;
    float env2 = exp(-abs(d2) * 2.6) * 0.75;

    total += (env1 * sin(d1 * 5.0) + env2 * sin(d2 * 5.0)) * decay;
    hit += max(0.0, env1 * decay);
  }
  return total;
}

float displacement(vec3 n, out float hit) {
  float noise = fbm(n * 1.6 + vec3(0.0, 0.0, uTime * 0.18));
  float disp = noise * 0.10 * uAmp;
  disp += rippleAt(n, hit) * 0.16;
  return disp;
}

void main() {
  vec3 n = normalize(position);

  float hit;
  float d = displacement(n, hit);
  vec3 pos = n * (0.9 + d);

  // analytic-ish normal via two tangent neighbours
  vec3 t = normalize(cross(n, vec3(0.0, 1.0, 0.001)));
  vec3 b = normalize(cross(n, t));
  float e = 0.012;
  float h1, h2;
  vec3 nA = normalize(n + t * e);
  vec3 nB = normalize(n + b * e);
  vec3 pA = nA * (0.9 + displacement(nA, h1));
  vec3 pB = nB * (0.9 + displacement(nB, h2));
  vec3 newN = normalize(cross(pA - pos, pB - pos));
  if (dot(newN, n) < 0.0) newN = -newN;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vNormalV = normalize(normalMatrix * newN);
  vViewDirV = normalize(-mvPosition.xyz);
  vObjNormal = n;
  vDisp = d;
  vHit = hit;
}
`;

const ORB_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

varying vec3 vNormalV;
varying vec3 vViewDirV;
varying vec3 vObjNormal;
varying float vDisp;
varying float vHit;

vec3 spectral(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(vViewDirV);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);

  // soft key + fill lighting
  vec3 L1 = normalize(vec3(0.5, 0.8, 0.6));
  vec3 L2 = normalize(vec3(-0.6, -0.3, 0.4));
  float diff = clamp(dot(N, L1), 0.0, 1.0) * 0.85
             + clamp(dot(N, L2), 0.0, 1.0) * 0.35;

  // palette drifting across the surface + time
  float m1 = 0.5 + 0.5 * sin(vObjNormal.y * 2.0 + uTime * 0.30);
  float m2 = 0.5 + 0.5 * sin(vObjNormal.x * 1.6 - uTime * 0.22 + 1.7);
  vec3 base = mix(uColorA, uColorB, m1);
  base = mix(base, uColorC, m2 * 0.6);

  // thin-film iridescence on the rim
  vec3 irid = spectral(fres * 1.2 + vDisp * 2.5 + uTime * 0.04);

  vec3 col = base * (0.28 + 0.72 * diff);
  col += irid * fres * 0.85;          // iridescent sheen
  col += base * fres * 0.45;          // colored rim glow
  col += base * max(vDisp, 0.0) * 1.2;                 // ripple crests brighten
  col += vec3(0.55, 0.7, 1.0) * pow(clamp(vHit, 0.0, 1.5), 1.5) * 0.55; // impact flash

  // gentle overall shimmer
  col *= 0.92 + 0.08 * sin(uTime * 0.8 + vObjNormal.z * 3.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

const GLOW_VERTEX = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const GLOW_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uGlowA;
uniform vec3 uGlowB;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.6);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.1);
  vec3 c = mix(uGlowA, uGlowB, 0.5 + 0.5 * sin(uTime * 0.4)) * rim * pulse;
  gl_FragColor = vec4(c, rim * 0.55);
}
`;

function makeMoteTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(214,226,255,0.85)");
  g.addColorStop(1, "rgba(160,180,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function initThreeBlob() {
  if (!blobCanvas || !window.THREE) return;

  scene = new THREE.Scene();

  const { width, height } = blobCanvas.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  camera.position.z = 4.2;

  renderer = new THREE.WebGLRenderer({ canvas: blobCanvas, alpha: true, antialias: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // --- orb ---
  orbUniforms = {
    uTime: { value: 0 },
    uAmp: { value: reduceMotion ? 0.4 : 1.0 },
    uColorA: { value: new THREE.Color(0x7c3aed) }, // violet
    uColorB: { value: new THREE.Color(0x22d3ee) }, // cyan
    uColorC: { value: new THREE.Color(0xf472b6) }, // pink
    uRippleCount: { value: 0 },
    uRippleDir: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3()) },
    uRippleStart: { value: new Array(MAX_RIPPLES).fill(-100) },
    uRippleStrength: { value: new Array(MAX_RIPPLES).fill(0) },
  };

  const orbGeometry = new THREE.SphereGeometry(0.9, 128, 128);
  const orbMaterial = new THREE.ShaderMaterial({
    uniforms: orbUniforms,
    vertexShader: ORB_VERTEX,
    fragmentShader: ORB_FRAGMENT,
  });
  orb = new THREE.Mesh(orbGeometry, orbMaterial);
  scene.add(orb);

  // --- glow halo shell (additive) ---
  glowUniforms = {
    uTime: { value: 0 },
    uGlowA: { value: new THREE.Color(0x8b5cf6) },
    uGlowB: { value: new THREE.Color(0x38bdf8) },
  };
  const glowGeometry = new THREE.SphereGeometry(1.18, 48, 48);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  glow = new THREE.Mesh(glowGeometry, glowMaterial);
  scene.add(glow);

  // --- floating light motes ---
  const moteCount = reduceMotion ? 60 : 240;
  const positions = new Float32Array(moteCount * 3);
  const seeds = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i += 1) {
    // random point in a shell around the orb
    const r = 1.05 + Math.random() * 0.9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    seeds[i] = Math.random() * 6.28;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  motesMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTex: { value: makeMoteTexture() },
      uSize: { value: renderer.getPixelRatio() * 5.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      attribute float aSeed;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 3.0));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = uSize * (0.6 + 0.8 * (0.5 + 0.5 * sin(aSeed)));
        gl_PointSize = clamp(s * (2.4 / -mv.z), 1.0, 40.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uTex;
      varying float vTwinkle;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 tint = mix(vec3(0.7, 0.85, 1.0), vec3(0.9, 0.8, 1.0), gl_PointCoord.x);
        gl_FragColor = vec4(tint, t.a * vTwinkle * 0.8);
      }
    `,
  });
  motes = new THREE.Points(moteGeo, motesMaterial);
  scene.add(motes);

  window.addEventListener("resize", onResize);
}

function onResize() {
  if (!renderer || !camera) return;
  const rect = blobCanvas.getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
  if (motesMaterial) {
    motesMaterial.uniforms.uSize.value = renderer.getPixelRatio() * 5.0;
  }
}

function syncRippleUniforms() {
  // prune expired ripples
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    if (time - ripples[i].startTime > 9.0) ripples.splice(i, 1);
  }
  const count = Math.min(ripples.length, MAX_RIPPLES);
  orbUniforms.uRippleCount.value = count;
  for (let i = 0; i < count; i += 1) {
    orbUniforms.uRippleDir.value[i].copy(ripples[i].dir);
    orbUniforms.uRippleStart.value[i] = ripples[i].startTime;
    orbUniforms.uRippleStrength.value[i] = ripples[i].strength;
  }
}

function updateThreeBlob(dt) {
  if (!orb) return;
  time += dt;

  orbUniforms.uTime.value = time;
  glowUniforms.uTime.value = time;
  motesMaterial.uniforms.uTime.value = time;

  syncRippleUniforms();

  // inertia + gentle auto-spin
  rotationY += velY;
  rotationX += velX;
  velY *= 0.94;
  velX *= 0.94;
  rotationX = Math.max(-1.1, Math.min(1.1, rotationX));
  if (!isDragging) {
    const idleSpin = reduceMotion ? 0.0006 : 0.0022;
    rotationY += idleSpin;
    // ease pitch back toward level
    rotationX *= 0.995;
  }

  orb.rotation.set(rotationX, rotationY, 0);
  glow.rotation.copy(orb.rotation);
  motes.rotation.y += dt * 0.05;
  motes.rotation.x = Math.sin(time * 0.1) * 0.15;

  renderer.render(scene, camera);
}

let lastFrameTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  updateThreeBlob(dt);
  requestAnimationFrame(loop);
}

if (blobCanvas) {
  initThreeBlob();
  requestAnimationFrame(loop);
}

function perturbBlob(globalX, globalY, strength = 1.0) {
  if (!renderer || !camera || !orb) return;

  const rect = blobCanvas.getBoundingClientRect();
  const x = ((globalX - rect.left) / rect.width) * 2 - 1;
  const y = -(((globalY - rect.top) / rect.height) * 2 - 1);

  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);

  const intersects = raycaster.intersectObject(orb);
  let dir;
  if (intersects.length > 0) {
    const localPoint = orb.worldToLocal(intersects[0].point.clone());
    dir = localPoint.normalize();
  } else {
    dir = raycaster.ray.direction.clone().normalize();
  }

  ripples.push({ dir, startTime: time, strength });
  if (ripples.length > MAX_RIPPLES) ripples.shift();
}

// --- interaction ----------------------------------------------------------

function pressPop() {
  if (reduceMotion) return;
  ball.classList.add("is-pressed");
  window.setTimeout(() => ball.classList.remove("is-pressed"), 150);
}

ball.addEventListener("click", (event) => {
  spawnEmojiFromBall(4);
  perturbBlob(event.clientX, event.clientY, 1.0);
  pressPop();
  setNextQuote();
});

ball.addEventListener("pointerdown", (event) => {
  isDragging = true;
  velX = 0;
  velY = 0;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  try {
    ball.setPointerCapture(event.pointerId);
  } catch (_) {}
});

ball.addEventListener("pointermove", (event) => {
  if (!isDragging) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  const ROTATION_SPEED = 0.01;
  velY = dx * ROTATION_SPEED;
  velX = dy * ROTATION_SPEED;
  rotationY += velY;
  rotationX += velX;
});

function endDrag(event) {
  isDragging = false;
  try {
    if (event && event.pointerId != null) {
      ball.releasePointerCapture(event.pointerId);
    }
  } catch (_) {}
}

ball.addEventListener("pointerup", endDrag);
ball.addEventListener("pointercancel", endDrag);

ball.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const rect = ball.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spawnEmojiFromBall(4);
    perturbBlob(centerX, centerY, 1.0);
    pressPop();
    setNextQuote();
  }
});

setNextQuote(false);
