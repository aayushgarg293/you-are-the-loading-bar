import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Worker } from '../objects/Worker';
import { MinigameScene } from './MinigameScene';
import { sfx } from '../audio/sound';

const COLS = 5;
const ROWS = 3;
const TILE = 132;
const GRID_LEFT = GAME_WIDTH / 2 - (COLS * TILE) / 2;
const GRID_TOP = 150;
const SECONDS_BEFORE_REFRESH = 60;

const TRACE_DEAD = 0x7a6a3c; // dull gold: no signal
const TRACE_LIVE = COLORS.yellow; // bright gold: signal flowing
const TILE_TINT = 0x9fd9ab; // deepens the tile art to circuit-board green

// A tile's traces (the gold lines on a circuit board) are stored as four on/off switches packed into one number,
// one bit per side: North = 1, East = 2, South = 4, West = 8. So a straight
// up-down wire is 1 + 4 = 5 and an L-shaped corner (up and right) is 1 + 2 = 3.
const N = 1, E = 2, S = 4, W = 8;
const SIDES = [N, E, S, W];
const OPPOSITE: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };
const STEP: Record<number, { dx: number; dy: number }> = {
  [N]: { dx: 0, dy: -1 },
  [E]: { dx: 1, dy: 0 },
  [S]: { dx: 0, dy: 1 },
  [W]: { dx: -1, dy: 0 },
};
const STRAIGHT = N | S;
const CORNER = N | E;
const TEE = N | E | S;

// Turning a tile a quarter-turn clockwise moves every wire to the next side:
// North becomes East, East becomes South, and so on.
function turned(sides: number, quarterTurns: number) {
  for (let i = 0; i < quarterTurns % 4; i++) sides = ((sides << 1) & 15) | (sides >> 3);
  return sides;
}

interface Tile {
  col: number;
  row: number;
  shape: number; // wires as drawn, before any turning
  turns: number; // quarter-turns clockwise so far
  need: number; // sides that must be connected for the solution (0 if not on the path)
  live: boolean; // is the signal reaching this tile?
  view: Phaser.GameObjects.Container;
  wires: Phaser.GameObjects.Graphics;
}

// Minigame "network.exe": no connection. The gold traces between the Wi-Fi
// router and the download port are scrambled. Click tiles to turn them until
// the signal can flow from router to port.
export class CircuitScene extends MinigameScene {
  private tiles: Tile[] = [];
  private startRow = 0;
  private endRow = 0;
  private port!: Phaser.GameObjects.Image;
  private portLead!: Phaser.GameObjects.Graphics;
  private worker!: Worker;
  private hintTween?: Phaser.Tweens.Tween;

  constructor() {
    super('Circuit');
  }

  create() {
    this.tiles = [];
    this.hintTween = undefined;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.62).setOrigin(0);

    // A backing board behind the grid.
    const board = this.add.graphics();
    board.fillStyle(COLORS.navy).fillRoundedRect(GRID_LEFT - 18, GRID_TOP - 18, COLS * TILE + 36, ROWS * TILE + 36, 22);

    this.buildPuzzle();

    const rowY = (row: number) => GRID_TOP + row * TILE + TILE / 2;
    const gridRight = GRID_LEFT + COLS * TILE;

    // Router on the left with a lead that is always live.
    const routerLead = this.add.graphics();
    this.drawLead(routerLead, GRID_LEFT - 120, GRID_LEFT, rowY(this.startRow), true);
    this.add.image(GRID_LEFT - 160, rowY(this.startRow) - 26, 'connection', 'router').setScale(0.8);

    // Download port on the right; its lead only lights up once the puzzle is solved.
    this.portLead = this.add.graphics();
    this.drawLead(this.portLead, gridRight, gridRight + 90, rowY(this.endRow), false);
    this.port = this.add.image(gridRight + 160, rowY(this.endRow), 'connection', 'port').setScale(0.8);

    this.worker = new Worker(this, 70, 688, { mood: 'panic', glasses: true }).setScale(0.42);

    // Wiggle the first tile until the player clicks something.
    const first = this.tileAt(0, this.startRow)!;
    this.hintTween = this.tweens.add({ targets: first.view, scale: 1.1, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.refreshPower();
    this.openWindow('network.exe', 'Click tiles to turn them. Connect the router to the download port');
    this.startFrustration(SECONDS_BEFORE_REFRESH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
  }

  // ---- Making a puzzle that is always solvable ----

  private buildPuzzle() {
    // 1. Walk a random route across the grid from the left edge to the right edge.
    this.startRow = Phaser.Math.Between(0, ROWS - 1);
    this.endRow = Phaser.Math.Between(0, ROWS - 1);
    let route = this.randomRoute();
    for (let tries = 0; tries < 40 && route.length < 8; tries++) route = this.randomRoute();

    // 2. Work out which two sides each tile on the route must connect.
    const need = new Map<string, number>();
    route.forEach((cell, i) => {
      const from = i === 0 ? W : this.sideTowards(cell, route[i - 1]);
      const to = i === route.length - 1 ? E : this.sideTowards(cell, route[i + 1]);
      need.set(`${cell.col},${cell.row}`, from | to);
    });

    // 3. Give every tile a wire shape (route tiles get one that fits) and a random turn.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const needed = need.get(`${col},${row}`) ?? 0;
        let shape: number;
        if (!needed) shape = Phaser.Utils.Array.GetRandom([STRAIGHT, CORNER, CORNER, TEE]);
        else if (Math.random() < 0.25) shape = TEE; // a T fits any route tile, and adds a decoy branch
        else shape = needed === (N | S) || needed === (E | W) ? STRAIGHT : CORNER;
        this.tiles.push(this.buildTile(col, row, shape, Phaser.Math.Between(0, 3), needed));
      }
    }

    // 4. Make sure it didn't come out already solved.
    const onRoute = this.tiles.filter((tile) => tile.need);
    for (let i = 0; this.isSolved() && i < 20; i++) {
      const tile = Phaser.Utils.Array.GetRandom(onRoute);
      tile.turns++;
      tile.view.setAngle(tile.turns * 90);
    }
  }

