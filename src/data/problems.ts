import type { ErrorMessage } from '../objects/ErrorDialog';
import type { Mood } from '../objects/Worker';

// The list of breakdowns, in order. The loading bar runs until it reaches a
// problem's `stallAt` percentage, then stops until that problem's minigame is won.
// Adding a breakdown to the game = one new minigame scene + one line here.
export interface Problem {
  id: string;
  stallAt: number;
  scene: string | null; // null = not built yet, the game simply stops here
  error?: ErrorMessage; // the error dialog the scheduler holds up
  powerOut?: boolean; // true if the hamster wheel stops during this problem
  crewMood?: Mood; // if set, the whole crew is forced into this mood while stuck
}

export const PROBLEMS: Problem[] = [
  {
    id: 'low-power',
    stallAt: 1,
    scene: 'FeedHamster',
    error: { title: 'power.exe', message: 'Battery low.\nThe hamster\nis hungry.', icon: { texture: 'feeding', frame: 'seed' } },
    powerOut: true,
  },
  {
    id: 'sleep-mode',
    stallAt: 12,
    scene: 'WakeWorkers',
    error: { title: 'threads.exe', message: 'Not responding.\nComputer went\nto sleep.', icon: { texture: 'zip', frame: 'hourglass' } },
    crewMood: 'asleep',
  },
  {
    id: 'no-connection',
    stallAt: 25,
    scene: 'Circuit',
    error: { title: 'network.exe', message: 'No connection.\nA trace has\ncome loose.', icon: { texture: 'connection', frame: 'router' } },
  },
  {
    id: 'virus',
    stallAt: 40,
    scene: 'CorruptedBlocks',
    error: { title: 'antivirus.exe', message: 'Virus found in\nthe download!', icon: { texture: 'antivirus', frame: 'virus' } },
  },
  {
    id: 'packet-delivery',
    stallAt: 55,
    scene: 'PacketDelivery',
    error: { title: 'packets.exe', message: 'Packet lost.\nThe cable is\nfull of junk.', icon: { texture: 'packets', frame: 'spam' } },
  },
  {
    id: 'cpu-overheating',
    stallAt: 70,
    scene: 'CpuCooling',
    error: { title: 'cpu.exe', message: 'CPU is\noverheating!\nFan has stopped.', icon: { texture: 'cpu', frame: 'chipHot' } },
  },
  {
    id: 'file-too-large',
    stallAt: 85,
    scene: 'ZipFile',
    error: { title: 'zip.exe', message: 'File too large.\ncat_video.mp4\nwill not fit.', icon: { texture: 'zip', frame: 'folderFull' } },
  },
  { id: 'prevent-the-crash', stallAt: 99, scene: null },
];
