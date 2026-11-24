import { createTimeline } from './native-player';
import sha256 from 'tiny-sha256';
import { configRead } from './config';
import { showNotification } from './ui';

// Copied from https://github.com/ajayyy/SponsorBlock/blob/9392d16617d2d48abb6125c00e2ff6042cb7bebe/src/config.ts#L179-L233
const barTypes = {
  sponsor: {
    color: '#00d400',
    opacity: '0.7',
    name: 'sponsored segment'
  },
  intro: {
    color: '#00ffff',
    opacity: '0.7',
    name: 'intro'
  },
  outro: {
    color: '#0202ed',
    opacity: '0.7',
    name: 'outro'
  },
  interaction: {
    color: '#cc00ff',
    opacity: '0.7',
    name: 'interaction reminder'
  },
  selfpromo: {
    color: '#ffff00',
    opacity: '0.7',
    name: 'self-promotion'
  },
  music_offtopic: {
    color: '#ff9900',
    opacity: '0.7',
    name: 'non-music part'
  },
  preview: {
    color: '#008fd6',
    opacity: '0.7',
    name: 'recap or preview'
  }
};

const sponsorblockAPI = 'https://sponsorblock.inf.re/api';

class SponsorBlockHandler {
  video = null;
  active = true;

  attachVideoTimeout = null;
  nextSkipTimeout = null;
  scheduledSegment = null;
  scheduledAt = 0;

  slider = null;
  sliderInterval = null;
  sliderObserver = null;
  sliderSegmentsOverlay = null;

  scheduleSkipHandler = null;
  durationChangeHandler = null;
  segments = null;
  nextSegment = null;

  constructor(videoID) {
    this.videoID = videoID;
  }

  async init() {
    const videoHash = sha256(this.videoID).substring(0, 4);
    const categories = [
      'sponsor',
      'intro',
      'outro',
      'interaction',
      'selfpromo',
      'music_offtopic',
      'preview'
    ];
    const resp = await fetch(
      `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
        JSON.stringify(categories)
      )}`
    );
    if (resp.status === 404 || !this.active) return;
    if (!resp.ok) throw new Error(`SponsorBlock returned HTTP ${resp.status}`);

    const results = await resp.json();
    if (!this.active || !Array.isArray(results)) return;

    const result = results.find((v) => v.videoID === this.videoID);
    console.debug(this.videoID, 'Got it:', result);

    if (!result || !result.segments || !result.segments.length) {
      console.debug(this.videoID, 'No segments found.');
      return;
    }

    this.segments = result.segments.filter(
      (item) =>
        Array.isArray(item?.segment) &&
        Number.isFinite(item.segment[0]) &&
        Number.isFinite(item.segment[1]) &&
        item.segment[1] > item.segment[0]
    );
    this.nextSegment = await createTimeline(
      this.segments,
      this.getSkippableCategories()
    );
    if (!this.active) return;

    this.scheduleSkipHandler = () => this.scheduleSkip();
    this.durationChangeHandler = () => this.buildOverlay();

    this.attachVideo();
    this.buildOverlay();
  }

  getSkippableCategories() {
    const skippableCategories = [];
    if (configRead('enableSponsorBlockSponsor')) {
      skippableCategories.push('sponsor');
    }
    if (configRead('enableSponsorBlockIntro')) {
      skippableCategories.push('intro');
    }
    if (configRead('enableSponsorBlockOutro')) {
      skippableCategories.push('outro');
    }
    if (configRead('enableSponsorBlockInteraction')) {
      skippableCategories.push('interaction');
    }
    if (configRead('enableSponsorBlockSelfPromo')) {
      skippableCategories.push('selfpromo');
    }
    if (configRead('enableSponsorBlockMusicOfftopic')) {
      skippableCategories.push('music_offtopic');
    }
    if (configRead('enableSponsorBlockPreview')) {
      skippableCategories.push('preview');
    }
    return skippableCategories;
  }