  // A random path that never crosses itself, found by trying directions in a
  // shuffled order and backing up from dead ends.
  private randomRoute() {
    const seen = new Set<string>();
    const route: { col: number; row: number }[] = [];
    const explore = (col: number, row: number): boolean => {
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS || seen.has(`${col},${row}`)) return false;
      seen.add(`${col},${row}`);
      route.push({ col, row });
      if (col === COLS - 1 && row === this.endRow) return true;
      for (const side of Phaser.Utils.Array.Shuffle([...SIDES])) {
        if (explore(col + STEP[side].dx, row + STEP[side].dy)) return true;
      }
      route.pop();
      return false;
    };
    explore(0, this.startRow);
    return route;
  }

  private sideTowards(from: { col: number; row: number }, to: { col: number; row: number }) {
    return SIDES.find((side) => from.col + STEP[side].dx === to.col && from.row + STEP[side].dy === to.row)!;
  }

  private buildTile(col: number, row: number, shape: number, turns: number, need: number): Tile {
    const panel = this.add.image(0, 0, 'connection', 'tile').setDisplaySize(TILE - 6, TILE - 6).setTint(TILE_TINT);
    const wires = this.add.graphics();
    const view = this.add.container(GRID_LEFT + col * TILE + TILE / 2, GRID_TOP + row * TILE + TILE / 2, [panel, wires]);
    view.setAngle(turns * 90);
    const tile: Tile = { col, row, shape, turns, need, live: false, view, wires };

    panel.setInteractive({ useHandCursor: true });
    panel.on('pointerdown', () => this.turn(tile));
    panel.on('pointerover', () => panel.clearTint()); // brightens under the cursor
    panel.on('pointerout', () => panel.setTint(TILE_TINT));
    return tile;
  }

  // ---- Playing ----

  private turn(tile: Tile) {
    if (this.finished) return;
    this.hintTween?.remove();
    this.hintTween = undefined;

    // Snap to where the last turn should have ended (in case the player is
    // clicking faster than the animation), then animate one more quarter-turn.
    this.tweens.killTweensOf(tile.view);
    tile.view.setScale(1).setAngle(tile.turns * 90);
    tile.turns++;
    sfx.turn();
    this.tweens.add({ targets: tile.view, angle: '+=90', duration: 110, ease: 'Quad.easeOut' });

    this.refreshPower();
    if (this.isSolved()) this.celebrate();
  }

  private tileAt(col: number, row: number) {
    return col < 0 || row < 0 || col >= COLS || row >= ROWS ? undefined : this.tiles[row * COLS + col];
  }

  private sidesOf(tile: Tile) {
    return turned(tile.shape, tile.turns);
  }

  // The signal spreads like a flood: start at the router, and keep stepping
  // into any neighbour whose wire meets ours, until nothing new lights up.
  private flowPower() {
    for (const tile of this.tiles) tile.live = false;
    const first = this.tileAt(0, this.startRow)!;
    if (!(this.sidesOf(first) & W)) return;

    first.live = true;
    const queue = [first];
    while (queue.length) {
      const tile = queue.shift()!;
      for (const side of SIDES) {
        if (!(this.sidesOf(tile) & side)) continue;
        const next = this.tileAt(tile.col + STEP[side].dx, tile.row + STEP[side].dy);
        if (next && !next.live && this.sidesOf(next) & OPPOSITE[side]) {
          next.live = true;
          queue.push(next);
        }
      }
    }
  }

  private isSolved() {
    this.flowPower();
    const last = this.tileAt(COLS - 1, this.endRow)!;
    return last.live && (this.sidesOf(last) & E) !== 0;
  }

  private refreshPower() {
    const solved = this.isSolved();
    for (const tile of this.tiles) this.drawWires(tile);
    this.drawLead(this.portLead, GRID_LEFT + COLS * TILE, GRID_LEFT + COLS * TILE + 90, GRID_TOP + this.endRow * TILE + TILE / 2, solved);
  }

  // ---- Drawing traces in code so they always line up exactly ----

  private drawWires(tile: Tile) {
    const half = TILE / 2;
    const colour = tile.live ? TRACE_LIVE : TRACE_DEAD;
    const g = tile.wires.clear();
    for (const [width, tint] of [[26, COLORS.navy], [14, colour]] as const) {
      g.lineStyle(width, tint);
      for (const side of SIDES) {
        if (tile.shape & side) g.lineBetween(0, 0, STEP[side].dx * half, STEP[side].dy * half);
      }
      g.fillStyle(tint).fillCircle(0, 0, width / 2 + 3);
    }
  }

  private drawLead(g: Phaser.GameObjects.Graphics, fromX: number, toX: number, y: number, live: boolean) {
    g.clear();
    g.lineStyle(26, COLORS.navy).lineBetween(fromX, y, toX, y);
    g.lineStyle(14, live ? TRACE_LIVE : TRACE_DEAD).lineBetween(fromX, y, toX, y);
  }

  private celebrate() {
    // The download port pulses as data starts to pour in.
    this.tweens.add({ targets: this.port, scale: 0.9, duration: 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const spark = this.add.image(this.port.x - 80, this.port.y - 60, 'props', 'zap').setScale(0.2);
    this.tweens.add({ targets: spark, scale: 0.7, alpha: 0, duration: 350, repeat: 3 });
    this.worker.setMood('cheer');
    this.win();
  }
}
