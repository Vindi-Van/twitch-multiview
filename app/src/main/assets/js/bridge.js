// The page's line to the app (MainActivity + PageBridge.kt). Requests go out with Native.postMessage,
// which only this page's origin can use; the app answers by calling native.reply / native.event,
// exposed as mv.native.

export const native = (() => {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const post = (message) => {
    if (globalThis.Native) globalThis.Native.postMessage(JSON.stringify(message));
    else console.warn(`no Native bridge for ${message.method}`);
  };
  return {
    /** A request that gets an answer: resolves to { status, body }. */
    call(method, ...args) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        post({ id, method, args });
      });
    },
    /** A request with no answer. */
    send(method, ...args) {
      post({ id: 0, method, args });
    },
    reply(id, status, body) {
      const resolve = pending.get(id);
      pending.delete(id);
      if (resolve) resolve({ status, body });
    },
    event(name, data) {
      (listeners.get(name) || []).forEach((listener) => listener(data));
    },
    on(name, listener) {
      listeners.set(name, [...(listeners.get(name) || []), listener]);
    },
  };
})();

/** A Helix GET (the app adds the account's token); resolves to the response's `data` array. */
export async function api(path) {
  const { status, body } = await native.call('api', path);
  if (status !== 200) throw new Error(status === 0 ? "can't reach Twitch" : `Twitch answered ${status}`);
  return JSON.parse(body).data;
}
