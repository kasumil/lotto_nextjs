module.exports = {
  apps: [{
    name: 'lotto_nextjs',
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      PORT: 4200
    }
  }]
};