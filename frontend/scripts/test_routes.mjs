const routes = [
  '/',
  '/dashboard',
  '/projects',
  '/projects/new',
  '/projects/proj-vikasa-core',
  '/tasks',
  '/tasks/new',
  '/tasks/task-user-auth',
  '/executions',
  '/executions/run-b8f3e21a',
  '/executions/run-b8f3e21a/replay',
  '/verification',
  '/verification/run-b8f3e21a',
  '/verification/run-b8f3e21a/claim-vs-reality',
  '/verification/run-auth-failed/failure',
  '/security',
  '/reports',
  '/reports/run-b8f3e21a',
  '/model',
  '/settings'
];

async function checkRoutes() {
  let failed = 0;
  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`, { method: 'HEAD', redirect: 'follow' });
      console.log(`[${res.status}] ${route}`);
      if (res.status >= 400) failed++;
    } catch (e) {
      console.error(`[ERR] ${route}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\nRoute check complete. ${routes.length - failed}/${routes.length} succeeded.`);
  if (failed > 0) process.exit(1);
}

checkRoutes();
