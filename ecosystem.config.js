module.exports = {
  apps: [
    {
      name: 'marina-api',
      script: 'dist/src/server.js',
      cwd: '/var/www/Marina-crm',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
