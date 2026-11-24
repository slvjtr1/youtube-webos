import {
  CustomEventTarget,
  TypedCustomEvent,
  type EventMapOf
} from '../custom-event-target';
import { getPlayer } from './helpers';
import type { VideoID, YTPlayer } from './yt-api';

import { core } from '../core-runtime';

interface EventMap {
  newVideo: CustomEvent<VideoID>;
  playbackStart: CustomEvent<undefined>;
}

export enum PlayerMode {
  PREVIEW,
  SHORTS,
  NORMAL
}

class PlayerManager
  extends CustomEventTarget<EventMap>
  implements PlayerManager
{
  #player;
  #lastVideoID: VideoID | null = null;
  #wasPlaying = false;

  #handleNewVideo(videoID: VideoID) {
    console.debug('[PlayerManager] new video', videoID);
    this.dispatchEvent(new TypedCustomEvent('newVideo', { detail: videoID }));
  }

  #handlePlayerStateChange = () => {
    const current = this.#player.getPlayerStateObject();
    const currentVideoID = this.currentVideoID;
    const events = core.playback_events(
      !!currentVideoID,
      this.#lastVideoID !== currentVideoID,
      current.isPlaying,
      this.#wasPlaying
    );
    this.#wasPlaying = current.isPlaying;
    if (events & 1 && currentVideoID) {
      this.#lastVideoID = currentVideoID;
      this.#handleNewVideo(currentVideoID);
    }

    if (events & 2) {
      this.dispatchEvent(new TypedCustomEvent('playbackStart'));
    }
  };

  constructor(player: YTPlayer) {
    super();
    this.#player = player;

    player.addEventListener('onStateChange', this.#handlePlayerStateChange);
  }

  get currentVideoID(): VideoID | null {
    return this.#player.getVideoData().video_id || null;
  }

  get playerMode() {
    const inline = this.#player.isInline();
    return core.player_mode(
      inline,
      !inline && this.#player.getVideoStats().el === 'shortspage'
    ) as PlayerMode;
  }

  get player(): YTPlayer {
    return this.#player;
  }
}

let instance: PlayerManager | null = null;

export async function getPlayerManager(): Promise<PlayerManager> {
  if (!instance) {
    const player = await getPlayer();
    instance ??= new PlayerManager(player);
  }

  return instance;
}

export type { PlayerManager };
