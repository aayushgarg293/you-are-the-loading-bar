import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { SideWorker } from '../objects/SideWorker';
import { MinigameScene } from './MinigameScene';
import { sfx } from '../audio/sound';

const LANE_YS = [316, 462, 608]; // where feet touch each cable
const RUNNER_X = 250;
const CABLE_WIDTH = 162; // one cable picture, which repeats along each lane
const CABLES_PER_LANE = Math.ceil(GAME_WIDTH / CABLE_WIDTH) + 1;
const DISTANCE_TO_WIN = 11500; // pixels of cable to run
const SPEED_START = 340; // pixels per second
const SPEED_END = 540;
const HIT_PENALTY = 0.1;
const HIT_REACH = 62; // how close (in pixels) junk must be to trip the runner
const DAZED_FOR = 750; // milliseconds of safety after a hit
const SECONDS_BEFORE_REFRESH = 46;
const TRACK = { left: 400, right: 880, y: 116 };

// The junk that clogs a network cable. `pace` is how fast it comes at the
// runner compared with the cable itself: the snail crawls the same way the
// runner is going, so it closes in more slowly.
const JUNK = [
  { frame: 'popup', height: 96, pace: 1 },
  { frame: 'spam', height: 78, pace: 1 },
  { frame: 'cookie', height: 84, pace: 1 },
  { frame: 'sign404', height: 104, pace: 1 },
  { frame: 'snail', height: 80, pace: 0.6 },
];

interface Junk {
  image: Phaser.GameObjects.Image;
  lane: number;
  pace: number;
  hit: boolean;
}

// Minigame "packets.exe": a packet of data has to get down the cable, but the
// cable is full of internet junk. The runner never stops; the Up and Down
// arrow keys switch between three lanes to dodge pop-ups, spam and cookies.
export class PacketDeliveryScene extends MinigameScene {
  private runner!: SideWorker;
  private cables: Phaser.GameObjects.Image[] = [];
  private junk: Junk[] = [];
  private marker!: Phaser.GameObjects.Image;
  private keysHint?: Phaser.GameObjects.Container;
  private lane = 1;
  private distance = 0;
  private nextSpawnAt = 0; // measured in distance, so junk spacing stays fair as speed rises
  private dazedUntil = 0;
  private clock = 0;

  constructor() {
    super('PacketDelivery');
  }

  create() {
    this.cables = [];
    this.junk = [];
    this.lane = 1;
    this.distance = 0;
    this.nextSpawnAt = 700;
    this.dazedUntil = 0;
    this.clock = 0;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.72).setOrigin(0);

    // Three ribbon cables, each a row of the same picture laid end to end.
    for (const y of LANE_YS) {
      for (let i = 0; i < CABLES_PER_LANE; i++) {
        this.cables.push(this.add.image(i * CABLE_WIDTH, y - 8, 'packets', 'cable').setOrigin(0, 0));
      }
    }

    this.buildTrack();

    this.runner = new SideWorker(this, RUNNER_X, LANE_YS[this.lane], 0x9cc9ff).setScale(0.42);
    this.runner.carry('ui', 'blockGreen', 92).setRunning(true);
    this.runner.setDepth(this.depthOf(this.lane) + 1);

    this.keysHint = this.buildKeysHint(RUNNER_X + 150, LANE_YS[1] - 70);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-UP', () => this.changeLane(-1));
    keyboard.on('keydown-W', () => this.changeLane(-1));
    keyboard.on('keydown-DOWN', () => this.changeLane(1));
    keyboard.on('keydown-S', () => this.changeLane(1));

    this.openWindow('packets.exe', 'Up and Down arrow keys change cable. Dodge the junk and deliver the packet');
    this.startFrustration(SECONDS_BEFORE_REFRESH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
  }

  // Things on a lower cable are nearer the viewer, so they are drawn on top.
  private depthOf(lane: number) {
    return 10 + lane * 10;
  }

  // The journey meter: router on the left, download port on the right, and a
  // little packet that slides between them.
  private buildTrack() {
    const line = this.add.graphics();
    line.lineStyle(14, COLORS.navy).lineBetween(TRACK.left, TRACK.y, TRACK.right, TRACK.y);
    line.lineStyle(6, 0x7a6a3c).lineBetween(TRACK.left, TRACK.y, TRACK.right, TRACK.y);
    this.add.image(TRACK.left - 46, TRACK.y - 8, 'connection', 'router').setScale(0.3);
    this.add.image(TRACK.right + 42, TRACK.y, 'connection', 'port').setScale(0.3);
    this.marker = this.add.image(TRACK.left, TRACK.y, 'ui', 'blockGreen').setScale(0.26);
  }

