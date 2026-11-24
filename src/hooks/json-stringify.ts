const originalStringify = JSON.stringify;

type FunctionReplacer = (this: any, key: string, value: any) => any;
type WhitelistReplacer = (string | number)[] | null;
type PlaybackRequest = {
  playbackContext?: {
    contentPlaybackContext?: Record<string, unknown>;
  };
};

function stringify(
  value: unknown,
  replacer?: FunctionReplacer | WhitelistReplacer,
  space?: string | number
): string {
  const request = value as PlaybackRequest | null | undefined;
  const playbackContext = request?.playbackContext;
  const content = playbackContext?.contentPlaybackContext;

  if (content && typeof content === 'object' && !Array.isArray(content)) {
    // Copy only the branch we change, which YouTube may have frozen.
    value = {
      ...request,
      playbackContext: {
        ...playbackContext,
        contentPlaybackContext: { ...content, isInlinePlaybackNoAd: true }
      }
    };
    console.info('[JSON.stringify] Set isInlinePlaybackNoAd');
  }

  return originalStringify(value, replacer as any, space);
}

JSON.stringify = stringify;
