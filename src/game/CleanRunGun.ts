type Status = { hp: number; lives: number; score: number; message: string; state: 'playing' | 'win' | 'lose' };
type Opt = { onStatus?: (s: Status) => void };
type Rect = { x: number; y: number; w: number; h: number };
type Enemy = Rect & { hp: number; maxHp: number; kind: 'soldier' | 'drone' | 'turret' | 'boss'; alive: boolean; dir: number; cd: number; phase: number };
type Bullet = Rect & { vx: number; vy: number; from: 'hero' | 'enemy'; damage: number; color: string };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };

const Keys = new Set<string>();
const W = 960;
const H = 540;
const FLOOR = 448;
const WORLD = 3600;
const GRAVITY = 1900;

export class RunGunGame {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private cam = 0;
  private shake = 0;
  private score = 0;
  private state: Status['state'] = 'playing';
  private message = '任务：一路向右突击，摧毁终点战争机甲。';
  private hero = { x: 90, y: FLOOR - 86, w: 48, h: 86, vx: 0, vy: 0, hp: 100, lives: 3, face: 1, cd: 0, inv: 0, ground: false };
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private platforms: Rect[] = [];
  private pickups: Array<Rect & { type: 'med' | 'power'; taken: boolean }> = [];

  constructor(private canvas: HTMLCanvasElement, private opt: Opt = {}) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('canvas');
    this.ctx = c;
    this.down = this.down.bind(this);
    this.up = this.up.bind(this);
  }

  start() {
    this.reset();
    addEventListener('keydown', this.down);
    addEventListener('keyup', this.up);
    this.last = performance.now();
    this.loop(this.last);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this.down);
    removeEventListener('keyup', this.up);
    Keys.clear();
  }

  private reset() {
    this.cam = 0;
    this.score = 0;
    this.shake = 0;
    this.state = 'playing';
    this.message = '任务：一路向右突击，摧毁终点战争机甲。';
    this.hero = { x: 90, y: FLOOR - 86, w: 48, h: 86, vx: 0, vy: 0, hp: 100, lives: 3, face: 1, cd: 0, inv: 0, ground: false };
    this.bullets = [];
    this.particles = [];
    this.platforms = [
      { x: 420, y: 350, w: 230, h: 26 },
      { x: 820, y: 292, w: 220, h: 26 },
      { x: 1230, y: 348, w: 250, h: 26 },
      { x: 1640, y: 292, w: 250, h: 26 },
      { x: 2060, y: 340, w: 260, h: 26 },
      { x: 2590, y: 318, w: 230, h: 26 }
    ];
    this.pickups = [
      { x: 900, y: 250, w: 34, h: 34, type: 'med', taken: false },
      { x: 1730, y: 250, w: 34, h: 34, type: 'power', taken: false },
      { x: 2250, y: 300, w: 34, h: 34, type: 'med', taken: false }
    ];
    this.enemies = [
      this.enemy(610, FLOOR - 68, 'soldier'),
      this.enemy(980, FLOOR - 68, 'soldier'),
      this.enemy(1280, 292, 'drone'),
      this.enemy(1530, FLOOR - 68, 'turret'),
      this.enemy(1880, FLOOR - 68, 'soldier'),
      this.enemy(2300, 292, 'drone'),
      this.enemy(2660, FLOOR - 68, 'soldier'),
      this.enemy(3180, FLOOR - 180, 'boss')
    ];
    this.emit();
  }

  private enemy(x: number, y: number, kind: Enemy['kind']): Enemy {
    if (kind === 'boss') return { x, y, w: 190, h: 180, hp: 420, maxHp: 420, kind, alive: true, dir: -1, cd: 0.8, phase: 1 };
    if (kind === 'drone') return { x, y, w: 76, h: 52, hp: 55, maxHp: 55, kind, alive: true, dir: -1, cd: 1.1, phase: 1 };
    if (kind === 'turret') return { x, y, w: 70, h: 68, hp: 90, maxHp: 90, kind, alive: true, dir: -1, cd: 0.9, phase: 1 };
    return { x, y, w: 58, h: 68, hp: 70, maxHp: 70, kind, alive: true, dir: -1, cd: 1.3, phase: 1 };
  }

  private down(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    Keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (this.state !== 'playing' && k === 'enter') this.reset();
  }

  private up(e: KeyboardEvent) {
    Keys.delete(e.key.toLowerCase());
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((t - this.last) / 1000, 0.033);
    this.last = t;
    this.update(dt);
    this.draw(t / 1000);
  };

  private update(dt: number) {
    if (this.state === 'playing') {
      this.updateHero(dt);
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.updatePickups();
      this.cam += (this.hero.x - W * 0.38 - this.cam) * 0.12;
      this.cam = Math.max(0, Math.min(WORLD - W, this.cam));
      const boss = this.enemies.find(e => e.kind === 'boss');
      if (boss && !boss.alive) {
        this.state = 'win';
        this.message = '通关成功：战争机甲已摧毁。按 Enter 再来一局。';
      }
      if (this.hero.lives <= 0 && this.hero.hp <= 0) {
        this.state = 'lose';
        this.message = '任务失败：按 Enter 重新挑战。';
      }
      this.emit();
    }
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 16);
  }

  private updateHero(dt: number) {
    const left = Keys.has('a') || Keys.has('arrowleft');
    const right = Keys.has('d') || Keys.has('arrowright');
    const jump = Keys.has('w') || Keys.has('k') || Keys.has('arrowup');
    const fire = Keys.has('j') || Keys.has('x') || Keys.has('control') || Keys.has(' ');
    this.hero.vx = 0;
    if (left) { this.hero.vx = -330; this.hero.face = -1; }
    if (right) { this.hero.vx = 330; this.hero.face = 1; }
    if (jump && this.hero.ground) {
      this.hero.vy = -720;
      this.hero.ground = false;
      this.dust(this.hero.x + 25, this.hero.y + this.hero.h);
    }
    this.hero.x = Math.max(0, Math.min(WORLD - this.hero.w, this.hero.x + this.hero.vx * dt));
    this.hero.vy += GRAVITY * dt;
    this.hero.y += this.hero.vy * dt;
    this.resolveGround();
    this.hero.cd -= dt;
    this.hero.inv = Math.max(0, this.hero.inv - dt);
    if (fire && this.hero.cd <= 0) this.fireHero();
  }

  private resolveGround() {
    this.hero.ground = false;
    if (this.hero.y + this.hero.h >= FLOOR) {
      this.hero.y = FLOOR - this.hero.h;
      this.hero.vy = 0;
      this.hero.ground = true;
    }
    for (const p of this.platforms) {
      const feet = this.hero.y + this.hero.h;
      if (this.hero.vy >= 0 && this.hero.x + this.hero.w > p.x && this.hero.x < p.x + p.w && feet >= p.y && feet <= p.y + 28) {
        this.hero.y = p.y - this.hero.h;
        this.hero.vy = 0;
        this.hero.ground = true;
      }
    }
  }

  private fireHero() {
    this.hero.cd = 0.13;
    const x = this.hero.face > 0 ? this.hero.x + this.hero.w - 3 : this.hero.x - 26;
    const y = this.hero.y + 35;
    this.bullets.push({ x, y, w: 28, h: 7, vx: 920 * this.hero.face, vy: 0, from: 'hero', damage: 24, color: '#37f6ff' });
    this.spark(x, y, '#37f6ff', 5, 160);
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = this.hero.x - e.x;
      const dist = Math.abs(dx);
      e.dir = dx >= 0 ? 1 : -1;
      if (e.kind === 'soldier' && dist < 560) e.x += e.dir * 62 * dt;
      if (e.kind === 'drone') e.y += Math.sin(performance.now() / 260 + e.x) * 26 * dt;
      if (e.kind === 'boss' && dist < 720) {
        e.phase = e.hp < e.maxHp * 0.45 ? 2 : 1;
        e.x += e.dir * (e.phase === 2 ? 36 : 22) * dt;
      }
      e.cd -= dt;
      const range = e.kind === 'boss' ? 880 : e.kind === 'drone' ? 650 : 520;
      if (dist < range && e.cd <= 0) {
        this.fireEnemy(e);
        e.cd = e.kind === 'boss' ? (e.phase === 2 ? 0.38 : 0.58) : 1.0 + Math.random() * 0.8;
      }
      if (this.hit(this.hero, e)) this.hurtHero(e.kind === 'boss' ? 24 : 12);
    }
  }

  private fireEnemy(e: Enemy) {
    if (e.kind === 'boss' && e.phase === 2) {
      for (let i = -1; i <= 1; i++) this.bullets.push({ x: e.x + (e.dir > 0 ? e.w : -18), y: e.y + 70 + i * 22, w: 16, h: 16, vx: e.dir * 460, vy: i * 40, from: 'enemy', damage: 16, color: '#ff4bd8' });
      this.shake = 5;
      return;
    }
    const size = e.kind === 'boss' ? 18 : 10;
    this.bullets.push({ x: e.x + (e.dir > 0 ? e.w : -size), y: e.y + e.h * 0.45, w: size, h: size, vx: e.dir * (e.kind === 'boss' ? 500 : 390), vy: 0, from: 'enemy', damage: e.kind === 'boss' ? 18 : 10, color: e.kind === 'boss' ? '#ff4bd8' : '#ffbe35' });
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const b of this.bullets) {
      if (b.from === 'hero') {
        for (const e of this.enemies) {
          if (!e.alive || !this.hit(b, e)) continue;
          e.hp -= b.damage;
          b.w = 0;
          this.spark(b.x, b.y, e.kind === 'boss' ? '#ff4bd8' : '#ffe45c', e.kind === 'boss' ? 16 : 9, 260);
          if (e.hp <= 0) {
            e.alive = false;
            this.score += e.kind === 'boss' ? 1800 : e.kind === 'turret' ? 260 : 180;
            this.explode(e.x + e.w / 2, e.y + e.h / 2, e.kind === 'boss' ? 52 : 22);
            if (e.kind === 'boss') this.shake = 14;
          }
        }
      } else if (this.hit(b, this.hero)) {
        b.w = 0;
        this.hurtHero(b.damage);
      }
    }
    this.bullets = this.bullets.filter(b => b.w > 0 && b.x > this.cam - 160 && b.x < this.cam + W + 220 && b.y > -80 && b.y < H + 80);
  }

  private updatePickups() {
    for (const p of this.pickups) {
      if (p.taken || !this.hit(this.hero, p)) continue;
      p.taken = true;
      if (p.type === 'med') {
        this.hero.hp = Math.min(100, this.hero.hp + 35);
        this.message = '获得医疗包：生命恢复。';
        this.spark(p.x, p.y, '#5cff9d', 20, 180);
      } else {
        this.score += 300;
        this.message = '获得能量核心：分数提升。';
        this.spark(p.x, p.y, '#ffe45c', 24, 220);
      }
    }
  }

  private hurtHero(damage: number) {
    if (this.hero.inv > 0) return;
    this.hero.hp -= damage;
    this.hero.inv = 0.9;
    this.shake = 7;
    this.message = `受到 ${damage} 点伤害！`;
    this.spark(this.hero.x + this.hero.w / 2, this.hero.y + 40, '#37f6ff', 12, 220);
    if (this.hero.hp <= 0) {
      this.hero.lives -= 1;
      if (this.hero.lives > 0) {
        this.hero.hp = 100;
        this.hero.x = Math.max(60, this.cam + 70);
        this.hero.y = FLOOR - this.hero.h;
        this.hero.vy = 0;
        this.message = `损失一条生命，剩余 ${this.hero.lives} 条。`;
      }
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 720 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private draw(time: number) {
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, W, H);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    c.save();
    c.translate(sx, sy);
    this.drawSky(time);
    c.save();
    c.translate(-this.cam, 0);
    this.drawStage(time);
    for (const item of this.pickups) if (!item.taken) this.drawPickup(item, time);
    for (const e of this.enemies) if (e.alive) this.drawEnemy(e, time);
    this.drawHero(time);
    this.drawBullets();
    this.drawParticles();
    c.restore();
    this.drawVignette();
    if (this.state !== 'playing') this.drawResult();
    c.restore();
  }

  private drawSky(time: number) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#040a24');
    g.addColorStop(0.48, '#15145b');
    g.addColorStop(1, '#071018');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    this.layer(0.12, 155, '#081232', 95);
    this.layer(0.25, 225, '#101f48', 72);
    this.layer(0.42, 300, '#172b5d', 48);
    for (let i = 0; i < 26; i++) {
      const x = (i * 150 - this.cam * 0.3) % (W + 240) - 120;
      const h = 80 + (i % 7) * 22;
      c.fillStyle = i % 2 ? 'rgba(255,68,210,.18)' : 'rgba(45,230,255,.16)';
      c.fillRect(x, 335 - h, 42 + (i % 4) * 16, h);
      c.fillStyle = i % 2 ? '#ff4bd8' : '#37f6ff';
      for (let y = 340 - h + 12; y < 320; y += 22) c.fillRect(x + 8 + (y % 3) * 8, y, 12, 3);
    }
    c.fillStyle = `rgba(55,246,255,${0.08 + Math.sin(time * 2) * 0.03})`;
    c.beginPath();
    c.arc(760, 92, 58, 0, Math.PI * 2);
    c.fill();
  }

  private layer(speed: number, y: number, color: string, amp: number) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W + 80; x += 80) {
      const wx = x + this.cam * speed;
      c.lineTo(x, y + Math.sin(wx * 0.012) * amp * 0.28 + Math.cos(wx * 0.023) * amp * 0.18);
    }
    c.lineTo(W, H);
    c.closePath();
    c.fill();
  }

  private drawStage(time: number) {
    const c = this.ctx;
    c.fillStyle = '#111827';
    c.fillRect(0, FLOOR, WORLD, H - FLOOR);
    for (let x = 0; x < WORLD; x += 64) {
      c.fillStyle = x % 128 ? '#27334b' : '#33405f';
      c.fillRect(x, FLOOR, 62, 42);
      c.fillStyle = '#1a2236';
      c.fillRect(x, FLOOR + 32, 62, 12);
      c.fillStyle = '#37f6ff';
      c.fillRect(x + 8, FLOOR + 7, 28, 4);
      c.fillStyle = '#ff4bd8';
      c.fillRect(x + 42, FLOOR + 22, 15, 4);
    }
    c.strokeStyle = '#37f6ff';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, FLOOR);
    c.lineTo(WORLD, FLOOR);
    c.stroke();
    for (const p of this.platforms) this.drawPlatform(p);
    this.drawGate(WORLD - 220, FLOOR - 170, time);
  }

  private drawPlatform(p: Rect) {
    const c = this.ctx;
    c.fillStyle = '#2d3854';
    c.fillRect(p.x, p.y, p.w, p.h);
    c.fillStyle = '#4e5d7a';
    c.fillRect(p.x, p.y, p.w, 8);
    c.fillStyle = '#37f6ff';
    c.fillRect(p.x + 12, p.y + 5, p.w - 24, 3);
    c.fillStyle = '#111827';
    for (let x = p.x + 14; x < p.x + p.w - 20; x += 44) c.fillRect(x, p.y + 14, 24, 7);
  }

  private drawGate(x: number, y: number, time: number) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.strokeStyle = '#ff4bd8';
    c.lineWidth = 7;
    c.shadowColor = '#ff4bd8';
    c.shadowBlur = 22;
    c.beginPath();
    c.arc(0, 65, 60 + Math.sin(time * 4) * 3, -Math.PI / 2, Math.PI * 1.5);
    c.stroke();
    c.fillStyle = 'rgba(55,246,255,.18)';
    c.beginPath();
    c.arc(0, 65, 42, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private drawHero(time: number) {
    const c = this.ctx;
    if (this.hero.inv > 0 && Math.floor(time * 18) % 2 === 0) return;
    const x = this.hero.x;
    const y = this.hero.y;
    const bob = this.hero.ground ? Math.sin(time * 14) * (Math.abs(this.hero.vx) > 0 ? 3 : 1) : 0;
    c.save();
    c.translate(x + this.hero.w / 2, y + 43 + bob);
    c.scale(this.hero.face, 1);
    c.shadowColor = '#37f6ff';
    c.shadowBlur = 12;
    c.fillStyle = '#0d1a2d';
    c.fillRect(-18, -32, 38, 54);
    c.fillStyle = '#26d9ff';
    c.fillRect(-15, -28, 31, 44);
    c.fillStyle = '#e8fbff';
    c.fillRect(-12, -58, 26, 22);
    c.fillStyle = '#ff3856';
    c.fillRect(-20, -62, 38, 7);
    c.fillRect(-35, -59, 17, 5);
    c.fillStyle = '#ffe45c';
    c.fillRect(15, -13, 48, 9);
    c.fillStyle = '#1a2130';
    c.fillRect(48, -10, 21, 5);
    c.fillStyle = '#125d7a';
    c.fillRect(-18, 18, 15, 31);
    c.fillRect(7, 18, 15, 31);
    c.fillStyle = '#05070d';
    c.fillRect(-22, 46, 24, 8);
    c.fillRect(4, 46, 27, 8);
    if (this.hero.cd > 0.06) {
      c.fillStyle = '#ffffff';
      c.fillRect(68, -17, 22, 10);
      c.fillStyle = '#37f6ff';
      c.fillRect(90, -14, 34, 5);
    }
    c.restore();
  }

  private drawEnemy(e: Enemy, time: number) {
    if (e.kind === 'boss') { this.drawBoss(e, time); this.drawHp(e); return; }
    if (e.kind === 'drone') { this.drawDrone(e, time); this.drawHp(e); return; }
    if (e.kind === 'turret') { this.drawTurret(e, time); this.drawHp(e); return; }
    this.drawSoldier(e, time);
    this.drawHp(e);
  }

  private drawSoldier(e: Enemy, time: number) {
    const c = this.ctx;
    c.save();
    c.translate(e.x + e.w / 2, e.y + e.h / 2 + Math.sin(time * 10 + e.x) * 1.5);
    c.scale(e.dir, 1);
    c.shadowColor = '#ffbe35';
    c.shadowBlur = 9;
    c.fillStyle = '#3b2414';
    c.fillRect(-16, -28, 34, 50);
    c.fillStyle = '#ffb82e';
    c.fillRect(-13, -25, 29, 39);
    c.fillStyle = '#1b1c22';
    c.fillRect(-12, -50, 30, 22);
    c.fillStyle = '#ff4bd8';
    c.fillRect(0, -43, 22, 7);
    c.fillStyle = '#1a2130';
    c.fillRect(13, -10, 42, 10);
    c.fillStyle = '#7d3d21';
    c.fillRect(-16, 17, 12, 26);
    c.fillRect(7, 17, 12, 26);
    c.fillStyle = '#05070d';
    c.fillRect(-21, 39, 22, 8);
    c.fillRect(5, 39, 23, 8);
    c.restore();
  }

  private drawDrone(e: Enemy, time: number) {
    const c = this.ctx;
    c.save();
    c.translate(e.x + e.w / 2, e.y + e.h / 2);
    c.shadowColor = '#ff4bd8';
    c.shadowBlur = 16;
    c.fillStyle = '#1d2131';
    c.fillRect(-35, -14, 70, 28);
    c.fillStyle = '#cf28a7';
    c.beginPath();
    c.moveTo(-48, -11); c.lineTo(-10, -32); c.lineTo(38, -20); c.lineTo(52, 0); c.lineTo(24, 21); c.lineTo(-32, 18); c.closePath(); c.fill();
    c.fillStyle = '#37f6ff';
    c.beginPath(); c.arc(24, -3, 11 + Math.sin(time * 8) * 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(55,246,255,.55)';
    c.beginPath(); c.moveTo(-10, 18); c.lineTo(10, 18); c.lineTo(0, 48 + Math.sin(time * 16) * 5); c.fill();
    c.restore();
  }

  private drawTurret(e: Enemy, time: number) {
    const c = this.ctx;
    c.save();
    c.translate(e.x + e.w / 2, e.y + e.h / 2);
    c.fillStyle = '#2b344a';
    c.fillRect(-28, -12, 56, 40);
    c.fillStyle = '#697897';
    c.fillRect(-20, -32, 40, 24);
    c.fillStyle = '#ff4bd8';
    c.fillRect(12 * e.dir, -24, 50 * e.dir, 12);
    c.fillStyle = '#37f6ff';
    c.fillRect(-12, -3, 24, 8);
    c.restore();
  }

  private drawBoss(e: Enemy, time: number) {
    const c = this.ctx;
    c.save();
    c.translate(e.x + e.w / 2, e.y + e.h / 2);
    c.scale(e.dir, 1);
    c.shadowColor = e.phase === 2 ? '#ff4bd8' : '#37f6ff';
    c.shadowBlur = 22;
    c.fillStyle = '#21142e';
    c.fillRect(-82, -62, 128, 106);
    c.fillStyle = '#6b2ca7';
    c.fillRect(-68, -82, 96, 36);
    c.fillStyle = '#111827';
    c.fillRect(36, -31, 92, 38);
    c.fillStyle = '#0b101b';
    c.fillRect(111, -20, 35, 17);
    c.fillStyle = e.phase === 2 ? '#ff4bd8' : '#37f6ff';
    c.beginPath(); c.arc(-12, -12, 30 + Math.sin(time * 8) * 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff4bd8';
    c.fillRect(-105, -28, 29, 70);
    c.fillStyle = '#4a245f';
    c.fillRect(-72, 43, 38, 63);
    c.fillRect(14, 43, 38, 63);
    c.fillStyle = '#080b12';
    c.fillRect(-80, 96, 52, 15);
    c.fillRect(5, 96, 55, 15);
    c.restore();
  }

  private drawHp(e: Enemy) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,.65)';
    c.fillRect(e.x, e.y - 15, e.w, 8);
    c.fillStyle = e.kind === 'boss' ? '#ff4bd8' : '#37f6ff';
    c.fillRect(e.x, e.y - 15, e.w * Math.max(0, e.hp / e.maxHp), 8);
  }

  private drawPickup(p: Rect & { type: 'med' | 'power'; taken: boolean }, time: number) {
    const c = this.ctx;
    c.save();
    c.translate(p.x + p.w / 2, p.y + p.h / 2 + Math.sin(time * 6 + p.x) * 5);
    c.shadowColor = p.type === 'med' ? '#5cff9d' : '#ffe45c';
    c.shadowBlur = 14;
    c.fillStyle = '#151b28';
    c.fillRect(-17, -17, 34, 34);
    c.fillStyle = p.type === 'med' ? '#5cff9d' : '#ffe45c';
    if (p.type === 'med') { c.fillRect(-4, -12, 8, 24); c.fillRect(-12, -4, 24, 8); }
    else { c.beginPath(); c.moveTo(0, -14); c.lineTo(13, 0); c.lineTo(0, 14); c.lineTo(-13, 0); c.closePath(); c.fill(); }
    c.restore();
  }

  private drawBullets() {
    const c = this.ctx;
    for (const b of this.bullets) {
      c.save();
      c.shadowColor = b.color;
      c.shadowBlur = 16;
      c.fillStyle = b.color;
      if (b.from === 'hero') c.fillRect(b.x, b.y, b.w, b.h);
      else { c.beginPath(); c.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
  }

  private drawParticles() {
    const c = this.ctx;
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life * 1.8);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.size, p.size);
      c.globalAlpha = 1;
    }
  }

  private drawVignette() {
    const c = this.ctx;
    const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 620);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.48)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  private drawResult() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,.68)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = this.state === 'win' ? '#37f6ff' : '#ff4bd8';
    c.font = 'bold 58px Arial';
    c.textAlign = 'center';
    c.fillText(this.state === 'win' ? 'MISSION CLEAR' : 'GAME OVER', W / 2, H / 2 - 18);
    c.fillStyle = '#fff';
    c.font = '22px Arial';
    c.fillText('按 Enter 重新开始', W / 2, H / 2 + 30);
  }

  private hit(a: Rect, b: Rect) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private spark(x: number, y: number, color: string, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.35, size: 3 + Math.random() * 4, color });
    }
  }

  private explode(x: number, y: number, count: number) {
    this.spark(x, y, '#ff4bd8', count, 360);
    this.spark(x, y, '#ffe45c', Math.floor(count * 0.55), 280);
    this.spark(x, y, '#37f6ff', Math.floor(count * 0.35), 220);
  }

  private dust(x: number, y: number) {
    for (let i = 0; i < 10; i++) this.particles.push({ x, y, vx: -120 + Math.random() * 240, vy: -80 - Math.random() * 90, life: 0.3, size: 4, color: '#8aa0c7' });
  }

  private emit() {
    this.opt.onStatus?.({ hp: Math.max(0, this.hero.hp), lives: Math.max(0, this.hero.lives), score: this.score, message: this.message, state: this.state });
  }
}
