module.exports = {
  apps: [
    {
      name: 'sree-trust-whatsapp-gateway',
      script: 'server.js',
      cwd: './backend/whatsapp_gateway',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 50,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pm2/whatsapp-error.log',
      out_file: './logs/pm2/whatsapp-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
