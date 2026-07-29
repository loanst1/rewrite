// Self-destruct: unregister this service worker and clear all caches.
// v1.0.22: no longer force-navigates clients on activate — that reload could
// loop with the page re-registering the worker. It now clears caches and
// unregisters quietly; the page picks up fresh assets on its next natural load.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  const names = await caches.keys();
  await Promise.all(names.map(n => caches.delete(n)));
  self.registration.unregister();
});
