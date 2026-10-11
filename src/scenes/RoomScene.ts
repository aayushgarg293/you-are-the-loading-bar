import * as Phaser from 'phaser';
import { PIXEL_FONT, hex } from '../config';
import { DESK, INK, drawDeskSet } from '../cutscene/sets';
import { debugText } from '../debug';
import { STICK_MOODS, StickFigure, StickMood } from '../objects/StickFigure';

// A test bench for the real-world look, not part of the final game yet: the
// stick figure at their desk, in a flat grey room with thin black outlines and
// only a few spots of colour (the look of classic stick-figure animations). Press 1-5 (or click
// a label) to switch mood. The room itself is drawn by `drawDeskSet`, which
// the intro cutscene shares.
export class RoomScene extends Phaser.Scene {
  private figure!: StickFigure;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Room');
  }

  create() {
    this.labels = [];
    drawDeskSet(this, { screenOn: true, mug: true });
    this.figure = new StickFigure(this, DESK.seatX, DESK.floorY).setScale(1.25);

    STICK_MOODS.forEach((mood, i) => {
      const label = this.add
        .text(120 + i * 215, 668, `${i + 1} ${mood}`, { fontFamily: PIXEL_FONT, fontSize: '12px', color: hex(INK) })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.show(mood));
      this.labels.push(label);
      this.input.keyboard!.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'][i]}`, () => this.show(mood));
    });
    this.show((debugText('mood') as StickMood) ?? 'bored');
  }

  private show(mood: StickMood) {
    if (!STICK_MOODS.includes(mood)) return;
    this.figure.setMood(mood);
    this.labels.forEach((label, i) => label.setAlpha(STICK_MOODS[i] === mood ? 1 : 0.4));
  }
}
