import { launchURL } from './url-adapter';

export function extractLaunchParams() {
  if (!window.launchParams) return {};

  try {
    return JSON.parse(window.launchParams) ?? {};
  } catch (error) {
    console.warn('Ignoring invalid webOS launch parameters:', error);
    return {};
  }
}

export function handleLaunch(params = {}) {
  window.location.href = launchURL(params);
}

/**
 * Wait for a child element to be added for which a predicate is true.
 *
 * When `observeAttributes` is false, the predicate is checked only when a node
 * is first added. If you want the predicate to run every time an attribute is
 * modified, set `observeAttributes` to true.
 * @template {Node} T
 * @param {Element} parent Root of tree to watch
 * @param {(node: Node) => node is T} predicate Function that checks whether its argument is the desired element
 * @param {boolean} observeAttributes Also run predicate on attribute changes
 * @param {AbortSignal=} abortSignal Signal that can be used to stop waiting
 * @return {Promise<T>} Matched element
 */
export async function waitForChildAdd(
  parent,
  predicate,
  observeAttributes,
  abortSignal
) {
  return new Promise((resolve, reject) => {
    const obs = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        switch (mut.type) {
          case 'attributes': {
            if (predicate(mut.target)) {
              obs.disconnect();
              resolve(mut.target);
              return;
            }
            break;
          }
          case 'childList': {
            for (const node of mut.addedNodes) {
              if (predicate(node)) {
                obs.disconnect();
                resolve(node);
                return;
              }
            }
            break;
          }
        }
      }
    });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        obs.disconnect();
        reject(new Error('aborted'));
      });
    }

    obs.observe(parent, {
      subtree: true,
      attributes: observeAttributes,
      childList: true
    });
  });
}
