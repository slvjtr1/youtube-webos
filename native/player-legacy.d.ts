/** Public C exports shared by WebAssembly and the generated compatibility build. */
export interface PlayerCore {
  memory: { readonly buffer: ArrayBuffer };
  option_count(): number;
  option_key(index: number): number;
  option_desc(index: number): number;
  option_category(index: number): number;
  options_init(): void;
  option_read(index: number): number;
  option_write(index: number, value: boolean): void;
  panel_key(key: number, current: number, count: number, group: number): number;
  key_action(key: number): number;
  playback_events(
    hasId: boolean,
    changed: boolean,
    playing: boolean,
    wasPlaying: boolean
  ): number;
  player_mode(inline: boolean, shorts: boolean): number;
  filter_response(): void;
  capacity(): number;
  add_segment(start: number, end: number, source: number): number;
  finish_index(): void;
  next_segment(now: number): number;
  skip_delay(now: number, start: number, rate: number): number;
  keep_deadline(same: boolean, previous: number, next: number): number;
  can_skip(
    now: number,
    start: number,
    end: number,
    paused: boolean,
    seeking: boolean
  ): number;
  scratch_reserve(bytes: number): number;
  video_hash_prefix(input: number, length: number): number;
  launch_origin(): number;
  partial_offset(target: number): number;
  voice_prefix_length(intent: number): number;
  launch_url(
    kind: number,
    value: number,
    voiceAction: number,
    output: number
  ): number;
  thumbnail_path(
    host: number,
    path: number,
    webp: boolean,
    output: number
  ): number;
}
export default function instantiate(imports: object): PlayerCore;
