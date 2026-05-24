type GameStatus = {
  hp: number;
  lives: number;
  score: number;
  message: string;
  state: 'playing' | 'win' | 'lose';
};

type Options = {
  onStatus?: (status: GameStatus) => void;
};

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Bullet = Rect & {
  vx: number;
  from: 'player' | 'enemy';
  damage: number;
};

type Enemy = Rect & {
  hp: number;
  maxHp: number;
  type: 'soldier' | 'drone' | 'boss';
  dir: number;
  shootTimer: number;
  alive: boolean;
};

const keys = new Set<string>();
const VIEW_W = 960;
const VIEW_H = 540;
const WORLD_W = 3600;
const GROUND_Y = 464;
const GRAVITY = 1800;

export class RunGunGame {
  private ctx: CanvasRenderingContext2D;
  private rafId = 0;
  private lastTime = 0;
  private cameraX = 0;
  private score = 0;
  private state: 'playing' | 'win' | 'lose' = 'playing';
  private message = '向右突击，消灭敌人并击败终点 Boss。';

  private player = {
    x: 80,
    y: GROUND_Y - 64,
    w: 38,
    h: 64,
    vx: 0,
    vy: 0,
    hp: 100,
    lives: 3,
    facing: 1,
    onGround: false,
    shootCd: 0,
    invincible: 0,
  };

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private platforms: Rect[] = [];
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = [];

  constructor(private canvas: HTMLCanvasElement, private options: Options = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas init failed');
    this.ctx = ctx;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  start() {
    this.reset();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    keys.clear();
  }

  restart() {
    this.reset();
  }

  private reset() {
    this.cameraX = 0;
    this.score = 0;
    this.state = 'playing';
    this.message = '向右突击，消灭敌人并击败终点 Boss。';
    this.player = {
      x: 80,
      y: GROUND_Y - 64,
      w: 38,
      h: 64,
      vx: 0,
      vy: 0,
      hp: 100,
      lives: 3,
      facing: 1,
      onGround: false,
      shootCd: 0,
      invincible: 0,
    };
    this.bullets = [];
    this.particles = [];
    this.platforms = [
      { x: 420, y: 350, w: 210, h: 24 },
      { x: 820, y: 295, w: 190, h: 24 },
      { x: 1280, y: 340, w: 240, h: 24 },
      { x: 1780, y: 300, w: 220, h: 24 },
      { x: 2360, y: 345, w: 240, h: 24 },
    ];
    this.enemies = [
      this.makeEnemy(620, GROUND_Y - 48, 'soldier'),
      this.makeEnemy(980, GROUND_Y - 48, 'soldier'),
      this.makeEnemy(1460, 292, 'drone'),
      this.makeEnemy(1760, GROUND_Y - 48, 'soldier'),
      this.makeEnemy(2140, GROUND_Y - 48, 'soldier'),
      this.makeEnemy(2520, 297, 'drone'),
      this.makeEnemy(3180, GROUND_Y - 118, 'boss'),
    ];
    this.emitStatus();
  }

  private makeEnemy(x: number, y: number, type: Enemy['type']): Enemy {
    if (type === 'boss') {
      return { x, y, w: 110, h: 118, hp: 260, maxHp: 260, type, dir: -1, shootTimer: 0.9, alive: true };
    }
    if (type === 'drone') {
      return { x, y, w: 46, h: 36, hp: 40, maxHp: 40, type, dir: -1, shootTimer: 1.2, alive: true };
    }
    return { x, y, w: 42, h: 48, hp: 55, maxHp: 55, type, dir: -1, shootTimer: 1.5, alive: true };
  }

  private onKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    keys.add(key);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (this.state !== 'playing' && key === 'enter') this.reset();
  }

  private onKeyUp(event: KeyboardEvent) {
    keys.delete(event.key.toLowerCase());
  }

  private loop = (time: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min((time - this.lastTime) / 1000, 0.033);
    this.lastTime = time;
    this.update(dt);
    this.draw();
  };

