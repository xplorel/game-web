type Tile = {
  row: number;
  col: number;
  type: number;
  selected: boolean;
};

type Options = {
  onScoreChange?: (score: number) => void;
};

const ROWS = 8;
const COLS = 8;
const TYPE_COUNT = 5;
const COLORS = ['#35f2ff', '#ff4fd8', '#ffe14d', '#7cff6b', '#9b6bff'];

export class MatchGame {
  private ctx: CanvasRenderingContext2D;
  private tiles: Tile[][] = [];
  private selected: Tile | null = null;
  private score = 0;
  private disabled = false;
  private readonly padding = 38;
  private readonly gap = 10;
  private readonly tileSize: number;

  constructor(private canvas: HTMLCanvasElement, private options: Options = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas init failed');
    this.ctx = ctx;
    this.tileSize = (canvas.width - this.padding * 2 - this.gap * (COLS - 1)) / COLS;
    this.onClick = this.onClick.bind(this);
  }

  start() {
    this.disabled = false;
    this.score = 0;
    this.options.onScoreChange?.(this.score);
    this.initBoard();
    this.canvas.addEventListener('click', this.onClick);
    this.draw();
  }

  lock() {
    this.disabled = true;
  }

  destroy() {
    this.canvas.removeEventListener('click', this.onClick);
  }

  private initBoard() {
    this.tiles = [];
    for (let row = 0; row < ROWS; row++) {
      const line: Tile[] = [];
      for (let col = 0; col < COLS; col++) {
        line.push({ row, col, type: Math.floor(Math.random() * TYPE_COUNT), selected: false });
      }
      this.tiles.push(line);
    }
    this.removeStartMatches();
  }

  private removeStartMatches() {
    let matches = this.findMatches();
    let guard = 0;
    while (matches.length > 0 && guard < 20) {
      for (const tile of matches) tile.type = Math.floor(Math.random() * TYPE_COUNT);
      matches = this.findMatches();
      guard++;
    }
  }

  private onClick(event: MouseEvent) {
    if (this.disabled) return;
    const tile = this.getTile(event);
    if (!tile) return;

    if (!this.selected) {
      this.select(tile);
      return;
    }

    if (this.selected === tile) {
      this.clearSelect();
      this.draw();
      return;
    }

    if (!this.isNeighbor(this.selected, tile)) {
      this.select(tile);
      return;
    }

    this.swapAndCheck(this.selected, tile);
  }

  private getTile(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
    const step = this.tileSize + this.gap;
    const col = Math.floor((x - this.padding) / step);
    const row = Math.floor((y - this.padding) / step);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return this.tiles[row][col];
  }

  private select(tile: Tile) {
    this.clearSelect();
    tile.selected = true;
    this.selected = tile;
    this.draw();
  }

  private clearSelect() {
    if (this.selected) this.selected.selected = false;
    this.selected = null;
  }

  private isNeighbor(a: Tile, b: Tile) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  private swapAndCheck(a: Tile, b: Tile) {
    this.disabled = true;
    this.swap(a, b);
    this.clearSelect();
    this.draw();

    const matches = this.findMatches();
    if (matches.length === 0) {
      window.setTimeout(() => {
        this.swap(a, b);
        this.disabled = false;
        this.draw();
      }, 200);
      return;
    }

    window.setTimeout(() => this.resolve(matches), 180);
  }

  private swap(a: Tile, b: Tile) {
    const type = a.type;
    a.type = b.type;
    b.type = type;
  }

  private findMatches() {
    const set = new Set<Tile>();

    for (let row = 0; row < ROWS; row++) {
      let count = 1;
      for (let col = 1; col <= COLS; col++) {
        const current = this.tiles[row][col]?.type;
        const prev = this.tiles[row][col - 1].type;
        if (current === prev) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = 1; i <= count; i++) set.add(this.tiles[row][col - i]);
          }
          count = 1;
        }
      }
    }

    for (let col = 0; col < COLS; col++) {
      let count = 1;
      for (let row = 1; row <= ROWS; row++) {
        const current = this.tiles[row]?.[col]?.type;
        const prev = this.tiles[row - 1][col].type;
        if (current === prev) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = 1; i <= count; i++) set.add(this.tiles[row - i][col]);
          }
          count = 1;
        }
      }
    }

    return Array.from(set);
  }

  private resolve(matches: Tile[]) {
    this.score += matches.length * 20;
    this.options.onScoreChange?.(this.score);
    for (const tile of matches) tile.type = -1;
    this.draw();

    window.setTimeout(() => {
      this.drop();
      this.draw();
      const next = this.findMatches();
      if (next.length > 0) {
        window.setTimeout(() => this.resolve(next), 180);
      } else {
        this.disabled = false;
      }
    }, 220);
  }

  private drop() {
    for (let col = 0; col < COLS; col++) {
      const values: number[] = [];
      for (let row = ROWS - 1; row >= 0; row--) {
        const type = this.tiles[row][col].type;
        if (type !== -1) values.push(type);
      }
      for (let row = ROWS - 1; row >= 0; row--) {
        this.tiles[row][col].type = values.shift() ?? Math.floor(Math.random() * TYPE_COUNT);
      }
    }
  }

  private draw() {
    this.drawBackground();
    for (const row of this.tiles) {
      for (const tile of row) this.drawTile(tile);
    }
  }

  private drawBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, '#120a2a');
    gradient.addColorStop(1, '#28051d');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawTile(tile: Tile) {
    if (tile.type < 0) return;
    const x = this.padding + tile.col * (this.tileSize + this.gap);
    const y = this.padding + tile.row * (this.tileSize + this.gap);
    const color = COLORS[tile.type];

    this.ctx.save();
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = tile.selected ? 28 : 12;
    this.ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = tile.selected ? 5 : 3;
    this.roundRect(x, y, this.tileSize, this.tileSize, 18);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.fillStyle = color;
    this.ctx.font = `${tile.selected ? 46 : 40}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(String(tile.type + 1), x + this.tileSize / 2, y + this.tileSize / 2);
    this.ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }
}
