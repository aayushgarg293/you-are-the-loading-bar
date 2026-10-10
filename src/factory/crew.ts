import * as Phaser from 'phaser';
import { Mood, Worker } from '../objects/Worker';

export interface Point {
  x: number;
  y: number;
}

// One member of the factory crew: a worker plus the job that tells them what
// to do. The factory only ever says "the line is running" or "the line is
// stuck"; each job decides what that means for its own worker.
export interface CrewMember {
  worker: Worker;
  setRunning(running: boolean): void;
  // If set, the worker stares at this point instead of following the cursor.
  stareAt?: Point;
}

const WALK_SPEED = 185; // pixels per second, before the worker's own size is applied

// Jobs schedule things for later (walk, wait, walk again). When the factory
// state flips, anything already scheduled must be ignored. Each job keeps a
// "shift number" that goes up on every flip; a callback only runs if the shift
// it was booked in is still the current one.
function makeShift() {
  let current = 0;
  return {
    next: () => ++current,
    guard:
      (shift: number, action: () => void) =>
      () => {
        if (shift === current) action();
      },
  };
}

// Stands at a machine and works it. When the line stops, turns to glare at
// `blames` (usually the worker at the next station).
export function stationJob(worker: Worker, brokenMood: Mood, blames?: Point): CrewMember {
  const member: CrewMember = {
    worker,
    setRunning(running) {
      worker.setMood(running ? 'work' : brokenMood);
      member.stareAt = running ? undefined : blames;
      if (member.stareAt) worker.lookToward(member.stareAt.x, member.stareAt.y);
    },
  };
  return member;
}

// Asleep on their feet whatever happens.
export function sleeperJob(worker: Worker): CrewMember {
  return {
    worker,
    setRunning() {
      if (worker.mood !== 'asleep') worker.setMood('asleep');
    },
  };
}

// Strolls between random spots, pausing at each. Staggers about when the line stops.
export function wandererJob(scene: Phaser.Scene, worker: Worker, spots: Point[], brokenMood: Mood): CrewMember {
  const shift = makeShift();

  const stroll = (id: number) => {
    const spot = Phaser.Utils.Array.GetRandom(spots);
    worker.setMood('idle');
    worker.walkTo(
      spot.x,
      spot.y,
      WALK_SPEED * 0.6,
      shift.guard(id, () => {
        worker.setMood(Math.random() < 0.4 ? 'happy' : 'idle');
        scene.time.delayedCall(Phaser.Math.Between(900, 2600), shift.guard(id, () => stroll(id)));
      }),
    );
  };

  return {
    worker,
    setRunning(running) {
      const id = shift.next();
      worker.stopWalking();
      if (running) scene.time.delayedCall(Phaser.Math.Between(200, 1500), shift.guard(id, () => stroll(id)));
      else worker.setMood(brokenMood);
    },
  };
}

export interface CarrierRoute {
  pile: Point; // where blocks are picked up
  drop: Point; // where they are thrown onto the conveyor
}

// Fetches a block from the pile, carries it to the conveyor, throws it on,
// and goes back for another. Drops the block in fright when the line stops.
export function carrierJob(
  scene: Phaser.Scene,
  worker: Worker,
  route: CarrierRoute,
  brokenMood: Mood,
  onThrow: (from: Point) => void,
  onDrop: (at: Point) => void,
): CrewMember {
  const shift = makeShift();

  const fetch = (id: number) => {
    worker.setMood('idle');
    worker.walkTo(
      route.pile.x,
      route.pile.y,
      WALK_SPEED,
      shift.guard(id, () => {
        worker.pickUp('ui', 'blockGreen');
        scene.time.delayedCall(250, shift.guard(id, () => deliver(id)));
      }),
    );
  };

  const deliver = (id: number) => {
    worker.walkTo(
      route.drop.x,
      route.drop.y,
      WALK_SPEED * 0.85, // a little slower when loaded
      shift.guard(id, () => {
        worker.putDown();
        onThrow({ x: worker.x, y: worker.y - 130 * worker.scaleY });
        worker.setMood('happy');
        scene.time.delayedCall(450, shift.guard(id, () => fetch(id)));
      }),
    );
  };

  return {
    worker,
    setRunning(running) {
      const id = shift.next();
      worker.stopWalking();
      if (running) {
        if (worker.isCarrying) deliver(id);
        else fetch(id);
      } else {
        if (worker.isCarrying) {
          worker.putDown();
          onDrop({ x: worker.x + 34 * worker.scaleX, y: worker.y });
        }
        worker.setMood(brokenMood);
      }
    },
  };
}