  private update(dt: number) {
    if (this.state === 'playing') {
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.updateParticles(dt);
      this.updateCamera();
      this.checkWinLose();
      this.emitStatus();
    } else {
      this.updateParticles(dt);
    }
  }

  private updatePlayer(dt: number) {
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    const jump = keys.has('w') || keys.has('k') || keys.has('arrowup');
    const shoot = keys.has('j') || keys.has('x') || keys.has('control');

    const speed = 270;
    this.player.vx = 0;
    if (left) {
      this.player.vx = -speed;
      this.player.facing = -1;
    }
    if (right) {
      this.player.vx = speed;
      this.player.facing = 1;
    }
    if (jump && this.player.onGround) {
      this.player.vy = -650;
      this.player.onGround = false;
      this.spawnDust(this.player.x + this.player.w / 2, this.player.y + this.player.h);
    }

    this.player.x += this.player.vx * dt;
    this.player.x = Math.max(0, Math.min(WORLD_W - this.player.w, this.player.x));

    this.player.vy += GRAVITY * dt;
    this.player.y += this.player.vy * dt;
    this.resolvePlayerGround();

    this.player.shootCd = Math.max(0, this.player.shootCd - dt);
    this.player.invincible = Math.max(0, this.player.invincible - dt);
    if (shoot && this.player.shootCd <= 0) this.playerShoot();
  }

  private resolvePlayerGround() {
    this.player.onGround = false;
    if (this.player.y + this.player.h >= GROUND_Y) {
      this.player.y = GROUND_Y - this.player.h;
      this.player.vy = 0;
      this.player.onGround = true;
    }

    for (const p of this.platforms) {
      const falling = this.player.vy >= 0;
      const withinX = this.player.x + this.player.w > p.x && this.player.x < p.x + p.w;
      const feet = this.player.y + this.player.h;
      const closeTop = feet >= p.y && feet <= p.y + 26;
      if (falling && withinX && closeTop) {
        this.player.y = p.y - this.player.h;
        this.player.vy = 0;
        this.player.onGround = true;
      }
    }
  }

