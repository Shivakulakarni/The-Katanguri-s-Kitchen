// Self-unregistering service worker for the Admin panel to clean up any legacy registrations
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  self.registration.unregister().then(() => {
    console.log('Admin Service Worker unregistered successfully.');
  });
});