  attachVideo() {
    clearTimeout(this.attachVideoTimeout);
    this.attachVideoTimeout = null;

    this.video = document.querySelector('video');
    if (!this.video) {
      console.debug(this.videoID, 'No video yet...');
      this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 100);
      return;
    }

    console.debug(this.videoID, 'Video found, binding...');

    this.video.addEventListener('play', this.scheduleSkipHandler);
    this.video.addEventListener('pause', this.scheduleSkipHandler);
    this.video.addEventListener('timeupdate', this.scheduleSkipHandler);
    this.video.addEventListener('ratechange', this.scheduleSkipHandler);
    this.video.addEventListener('seeked', this.scheduleSkipHandler);
    this.video.addEventListener('durationchange', this.durationChangeHandler);
  }

  buildOverlay() {
    if (this.sliderSegmentsOverlay) {
      console.debug('Overlay already built');
      return;
    }

    if (!this.video || !this.video.duration) {
      console.debug('No video duration yet');
      return;
    }

    const videoDuration = this.video.duration;

    this.sliderSegmentsOverlay = document.createElement('div');
    this.sliderSegmentsOverlay.className =
      'ytaf-sponsorblock-segment-container';

    this.segments.forEach((segment) => {
      const [start, end] = segment.segment;
      const barType = barTypes[segment.category] || {
        color: 'blue'
      };
      const elm = document.createElement('div');
      elm.className = 'ytaf-sponsorblock-segment';
      elm.style['background-color'] = barType.color;
      elm.style['left'] = `${(start / videoDuration) * 100.0}%`;
      elm.style['width'] = `${((end - start) / videoDuration) * 100.0}%`;
      this.sliderSegmentsOverlay.appendChild(elm);
    });

    const addSliderObserver = (ele) => {
      this.sliderObserver.observe(ele, {
        childList: true,
        subtree: true
      });
    };

    const addSliderOverlay = () => {
      this.slider.appendChild(this.sliderSegmentsOverlay);
    };

    const watchForSlider = () => {
      if (this.sliderInterval) clearInterval(this.sliderInterval);

      this.sliderInterval = setInterval(() => {
        const nodes = document.querySelectorAll('[idomkey=progress-bar]');
        const last = nodes[nodes.length - 1];
        switch (nodes.length) {
          case 3: {
            // Slider has chapter markers.
            this.slider = last;
            break;
          }
          case 2: {
            // Slider has no markers or auto-markers
            this.slider = last.querySelector('[idomkey=slider]');
            if (!this.slider) return;
            break;
          }
          default: {
            return; // no slider found yet
          }
        }

        console.debug('slider found...', this.slider);
        clearInterval(this.sliderInterval);
        this.sliderInterval = null;
        addSliderObserver(last);
        addSliderOverlay();
      }, 100);
    };

    this.sliderObserver = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.removedNodes) {
          for (const node of m.removedNodes) {
            if (node === this.sliderSegmentsOverlay) {
              console.debug('bringing back segments overlay');
              addSliderOverlay();
            }
            if (node === this.slider) {
              console.debug('slider removed, watching again');
              this.sliderObserver.disconnect();
              watchForSlider();
            }
          }
        }
      });
    });

    watchForSlider();
  }

  scheduleSkip() {
    const video = this.video;
    const playing =
      this.active && !video.paused && !video.seeking && video.playbackRate > 0;
    const segment = playing && this.nextSegment(video.currentTime);
    if (!segment) {
      clearTimeout(this.nextSkipTimeout);
      this.nextSkipTimeout = null;
      return;
    }

    const [start, end] = segment.segment;
    const delay = Math.max(
      0,
      ((start - video.currentTime) * 1000) / video.playbackRate
    );
    const due = Date.now() + delay;
    // Ordinary timeupdate events predict the same deadline. A seek, stall
    // or rate change can move it and must re-arm the timer.
    if (
      this.nextSkipTimeout !== null &&
      this.scheduledSegment === segment &&
      Math.abs(due - this.scheduledAt) < 60
    )
      return;

    clearTimeout(this.nextSkipTimeout);
    this.scheduledSegment = segment;
    this.scheduledAt = due;
    this.nextSkipTimeout = setTimeout(() => {
      this.nextSkipTimeout = null;
      if (this.video.paused) {
        console.debug(this.videoID, 'Currently paused, ignoring...');
        return;
      }
      if (
        this.video.seeking ||
        this.video.currentTime < start - 0.05 ||
        this.video.currentTime >= end
      ) {
        this.scheduleSkip();
        return;
      }

      const skipName = barTypes[segment.category]?.name || segment.category;
      console.debug(this.videoID, 'Skipping', segment);
      showNotification(`Skipping ${skipName}`, 2000, 'indigo');
      this.video.currentTime = end;
      this.scheduleSkip();
    }, delay);
  }

  destroy() {
    console.debug(this.videoID, 'Destroying');

    this.active = false;

    if (this.nextSkipTimeout) {
      clearTimeout(this.nextSkipTimeout);
      this.nextSkipTimeout = null;
    }

    if (this.attachVideoTimeout) {
      clearTimeout(this.attachVideoTimeout);
      this.attachVideoTimeout = null;
    }

    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
      this.sliderInterval = null;
    }

    if (this.sliderObserver) {
      this.sliderObserver.disconnect();
      this.sliderObserver = null;
    }

    if (this.sliderSegmentsOverlay) {
      this.sliderSegmentsOverlay.remove();
      this.sliderSegmentsOverlay = null;
    }

    if (this.video) {
      this.video.removeEventListener('play', this.scheduleSkipHandler);
      this.video.removeEventListener('pause', this.scheduleSkipHandler);
      this.video.removeEventListener('timeupdate', this.scheduleSkipHandler);
      this.video.removeEventListener('ratechange', this.scheduleSkipHandler);
      this.video.removeEventListener('seeked', this.scheduleSkipHandler);
      this.video.removeEventListener(
        'durationchange',
        this.durationChangeHandler
      );
    }
  }
}

