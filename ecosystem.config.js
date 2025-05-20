// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "lotto_nextjs",
      script: "/app/node_modules/next/dist/bin/next", // 절대 경로
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 4100,
      },
    },
  ],
};