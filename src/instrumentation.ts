export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production' || process.env.DB_PROVIDER !== 'mariadb') return;
  const startedAt = Date.now();
  void import('./lib/metrics-cache')
    .then(({ warmMetrics }) => warmMetrics())
    .then(() => console.info(`Adserver metrics cache warmed in ${Date.now() - startedAt}ms`))
    .catch(error => console.error('Could not prewarm adserver metrics cache:', error));
}