// When this global variable was declared using let and two consecutive hashchange
// events were fired (due to bubbling? not sure...) the second call handled below
// would not see the value change from first call, and that would cause multiple
// SponsorBlockHandler initializations... This has been noticed on Chromium 38.
// This either reveals some bug in chromium/webpack/babel scope handling, or
// shows my lack of understanding of javascript. (or both)
window.sponsorblock = null;

function uninitializeSponsorblock() {
  if (!window.sponsorblock) {
    return;
  }
  try {
    window.sponsorblock.destroy();
  } catch (err) {
    console.warn('window.sponsorblock.destroy() failed!', err);
  }
  window.sponsorblock = null;
}

window.addEventListener(
  'hashchange',
  () => {
    const newURL = new URL(location.hash.substring(1), location.href);
    // uninitialize sponsorblock when not on `/watch` path, to prevent
    // it from attaching to playback preview video element loaded on
    // home page
    const videoID = newURL.searchParams.get('v');
    if (newURL.pathname !== '/watch' || !videoID) {
      uninitializeSponsorblock();
      return;
    }

    const needsReload =
      !window.sponsorblock || window.sponsorblock.videoID !== videoID;

    console.debug(
      'hashchange',
      videoID,
      window.sponsorblock,
      window.sponsorblock ? window.sponsorblock.videoID : null,
      needsReload
    );

    if (needsReload) {
      uninitializeSponsorblock();

      if (configRead('enableSponsorBlock')) {
        const handler = new SponsorBlockHandler(videoID);
        window.sponsorblock = handler;
        handler.init().catch((err) => {
          if (window.sponsorblock !== handler) return;
          console.warn('SponsorBlock initialization failed:', err);
          uninitializeSponsorblock();
        });
      } else {
        console.info('SponsorBlock disabled, not loading');
      }
    }
  },
  false
);
