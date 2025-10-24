var initialValueSlider = {
  speed: 10,
  gap: -20,
  curve: 15,
  direction: -1,
  dragSensitivity: 0.9,
  imagesPerView: 9,
  borderRadius: 0,
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
      autoScrollBeforeDrag: false,
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
    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      20
    );
    this.camera.position.z = 2.25;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Remove previous canvas if exists
    const previousCanvas = this.container.querySelector("canvas");
    if (previousCanvas) {
      this.container.removeChild(previousCanvas);
    }

    this.container.appendChild(this.renderer.domElement);
  }

  setupDragControls() {
    let startTime = 0;
    let startPosition = 0;
    let lastMoveTime = 0;
    let lastPosition = 0;
    let velocityHistory = []; // Lưu lịch sử velocity để tính trung bình

    // Mouse events
    this.container.addEventListener("mousedown", (e) => {
      // Kiểm tra xem click có nằm trong vùng cho phép không (responsive)
      const rect = this.container.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const clickX = e.clientX - rect.left;
      const containerHeight = rect.height;
      const containerWidth = rect.width;
      const isLargeScreen = window.innerWidth >= 720;

      // Kiểm tra vùng top
      const allowedTop = isLargeScreen
        ? containerHeight * 0.3
        : containerHeight * 0.35;

      if (clickY < allowedTop) {
        // Kiểm tra thêm vùng width cho desktop
        if (isLargeScreen) {
          const areaLeft = containerWidth * 0.25; // 25% từ trái
          const areaRight = containerWidth * 0.75; // 75% từ trái
          if (clickX >= areaLeft && clickX <= areaRight) {
            return; // Chỉ chặn nếu click trong vùng area
          }
        } else {
          return; // Mobile: chặn toàn bộ top
        }
      }

      // Kiểm tra vùng bottom
      const allowedBottom = isLargeScreen
        ? containerHeight * 0.7
        : containerHeight * 0.65;

      if (clickY > allowedBottom) {
        // Kiểm tra thêm vùng width cho desktop
        if (isLargeScreen) {
          const areaLeft = containerWidth * 0.25; // 25% từ trái
          const areaRight = containerWidth * 0.75; // 75% từ trái
          if (clickX >= areaLeft && clickX <= areaRight) {
            return; // Chỉ chặn nếu click trong vùng area
          }
        } else {
          return; // Mobile: chặn toàn bộ bottom
        }
      }

      this.startDrag(e.clientX, e.clientY);
      startTime = Date.now();
      startPosition = e.clientX;
      lastMoveTime = startTime;
      lastPosition = e.clientX;
      velocityHistory = [];
    });

    document.addEventListener("mousemove", (e) => {
      if (this.state.isDragging) {
        const currentTime = Date.now();
        const currentPosition = e.clientX;

        // Tính velocity cho frame này
        const deltaTime = currentTime - lastMoveTime;
        const deltaPosition = currentPosition - lastPosition;

        if (deltaTime > 0) {
          const frameVelocity = deltaPosition / deltaTime;
          velocityHistory.push(frameVelocity);

          // Chỉ giữ lại 5 frame gần nhất để tính trung bình
          if (velocityHistory.length > 5) {
            velocityHistory.shift();
          }
        }

        lastMoveTime = currentTime;
        lastPosition = currentPosition;

        this.updateDrag(e.clientX, e.clientY);
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (this.state.isDragging) {
        const endTime = Date.now();
        const endPosition = e.clientX;

        // Tính velocity trung bình từ lịch sử
        let avgVelocity = 0;
        if (velocityHistory.length > 0) {
          avgVelocity =
            velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
        }

        this.endDrag(avgVelocity);
      }
    });

    // Touch events - tương tự
    this.container.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];

        // Kiểm tra xem touch có nằm trong vùng cho phép không (responsive)
        const rect = this.container.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;
        const touchX = touch.clientX - rect.left;
        const containerHeight = rect.height;
        const containerWidth = rect.width;
        const isLargeScreen = window.innerWidth >= 720;

        // Kiểm tra vùng top
        const allowedTop = isLargeScreen
          ? containerHeight * 0.3
          : containerHeight * 0.35;

        if (touchY < allowedTop) {
          // Kiểm tra thêm vùng width cho desktop
          if (isLargeScreen) {
            const areaLeft = containerWidth * 0.25; // 25% từ trái
            const areaRight = containerWidth * 0.75; // 75% từ trái
            if (touchX >= areaLeft && touchX <= areaRight) {
              return; // Chỉ chặn nếu touch trong vùng area
            }
          } else {
            return; // Mobile: chặn toàn bộ top
          }
        }

        const allowedBottom = isLargeScreen
          ? containerHeight * 0.7
          : containerHeight * 0.65;

        if (touchY > allowedBottom) {
          // Kiểm tra thêm vùng width cho desktop
          if (isLargeScreen) {
            const areaLeft = containerWidth * 0.25; // 25% từ trái
            const areaRight = containerWidth * 0.75; // 75% từ trái
            if (touchX >= areaLeft && touchX <= areaRight) {
              return; // Chỉ chặn nếu touch trong vùng area
            }
          } else {
            return; // Mobile: chặn toàn bộ bottom
          }
        }

        this.startDrag(touch.clientX, touch.clientY);
        startTime = Date.now();
        startPosition = touch.clientX;
        lastMoveTime = startTime;
        lastPosition = touch.clientX;
        velocityHistory = [];
      },
      { passive: false }
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (this.state.isDragging) {
          e.preventDefault();
          const touch = e.touches[0];

          const currentTime = Date.now();
          const currentPosition = touch.clientX;

          const deltaTime = currentTime - lastMoveTime;
          const deltaPosition = currentPosition - lastPosition;

          if (deltaTime > 0) {
            const frameVelocity = deltaPosition / deltaTime;
            velocityHistory.push(frameVelocity);

            if (velocityHistory.length > 5) {
              velocityHistory.shift();
            }
          }

          lastMoveTime = currentTime;
          lastPosition = currentPosition;

          this.updateDrag(touch.clientX, touch.clientY);
        }
      },
      { passive: false }
    );

    document.addEventListener("touchend", (e) => {
      if (this.state.isDragging) {
        let avgVelocity = 0;
        if (velocityHistory.length > 0) {
          avgVelocity =
            velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
        }

        this.endDrag(avgVelocity);
      }
    });

    // Prevent context menu on long press
    this.container.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  startDrag(x, y) {
    this.state.isDragging = true;
    this.state.dragStart.x = x;
    this.state.dragStart.y = y;
    this.state.dragCurrent.x = x;
    this.state.dragCurrent.y = y;
    this.state.dragVelocity = 0;
    this.state.targetVelocity = 0;

    // Store auto-scroll state and pause it
    this.state.autoScrollBeforeDrag = !this.state.isPaused;

    this.container.classList.add("dragging");
    document.body.style.userSelect = "none";
  }

  updateDrag(x, y) {
    if (!this.state.isDragging) return;

    const deltaX = x - this.state.dragCurrent.x;
    this.state.dragCurrent.x = x;
    this.state.dragCurrent.y = y;

    // Apply drag movement
    this.state.dragVelocity = deltaX * this.options.dragSensitivity * 0.001;
    this.time += this.state.dragVelocity;

    // Check for infinite scroll boundaries during drag
    this.checkInfiniteScrollBounds();
  }

  endDrag(velocity = 0) {
    this.state.isDragging = false;
    this.container.classList.remove("dragging");
    document.body.style.userSelect = "";

    const momentumMultiplier = this.options.dragSensitivity * 0.005;
    this.state.targetVelocity = -velocity * momentumMultiplier;

    const maxVelocity = 0.02;
    this.state.targetVelocity = Math.max(
      -maxVelocity,
      Math.min(maxVelocity, this.state.targetVelocity)
    );
  }

  getWidth(gap) {
    return 1 + gap / 100;
  }

  getPlaneWidth(camera) {
    const vFov = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * camera.position.z;
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const width = height * aspect;

    // Calculate width based on desired images per view
    const availableWidth = this.container.clientWidth / width;
    const planeWidth = availableWidth / this.options.imagesPerView;

    return planeWidth;
  }

  createPlanes() {
    // Clear existing planes
    this.planes.forEach((plane) => {
      if (plane) {
        this.scene.remove(plane);
      }
    });
    this.planes = [];

    const manager = new THREE.LoadingManager(() => {
      document.getElementById("loading").style.display = "none";
    });
    const loader = new THREE.TextureLoader(manager);

    const geometry = new THREE.PlaneGeometry(0.65, 0.85, 20, 20); // Slightly taller aspect ratio
    const planeSpace =
      this.getPlaneWidth(this.camera) * this.getWidth(this.options.gap);

    // Create more planes for better infinite scrolling coverage
    const baseImages = Math.ceil(this.container.clientWidth / planeSpace) + 1;
    const extraPadding = Math.max(10, this.options.images.length); // Extra buffer for fast dragging
    const totalImages =
      baseImages + extraPadding + this.options.images.length * 2;
    const initialOffset = Math.ceil(totalImages / 2);

    // Duplicate images for seamless loop with extra coverage
    const allImages = [];
    for (let i = 0; i < totalImages; i++) {
      allImages.push(this.options.images[i % this.options.images.length]);
    }

    allImages.forEach((imageUrl, i) => {
      loader.load(imageUrl, (texture) => {
        // Cải thiện chất lượng texture
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        // Tính toán aspect ratio của texture và plane
        const imageAspect = texture.image.width / texture.image.height;
        const planeAspect = 0.65 / 0.85; // geometry aspect ratio

        const material = new THREE.ShaderMaterial({
          uniforms: {
            tex: { value: texture },
            curve: { value: this.options.curve },
            borderRadius: { value: this.options.borderRadius },
            resolution: { value: new THREE.Vector2(1, 1) },
            imageAspect: { value: imageAspect },
            planeAspect: { value: planeAspect },
          },
          vertexShader: `
                  uniform float curve;
                  varying vec2 vertexUV;
                  void main() {
                    vertexUV = uv;
                    vec3 newPosition = position;
                    float distanceFromCenter = abs(modelMatrix*vec4(position, 1.0)).x;
                    newPosition.y *= 1.0 + (curve/100.0)*pow(distanceFromCenter,2.0);

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                  }
                `,
          fragmentShader: `
                  uniform sampler2D tex;
                  uniform float borderRadius;
                  uniform vec2 resolution;
                  uniform float imageAspect;
                  uniform float planeAspect;
                  varying vec2 vertexUV;

                  float roundedRectSDF(vec2 centerPosition, vec2 size, float radius) {
                    return length(max(abs(centerPosition) - size + radius, 0.0)) - radius;
                  }

                  void main() {
                    vec2 uv = vertexUV;

                    // Tính toán cover effect
                    vec2 coverUV = uv;
                    float scale = max(planeAspect / imageAspect, 1.0);

                    if (imageAspect > planeAspect) {
                      // Image rộng hơn plane, scale theo height
                      scale = 1.0 / imageAspect * planeAspect;
                      coverUV.x = (uv.x - 0.5) * scale + 0.5;
                    } else {
                      // Image cao hơn plane, scale theo width
                      scale = imageAspect / planeAspect;
                      coverUV.y = (uv.y - 0.5) * scale + 0.5;
                    }

                    // Đảm bảo UV không vượt quá giới hạn
                    coverUV = clamp(coverUV, 0.0, 1.0);

                    // Border radius effect
                    vec2 center = uv - 0.5;
                    vec2 size = vec2(0.5);
                    float distance = roundedRectSDF(center, size, borderRadius);
                    float smoothedAlpha = 1.0 - smoothstep(0.0, 0.01, distance);

                    vec4 texColor = texture2D(tex, coverUV);
                    gl_FragColor = vec4(texColor.rgb, texColor.a * smoothedAlpha);
                  }
                `,
          transparent: true,
        });

        this.planes[i] = new THREE.Mesh(geometry, material);
        this.planes[i].position.x =
          -1 *
          this.options.direction *
          (i - initialOffset) *
          this.getWidth(this.options.gap);
        this.scene.add(this.planes[i]);
      });
    });
  }

  setupResize() {
    let resizeTimeout;

    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 100);
    });
  }

  handleResize() {
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.createPlanes(); // Recreate planes for new dimensions
  }

  checkInfiniteScrollBounds() {
    const loopWidth =
      this.getWidth(this.options.gap) * this.options.images.length;

    // Reset position for seamless infinite loop
    if (this.time * this.options.speed >= loopWidth) {
      this.time -= loopWidth / this.options.speed;
    } else if (this.time * this.options.speed <= -loopWidth) {
      this.time += loopWidth / this.options.speed;
    }
  }

  animate(currentTime = 0) {
    // Handle momentum from dragging
    if (!this.state.isDragging && Math.abs(this.state.targetVelocity) > 0.001) {
      this.time += this.state.targetVelocity;
      this.state.targetVelocity *= 0.92; // Friction
      this.checkInfiniteScrollBounds();
    }

    // Normal auto-scroll
    if (
      !this.state.isPaused &&
      !this.state.isDragging &&
      Math.abs(this.state.targetVelocity) <= 0.0001
    ) {
      this.time += this.options.direction * 0.00001;
      this.checkInfiniteScrollBounds();
    }

    // Update scene position
    this.scene.position.x = this.time * this.options.speed;

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((time) => this.animate(time));
  }

  destroy() {
    this.planes.forEach((plane) => {
      if (plane) {
        this.scene.remove(plane);
        if (plane.material) {
          plane.material.dispose();
        }
        if (plane.geometry) {
          plane.geometry.dispose();
        }
      }
    });

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(
          this.renderer.domElement
        );
      }
    }
  }
}

function waitForHeight(el, callback) {
  const maxAttempts = 20;
  let attempts = 0;

  const check = () => {
    if (el.clientHeight > 0) {
      callback();
    } else if (attempts < maxAttempts) {
      attempts++;
      requestAnimationFrame(check);
    } else {
      console.warn("Container has no height after waiting.");
    }
  };

  check();
}

// Initialize when DOM and Three.js are loaded
document.addEventListener("DOMContentLoaded", function () {
  // Check if Three.js is loaded
  if (typeof THREE === "undefined") {
    document.getElementById("loading").textContent = "Failed to load Three.js";
    return;
  }

  const container = document.querySelector("#curvedSlider");

  waitForHeight(container, () => {
    const slider = new CurvedSlider3D("#curvedSlider", {
      ...initialValueSlider,
    });

    window.curvedSlider = slider;
  });
});
