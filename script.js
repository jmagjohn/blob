const ball = document.getElementById("stress-ball");
const blobCanvas = document.getElementById("blob-canvas");
const floatingLayer = document.getElementById("floating-layer");
const quoteBox = document.getElementById("quote-box");
const quoteButton = document.getElementById("quote-button");

const emojis = [
  "✨",
  "🌿",
  "💫",
  "🌙",
  "⭐",
  "🫧",
  "🩵",
  "🌸",
  "☁️",
  "🌈",
  "🍃",
  "💜",
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

function setNextQuote() {
  if (!quoteBox) return;
  if (!quoteOrder.length || quoteIndex >= quoteOrder.length) {
    shuffleQuotes();
  }
  const idx = quoteOrder[quoteIndex];
  quoteIndex += 1;
  quoteBox.textContent = quotes[idx];
}

function spawnEmojiFromBall(count = 3) {
  if (!floatingLayer) return;

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
    const strength = 160 + Math.random() * 220; // stronger burst
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

// --- three.js blob ---

let scene;
let camera;
let renderer;
let sphere;
let wireSphere;
let blobMaterial;
let time = 0;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// multiple ripple events for constructive / destructive interference
const ripples = [];

let rotationX = 0;
let rotationY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

function initThreeBlob() {
  if (!blobCanvas || !window.THREE) return;

  scene = new THREE.Scene();

  const { width, height } = blobCanvas.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  camera.position.z = 4.2;

  renderer = new THREE.WebGLRenderer({ canvas: blobCanvas, alpha: true, antialias: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const geometry = new THREE.SphereGeometry(0.9, 64, 64);

  blobMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    emissive: 0x4c1d95,
    emissiveIntensity: 1.2,
    roughness: 0.3,
    metalness: 0.2,
  });

  sphere = new THREE.Mesh(geometry, blobMaterial);
  scene.add(sphere);

  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xc4b5fd,
    wireframe: true,
    opacity: 0.12,
    transparent: true,
  });

  wireSphere = new THREE.Mesh(geometry, wireMaterial);
  scene.add(wireSphere);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(0xffffff, 1.3, 10);
  keyLight.position.set(2, 2, 3);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x93c5fd, 1.4, 10);
  rimLight.position.set(-2, -1.5, -2);
  scene.add(rimLight);

  window.addEventListener("resize", () => {
    const rect = blobCanvas.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  });
}

function updateThreeBlob(dt) {
  if (!sphere) return;

  time += dt;

  if (blobMaterial) {
    // Shifting through a range of deep purples, teals, and soft cyans for a bioluminescent feel
    const hue = 0.75 + 0.1 * Math.sin(time * 0.2);
    const sat = 0.7 + 0.2 * Math.sin(time * 0.35 + 1.2);
    const light = 0.45 + 0.1 * Math.sin(time * 0.25 + 2.4);
    blobMaterial.color.setHSL(hue, sat, light);
    
    // Emissive color follows but stays more saturated and vibrant
    blobMaterial.emissive.setHSL(hue, 0.9, 0.5);
    blobMaterial.emissiveIntensity = 0.8 + 0.5 * Math.sin(time * 0.5); // Pulsing glow
  }

  if (!isDragging) {
    rotationY += dt * 0.35;
  }

  const geometry = sphere.geometry;
  const positionAttr = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positionAttr.count; i += 1) {
    vertex.fromBufferAttribute(positionAttr, i);

    const baseRadius = 0.9;
    const normal = vertex.clone().normalize();

    const wave1 = Math.sin(normal.x * 3 + time * 1.2);
    const wave2 = Math.cos(normal.y * 4 + time * 1.5);
    const wave3 = Math.sin(normal.z * 5 + time * 0.9);

    const idle = (wave1 + wave2 + wave3) / 9;

    let ripple = 0;
    if (ripples.length > 0) {
      for (let r = ripples.length - 1; r >= 0; r -= 1) {
        const event = ripples[r];
        const age = time - event.startTime;
        if (age < 0 || age > 3.2) continue;

        const impact = Math.max(0, normal.dot(event.dir));
        const waveFront = age * 1.8; // slower wave propagation
        const radialOffset = Math.acos(impact);
        const dist = radialOffset - waveFront;

        const envelope = Math.exp(-Math.abs(dist) * 3.0) * Math.exp(-age * 0.6) * event.strength;
        ripple += envelope * Math.sin(dist * 5.0);
      }
    }

    const radius = baseRadius + idle * 0.12 + ripple * 0.22;

    vertex.copy(normal.multiplyScalar(radius));
    positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  positionAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  // clean up old ripples
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    if (time - ripples[i].startTime > 3.2) {
      ripples.splice(i, 1);
    }
  }

  sphere.rotation.set(rotationX, rotationY, 0);

  if (wireSphere) {
    wireSphere.rotation.copy(sphere.rotation);
  }

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

function perturbBlob(globalX, globalY) {
  if (!renderer || !camera || !sphere) {
    return;
  }

  const rect = blobCanvas.getBoundingClientRect();
  const x = ((globalX - rect.left) / rect.width) * 2 - 1;
  const y = -(((globalY - rect.top) / rect.height) * 2 - 1);

  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);

  const intersects = raycaster.intersectObject(sphere);
  let dir;
  if (intersects.length > 0) {
    const localPoint = sphere.worldToLocal(intersects[0].point.clone());
    dir = localPoint.clone().normalize();
  } else {
    dir = raycaster.ray.direction.clone().normalize();
  }

  ripples.push({ dir, startTime: time, strength: 1.0 });
}

ball.addEventListener("click", (event) => {
  spawnEmojiFromBall(4);
  perturbBlob(event.clientX, event.clientY);
});

ball.addEventListener("pointerdown", (event) => {
  isDragging = true;
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

  const ROTATION_SPEED = 0.012;
  rotationY += dx * ROTATION_SPEED;
  rotationX += dy * ROTATION_SPEED;
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
    perturbBlob(centerX, centerY);
  }
});

if (quoteButton) {
  quoteButton.addEventListener("click", () => {
    setNextQuote();
  });
}

setNextQuote();