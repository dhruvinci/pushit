// Loads YouTube's IFrame Player API once per page, however many players ask for it.
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let api: Promise<any> | undefined;

export const loadYouTube = () =>
  (api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  }));

export const PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3, CUED = 5;
