import * as THREE from 'three';

type AdventureOptions = {
  onMessage?: (message: string) => void;
};

const keys = new Set<string>();

export class ThreeAdventure {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  private renderer: THREE.WebGLRenderer;
  private player = new THREE.Group();
  private clock = new THREE.Clock();
  private animationId = 0;
  private obstacles: THREE.Mesh[] = [];
  private portal!: THREE.Mesh;
  private messageCooldown = 0;

  constructor(private container: HTMLElement, private options: AdventureOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  start() {
    this.buildScene();
    this.bindEvents();
    this.onResize();
    this.options.onMessage?.('WASD / 方向键移动，靠近传送门试试。');
    this.loop();
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    keys.clear();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
  }

  private onKeyDown(event: KeyboardEvent) {
    keys.add(event.key.toLowerCase());
  }

  private onKeyUp(event: KeyboardEvent) {
    keys.delete(event.key.toLowerCase());
  }

  private buildScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#081020');
    this.scene.fog = new THREE.Fog('#081020', 18, 60);

    const hemiLight = new THREE.HemisphereLight('#9eeeff', '#1a0f2d', 1.4);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 2.2);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(dirLight);

    this.createGround();
    this.createPlayer();
    this.createObstacles();
    this.createPortal();
    this.createNeonPillars();

    this.camera.position.set(0, 8, 10);
    this.camera.lookAt(this.player.position);
  }

  private createGround() {
    const groundGeo = new THREE.PlaneGeometry(80, 80, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#11172f',
      roughness: 0.72,
      metalness: 0.18,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(80, 40, '#35f2ff', '#1e335c');
    grid.position.y = 0.02;
    this.scene.add(grid);
  }

  private createPlayer() {
    this.player = new THREE.Group();
    this.player.position.set(0, 0.75, 0);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.05, 8, 18),
      new THREE.MeshStandardMaterial({ color: '#40e8ff', emissive: '#0c6070', metalness: 0.25, roughness: 0.35 }),
    );
    body.castShadow = true;
    this.player.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 24, 24),
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#222244', roughness: 0.32 }),
    );
    head.position.y = 1.05;
    head.castShadow = true;
    this.player.add(head);

    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.25, 0.08),
      new THREE.MeshStandardMaterial({ color: '#ffe66b', emissive: '#8a6500' }),
    );
    sword.position.set(0.58, 0.35, 0.08);
    sword.rotation.z = -0.35;
    sword.castShadow = true;
    this.player.add(sword);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.025, 12, 48),
      new THREE.MeshBasicMaterial({ color: '#ff4fd8' }),
    );
    halo.position.y = 1.58;
    halo.rotation.x = Math.PI / 2;
    this.player.add(halo);

    this.scene.add(this.player);
  }

  private createObstacles() {
    this.obstacles = [];
    const positions = [
      [-5, 1, -4],
      [5, 1, -5],
      [-6, 1, 4],
      [4, 1, 5],
      [0, 1, -8],
    ];

    for (const [x, y, z] of positions) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshStandardMaterial({ color: '#2a2f55', emissive: '#0a102e', metalness: 0.3, roughness: 0.55 }),
      );
      box.position.set(x, y, z);
      box.castShadow = true;
      box.receiveShadow = true;
      this.obstacles.push(box);
      this.scene.add(box);
    }
  }

  private createPortal() {
    this.portal = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.08, 18, 80),
      new THREE.MeshBasicMaterial({ color: '#ff4fd8' }),
    );
    this.portal.position.set(0, 2, -14);
    this.portal.rotation.x = Math.PI / 2;
    this.scene.add(this.portal);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 32, 32),
      new THREE.MeshBasicMaterial({ color: '#35f2ff', transparent: true, opacity: 0.32 }),
    );
    core.position.copy(this.portal.position);
    this.scene.add(core);
  }

  private createNeonPillars() {
    const colors = ['#35f2ff', '#ff4fd8', '#ffe14d'];
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const radius = 18;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 5, 16),
        new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }),
      );
      pillar.position.set(Math.cos(angle) * radius, 2.5, Math.sin(angle) * radius);
      this.scene.add(pillar);
    }
  }

  private loop = () => {
    this.animationId = requestAnimationFrame(this.loop);
    const delta = Math.min(this.clock.getDelta(), 0.033);
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number) {
    this.updatePlayer(delta);
    this.updateCamera(delta);
    this.portal.rotation.z += delta * 1.8;
    this.player.children.forEach((child, index) => {
      if (index === 3) child.rotation.z += delta * 1.6;
    });

    this.messageCooldown = Math.max(0, this.messageCooldown - delta);
    const distanceToPortal = this.player.position.distanceTo(new THREE.Vector3(0, 0.75, -14));
    if (distanceToPortal < 2.6 && this.messageCooldown <= 0) {
      this.options.onMessage?.('你靠近了传送门：下一步可以做地图切换 / 进入战斗。');
      this.messageCooldown = 2.5;
    }
  }

  private updatePlayer(delta: number) {
    const direction = new THREE.Vector3();
    if (keys.has('w') || keys.has('arrowup')) direction.z -= 1;
    if (keys.has('s') || keys.has('arrowdown')) direction.z += 1;
    if (keys.has('a') || keys.has('arrowleft')) direction.x -= 1;
    if (keys.has('d') || keys.has('arrowright')) direction.x += 1;

    if (direction.lengthSq() === 0) return;

    direction.normalize();
    const speed = keys.has('shift') ? 8 : 5;
    const nextPosition = this.player.position.clone().addScaledVector(direction, speed * delta);
    nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -24, 24);
    nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, -24, 24);

    if (!this.collides(nextPosition)) {
      this.player.position.copy(nextPosition);
      this.player.rotation.y = Math.atan2(direction.x, direction.z);
    }
  }

  private collides(nextPosition: THREE.Vector3) {
    for (const obstacle of this.obstacles) {
      const dx = Math.abs(nextPosition.x - obstacle.position.x);
      const dz = Math.abs(nextPosition.z - obstacle.position.z);
      if (dx < 1.45 && dz < 1.45) return true;
    }
    return false;
  }

  private updateCamera(delta: number) {
    const cameraTarget = this.player.position.clone().add(new THREE.Vector3(0, 6.5, 8.5));
    this.camera.position.lerp(cameraTarget, 1 - Math.pow(0.001, delta));
    const lookTarget = this.player.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    this.camera.lookAt(lookTarget);
  }

  private onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
