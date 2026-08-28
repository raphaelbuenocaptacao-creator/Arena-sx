(() => {
  const isSecure = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  if (!('serviceWorker' in navigator) || !isSecure) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('[Arena SX] Service worker não registrado:', error);
    }
  });
})();
