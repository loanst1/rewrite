// Self-destruct: unregister this service worker and clear all caches
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  const names = await caches.keys();
  await Promise.all(names.map(n => caches.delete(n)));
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.navigate(c.url));
  self.registration.unregister();
});
