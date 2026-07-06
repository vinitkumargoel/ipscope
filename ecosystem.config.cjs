module.exports = {
  apps: [{
    name: 'ipscope',
    script: 'server.js',
    cwd: '/home/vinit/work/ipscope',
    env: {
      PORT: 3920,
      SITE_URL: 'https://ip.vinitk.dev',
      SITE_EMAIL: 'legal@vinitk.dev',
    },
  }],
};