// Marine OS service worker: makes the app installable. Pages always come from the network
// (the data must be live); if the connection is down, a short offline message is shown.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Marine OS · offline</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;font:15px system-ui,sans-serif;background:#f6f7f9;color:#0b1f3a">
<div style="text-align:center;padding:24px"><img src="/icons/icon-192.png" width="72" height="72" alt="" style="border-radius:16px">
<h1 style="font-size:20px;margin:16px 0 6px">You're offline</h1><p style="margin:0 0 16px;color:#5b6676">Marine OS needs the internet. Check the connection and try again.</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 18px;border:0;border-radius:10px;background:#0b1f3a;color:#fff">Try again</button></div>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