  private playerShoot() {
    this.player.shootCd = 0.15;
    const y = this.player.y + 28;
    const x = this.player.facing > 0 ? this.player.x + this.player.w : this.player.x - 16;
    this.bullets.push({ x, y, w: 18, h: 6, vx: 780 * this.player.facing, from: 'player', damage: 18 });
    this.spawnMuzzle(x, y);
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = this.player.x - enemy.x;
      const distance = Math.abs(dx);
      enemy.dir = dx >= 0 ? 1 : -1;

      if (enemy.type === 'soldier') {
        if (distance < 460) enemy.x += enemy.dir * 55 * dt;
        enemy.y = GROUND_Y - enemy.h;
      }

      if (enemy.type === 'drone') {
        enemy.y += Math.sin(performance.now() / 280 + enemy.x) * 16 * dt;
      }

      if (enemy.type === 'boss') {
        enemy.y = GROUND_Y - enemy.h;
        if (distance < 620) enemy.x += enemy.dir * 22 * dt;
      }

      enemy.shootTimer -= dt;
      const shootRange = enemy.type === 'boss' ? 780 : 520;
      if (distance < shootRange && enemy.shootTimer <= 0) {
        this.enemyShoot(enemy);
        enemy.shootTimer = enemy.type === 'boss' ? 0.65 : 1.25 + Math.random() * 0.8;
      }

      if (this.hitTest(this.player, enemy)) this.damagePlayer(enemy.type === 'boss' ? 22 : 12);
    }
  }

  private enemyShoot(enemy: Enemy) {
    const size = enemy.type === 'boss' ? 14 : 8;
    const damage = enemy.type === 'boss' ? 18 : 10;
    this.bullets.push({
      x: enemy.dir > 0 ? enemy.x + enemy.w : enemy.x - size,
      y: enemy.y + enemy.h * 0.45,
      w: size,
      h: size,
      vx: enemy.dir * (enemy.type === 'boss' ? 430 : 360),
      from: 'enemy',
      damage,
    });
  }

  private updateBullets(dt: number) {
    for (const bullet of this.bullets) bullet.x += bullet.vx * dt;

    for (const bullet of this.bullets) {
      if (bullet.from === 'player') {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (this.hitTest(bullet, enemy)) {
            enemy.hp -= bullet.damage;
            bullet.w = 0;
            this.spawnExplosion(bullet.x, bullet.y, enemy.type === 'boss' ? '#ff4fd8' : '#ffe14d');
            if (enemy.hp <= 0) {
              enemy.alive = false;
              this.score += enemy.type === 'boss' ? 1200 : 150;
              this.spawnExplosion(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#ff4fd8', 28);
            }
          }
        }
      } else if (this.hitTest(bullet, this.player)) {
        bullet.w = 0;
        this.damagePlayer(bullet.damage);
      }
    }

    this.bullets = this.bullets.filter(b => b.w > 0 && b.x > this.cameraX - 200 && b.x < this.cameraX + VIEW_W + 300);
  }

  private damagePlayer(amount: number) {
    if (this.player.invincible > 0) return;
    this.player.hp -= amount;
    this.player.invincible = 1.0;
    this.message = `受到 ${amount} 点伤害！`;
    this.spawnExplosion(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#35f2ff', 14);

    if (this.player.hp <= 0) {
      this.player.lives -= 1;
      if (this.player.lives > 0) {
        this.player.hp = 100;
        this.player.x = Math.max(40, this.cameraX + 60);
        this.player.y = GROUND_Y - this.player.h;
        this.message = `损失一条生命，剩余 ${this.player.lives} 条。`;
      }
    }
  }

  private updateCamera() {
    const target = this.player.x - VIEW_W * 0.38;
    this.cameraX += (target - this.cameraX) * 0.12;
    this.cameraX = Math.max(0, Math.min(WORLD_W - VIEW_W, this.cameraX));
  }

  private checkWinLose() {
    const boss = this.enemies.find(e => e.type === 'boss');
    if (boss && !boss.alive) {
      this.state = 'win';
      this.message = '任务完成：你击败了终点 Boss，成功通关！按 Enter 重新开始。';
    }
    if (this.player.lives <= 0 && this.player.hp <= 0) {
      this.state = 'lose';
      this.message = '任务失败：按 Enter 重新挑战。';
    }
  }

  private emitStatus() {
    this.options.onStatus?.({
      hp: Math.max(0, this.player.hp),
      lives: Math.max(0, this.player.lives),
      score: this.score,
      message: this.message,
      state: this.state,
    });
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private draw() {
    this.ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawBackground();
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);
    this.drawWorld();
    this.drawPlatforms();
    this.drawEnemies();
    this.drawPlayer();
    this.drawBullets();
    this.drawParticles();
    this.ctx.restore();

    if (this.state !== 'playing') this.drawEndOverlay();
  }

  private drawBackground() {
    const g = this.ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#07112f');
    g.addColorStop(0.55, '#1a1644');
    g.addColorStop(1, '#071019');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    this.ctx.fillStyle = 'rgba(53,242,255,0.12)';
    for (let i = 0; i < 14; i++) {
      const x = (i * 230 - this.cameraX * 0.24) % (VIEW_W + 260) - 120;
      this.ctx.fillRect(x, 160 + (i % 4) * 20, 80, 190);
    }

    this.ctx.strokeStyle = 'rgba(53,242,255,0.22)';
    this.ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = 70 + i * 22;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(VIEW_W, y + Math.sin(i) * 16);
      this.ctx.stroke();
    }
  }

  private drawWorld() {
    this.ctx.fillStyle = '#151a2e';
    this.ctx.fillRect(0, GROUND_Y, WORLD_W, VIEW_H - GROUND_Y);
    this.ctx.strokeStyle = '#35f2ff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, GROUND_Y);
    this.ctx.lineTo(WORLD_W, GROUND_Y);
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(255,79,216,0.5)';
    this.ctx.fillRect(WORLD_W - 260, GROUND_Y - 150, 34, 150);
    this.ctx.fillStyle = 'rgba(53,242,255,0.35)';
    this.ctx.beginPath();
    this.ctx.arc(WORLD_W - 243, GROUND_Y - 170, 48, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawPlatforms() {
    for (const p of this.platforms) {
      this.ctx.fillStyle = '#26325a';
      this.ctx.fillRect(p.x, p.y, p.w, p.h);
      this.ctx.fillStyle = '#35f2ff';
      this.ctx.fillRect(p.x, p.y, p.w, 4);
    }
  }

  private drawPlayer() {
    const blink = this.player.invincible > 0 && Math.floor(performance.now() / 80) % 2 === 0;
    if (blink) return;
    const p = this.player;
    this.ctx.save();
    this.ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    if (p.facing < 0) this.ctx.scale(-1, 1);

    this.ctx.fillStyle = '#35f2ff';
    this.ctx.fillRect(-16, -22, 32, 44);
    this.ctx.fillStyle = '#f4f7ff';
    this.ctx.fillRect(-12, -42, 24, 20);
    this.ctx.fillStyle = '#ffe14d';
    this.ctx.fillRect(12, -8, 32, 8);
    this.ctx.fillStyle = '#ff4fd8';
    this.ctx.fillRect(-16, 22, 12, 22);
    this.ctx.fillRect(5, 22, 12, 22);
    this.ctx.restore();
  }

  private drawEnemies() {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'boss') {
        this.ctx.fillStyle = '#53183d';
        this.ctx.fillRect(e.x, e.y, e.w, e.h);
        this.ctx.fillStyle = '#ff4fd8';
        this.ctx.fillRect(e.x + 16, e.y + 20, e.w - 32, 18);
        this.drawHpBar(e);
        continue;
      }
      this.ctx.fillStyle = e.type === 'drone' ? '#ff4fd8' : '#ffe14d';
      this.ctx.fillRect(e.x, e.y, e.w, e.h);
      this.ctx.fillStyle = '#101426';
      this.ctx.fillRect(e.x + 8, e.y + 10, e.w - 16, 8);
      this.drawHpBar(e);
    }
  }

  private drawHpBar(e: Enemy) {
    this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.ctx.fillRect(e.x, e.y - 12, e.w, 6);
    this.ctx.fillStyle = e.type === 'boss' ? '#ff4fd8' : '#35f2ff';
    this.ctx.fillRect(e.x, e.y - 12, e.w * Math.max(0, e.hp / e.maxHp), 6);
  }

  private drawBullets() {
    for (const b of this.bullets) {
      this.ctx.fillStyle = b.from === 'player' ? '#35f2ff' : '#ff4fd8';
      this.ctx.shadowColor = this.ctx.fillStyle as string;
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
      this.ctx.shadowBlur = 0;
    }
  }

  private drawParticles() {
    for (const p of this.particles) {
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x, p.y, 5, 5);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawEndOverlay() {
    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.ctx.fillStyle = this.state === 'win' ? '#35f2ff' : '#ff4fd8';
    this.ctx.font = 'bold 54px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.state === 'win' ? 'MISSION CLEAR' : 'GAME OVER', VIEW_W / 2, VIEW_H / 2 - 20);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '22px Arial';
    this.ctx.fillText('按 Enter 重新开始', VIEW_W / 2, VIEW_H / 2 + 28);
  }

  private hitTest(a: Rect, b: Rect) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private spawnMuzzle(x: number, y: number) {
    for (let i = 0; i < 5; i++) this.particles.push({ x, y, vx: Math.random() * 120, vy: -80 + Math.random() * 160, life: 0.25, color: '#35f2ff' });
  }

  private spawnDust(x: number, y: number) {
    for (let i = 0; i < 8; i++) this.particles.push({ x, y, vx: -90 + Math.random() * 180, vy: -120 - Math.random() * 80, life: 0.35, color: '#8aa0c7' });
  }

  private spawnExplosion(x: number, y: number, color: string, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 240;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.55, color });
    }
  }
}
