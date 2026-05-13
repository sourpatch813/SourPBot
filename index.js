require('dotenv').config();
const { startDiscordBot } = require('./src/discord');
const { startTwitchListener } = require('./src/twitch');

console.log('🤖 Starting Twitch → Discord bot...');

(async () => {
  try {
    const discordClient = await startDiscordBot();
    await startTwitchListener(discordClient);
    console.log('✅ Bot is running!');
  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  }
})();
