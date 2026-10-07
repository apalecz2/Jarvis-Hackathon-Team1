const { env } = require('./env');
const { createApp } = require('./app');

createApp().listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
