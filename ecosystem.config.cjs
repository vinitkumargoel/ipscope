module.exports = {
  apps: [
    {
      name: 'ipscope',
      script: 'server.js',
      cwd: '/home/vinit/work/ipscope',
      env: {
        HOST: '127.0.0.1',
        PORT: 3920,
        SITE_URL: 'https://ip.vinitk.dev',
        SITE_EMAIL: 'legal@vinitk.dev',
      },
    },
    {
      name: 'ipscope-proxy',
      script: '/usr/bin/socat',
      args: 'TCP-LISTEN:3920,bind=192.168.0.234,reuseaddr,fork TCP:127.0.0.1:3920',
      interpreter: 'none',
    },
  ],
};