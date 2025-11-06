// =============== Curved 3D Slider (Bo góc Figma ver. by ChatGPT for Uyen) =============== //
var initialValueSlider = {
  speed: 10,
  gap: -20,
  curve: 15,
  direction: -1,
  dragSensitivity: 0.9,
  imagesPerView: 9,
  borderRadius: 0.1, // ~24px bo góc mềm mại
};

class CurvedSlider3D {
  constructor(selector, options = {}) {
    this.container = document.querySelector(selector);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.planes = [];
    this.time = 0;

    this.options = {
      ...initialValueSlider,
      images: [
        "./assets/images/frame-01.jpg",
        "./assets/images/frame-02.jpg",
        "./assets/images/frame-03.jpg",
        "./assets/images/frame-04.jpg",
        "./assets/images/frame-05.jpg",
        "./assets/images/frame-06.jpg",
        "./assets/images/frame-07.jpg",
        "./assets/images/frame-08.jpg",
        "./assets/images/frame-09.jpg",
      ],
      ...options,
    };

    this.state = {
      isPaused: false,
      isReversed: false,
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      dragCurrent: { x: 0, y: 0 },
      dragVelocity: 0,
      targetVelocity: 0,
    };

    this.init();
  }

  init() {
    this.setupScene();
    this.setupDragControls();
    this.createPlanes();
    this.setupResize();
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      20
    );
    this.camera.position.z = 2.25;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    const previousCanvas = this.container.querySelector("canvas");
    if (previousCanvas) this.container.removeChild(previousCanvas);
    this.container.appendChild(this.renderer.domElement);
  }

  setupDragControls() {
    let velocityHistory = [];

    this.container.addEventListener("mousedown", (e) => {
      this.state.isDragging = true;
      this.state.dragStart.x = e.clientX;
      this.state.dragCurrent.x = e.clientX;
      this.container.classList.add("dragging");
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.state.isDragging) return;
      const deltaX = e.clientX - this.state.dragCurrent.x;
      this.state.dragCurrent.x = e.clientX;
      this.state.dragVelocity = deltaX * this.options.dragSensitivity * 0.001;
      this.time += this.state.dragVelocity;
    });

    document.addEventListener("mouseup", () => {
      this.state.isDragging = false;
      this.container.classList.remove("dragging");
    });
  }

  getWidth(gap) {
    return 1 + gap / 100;
  }

  getPlaneWidth(camera) {
    const vFov = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * camera.position.z;
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const width = height * aspect;
    const availableWidth = this.container.clientWidth / width;
    return availableWidth / this.options.imagesPerView;
  }

  createPlanes() {
    this.planes.forEach((p) => p && this.scene.remove(p));
    this.planes = [];

    const manager = new THREE.LoadingManager(() => {
      const loadingEl = document.getElementById("loading");
      if (loadingEl) loadingEl.style.display = "none";
    });
    const loader = new THREE.TextureLoader(manager);

    const geometry = new THREE.PlaneGeometry(0.65, 0.85, 20, 20);
    const planeSpace = this.getPlaneWidth(this.camera) * this.getWidth(this.options.gap);

    const allImages = [];
    const totalImages = this.options.images.length * 5;
    const initialOffset = Math.ceil(totalImages / 2);
    for (let i = 0; i < totalImages; i++) {
      allImages.push(this.options.images[i % this.options.images.length]);
    }

    allImages.forEach((imageUrl, i) => {
      loader.load(imageUrl, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const imageAspect = texture.image.width / texture.image.height;
        const planeAspect = 0.65 / 0.85;

        const material = new THREE.ShaderMaterial({
          uniforms: {
            tex: { value: texture },
            curve: { value: this.options.curve },
            borderRadius: { value: this.options.borderRadius },
            imageAspect: { value: imageAspect },
            planeAspect: { value: planeAspect },
          },
          vertexShader: `
            uniform float curve;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec3 pos = position;
              pos.y *= 1.0 + (curve / 100.0) * pow(abs(position.x), 2.0);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D tex;
            uniform float borderRadius;
            uniform float imageAspect;
            uniform float planeAspect;
            varying vec2 vUv;

            float roundedRectSDF(vec2 center, vec2 size, float radius) {
              return length(max(abs(center) - size + radius, 0.0)) - radius;
            }

            void main() {
              vec2 uv = vUv;
              vec2 center = uv - 0.5;
              vec2 size = vec2(0.5);
              float dist = roundedRectSDF(center, size, borderRadius);
              float alpha = 1.0 - smoothstep(0.0, 0.01, dist);

              vec4 texColor = texture2D(tex, uv);

              // Add soft shadow edge for realism
              float shadow = smoothstep(0.45, 0.5, length(center));
              texColor.rgb -= shadow * 0.15;

              gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
            }
          `,
          transparent: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = -1 * this.options.direction * (i - initialOffset) * this.getWidth(this.options.gap);
        this.scene.add(mesh);
        this.planes.push(mesh);
      });
    });
  }

  setupResize() {
    window.addEventListener("resize", () => {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

      // Responsive radius (mobile nhỏ hơn)
      this.options.borderRadius = window.innerWidth < 768 ? 0.06 : 0.1;
      this.createPlanes();
    });
  }

  animate() {
    if (!this.state.isDragging) this.time += this.options.direction * 0.00002;
    this.scene.position.x = this.time * this.options.speed;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  if (typeof THREE === "undefined") {
    document.getElementById("loading").textContent = "Failed to load Three.js";
    return;
  }
  const container = document.querySelector("#curvedSlider");
  if (!container) return;
  new CurvedSlider3D("#curvedSlider", { ...initialValueSlider });
});