  // Two key caps, shown until the player first presses a key.
  private buildKeysHint(x: number, y: number) {
    const keys = this.add.graphics();
    [-28, 28].forEach((offset, i) => {
      keys.fillStyle(COLORS.navy).fillRoundedRect(-24, offset - 24, 48, 48, 8);
      keys.fillStyle(COLORS.cream).fillRoundedRect(-20, offset - 21, 40, 38, 6);
      keys.fillStyle(COLORS.navy).fillTriangle(-9, offset + (i ? -7 : 5), 9, offset + (i ? -7 : 5), 0, offset + (i ? 7 : -9));
    });
    const hint = this.add.container(x, y, [keys]).setDepth(60);
    this.tweens.add({ targets: hint, scale: 1.12, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return hint;
  }

  private changeLane(step: number) {
    if (this.finished) return;
    this.keysHint?.destroy();
    this.keysHint = undefined;
    const lane = Phaser.Math.Clamp(this.lane + step, 0, LANE_YS.length - 1);
    if (lane === this.lane) return;
    this.lane = lane;
    sfx.whoosh();
    this.runner.setDepth(this.depthOf(lane) + 1);
    this.tweens.add({ targets: this.runner, y: LANE_YS[lane], duration: 110, ease: 'Quad.easeOut' });
  }

  // The round gets faster the further the packet has travelled.
  private get speed() {
    return Phaser.Math.Linear(SPEED_START, SPEED_END, this.distance / DISTANCE_TO_WIN);
  }

  // Puts junk on one cable, or later on two at once. One cable is always left
  // clear, so there is always a way through.
  private spawn() {
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]);
    const count = this.distance > DISTANCE_TO_WIN * 0.3 && Math.random() < 0.45 ? 2 : 1;
    for (const lane of lanes.slice(0, count)) {
      const kind = Phaser.Utils.Array.GetRandom(JUNK);
      const image = this.add.image(GAME_WIDTH + 120, LANE_YS[lane] + 4, 'packets', kind.frame).setOrigin(0.5, 1).setDepth(this.depthOf(lane));
      image.setScale(kind.height / image.height);
      this.junk.push({ image, lane, pace: kind.pace, hit: false });
    }
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.finished) return;
    this.clock += delta;

    const moved = (this.speed * delta) / 1000;
    this.distance += moved;

    // Slide the cables left and wrap each picture round to the right-hand end,
    // which makes a short strip look endless.
    for (const cable of this.cables) {
      cable.x -= moved;
      if (cable.x <= -CABLE_WIDTH) cable.x += CABLES_PER_LANE * CABLE_WIDTH;
    }

    if (this.distance >= this.nextSpawnAt && this.distance < DISTANCE_TO_WIN - 900) {
      this.spawn();
      this.nextSpawnAt = this.distance + Phaser.Math.Between(330, 470);
    }

    for (const item of this.junk) {
      item.image.x -= moved * item.pace;
      const close = Math.abs(item.image.x - (RUNNER_X + 50)) < HIT_REACH;
      if (close && !item.hit && item.lane === this.lane && this.clock > this.dazedUntil) this.trip(item);
    }
    const gone = this.junk.filter((item) => item.image.x < -150);
    for (const item of gone) item.image.destroy();
    if (gone.length) this.junk = this.junk.filter((item) => item.image.x >= -150);

    this.marker.x = Phaser.Math.Linear(TRACK.left, TRACK.right, Math.min(1, this.distance / DISTANCE_TO_WIN));
    if (this.clock > this.dazedUntil) this.runner.setMood('run').setAlpha(1);
    if (this.distance >= DISTANCE_TO_WIN) this.celebrate();
  }

  // Ran into junk: it is knocked flying, patience drops, and the runner is
  // dazed (and safe from further hits) for a moment.
  private trip(item: Junk) {
    item.hit = true;
    this.dazedUntil = this.clock + DAZED_FOR;
    this.addFrustration(HIT_PENALTY);
    this.cameras.main.shake(140, 0.006);
    this.runner.setMood('ouch').setAlpha(0.6);
    this.tweens.add({ targets: item.image, y: item.image.y - 220, x: item.image.x + 160, angle: 260, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
    const bang = this.add.image(RUNNER_X + 70, LANE_YS[item.lane] - 80, 'props', 'zap').setScale(0.25).setDepth(70);
    this.tweens.add({ targets: bang, scale: 0.7, alpha: 0, duration: 300, onComplete: () => bang.destroy() });
  }

  private celebrate() {
    this.runner.setMood('happy').setAlpha(1).setRunning(false);
    this.tweens.add({ targets: this.runner, y: this.runner.y - 40, duration: 200, yoyo: true, repeat: 3, ease: 'Quad.easeOut' });
    this.add
      .text(GAME_WIDTH / 2, 220, 'PACKET DELIVERED', { fontFamily: PIXEL_FONT, fontSize: '28px', color: hex(COLORS.green), stroke: hex(COLORS.navy), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(80);
    this.win();
  }
}
