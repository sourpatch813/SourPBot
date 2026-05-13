const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

let discordClient = null;

async function startDiscordBot() {
  discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });

  discordClient.once('ready', () => {
    console.log(`✅ Discord ready as ${discordClient.user.tag}`);
  });

  await discordClient.login(process.env.DISCORD_BOT_TOKEN);
  return discordClient;
}

// ─── GO LIVE EMBED ────────────────────────────────────────
async function postGoLiveEmbed({ title, game, thumbnailUrl, streamUrl, viewerCount }) {
  const channel = await discordClient.channels.fetch(process.env.DISCORD_LIVE_CHANNEL_ID);
  if (!channel) return;

  const pingRole = process.env.DISCORD_PING_ROLE_ID;
  const pingText = pingRole ? `<@&${pingRole}> ` : '';

  const embed = new EmbedBuilder()
    .setColor(0x9146FF) // Twitch purple
    .setTitle(`🟣 ${process.env.TWITCH_CHANNEL_NAME} is LIVE`)
    .setURL(streamUrl)
    .setDescription(`**${title}**`)
    .addFields(
      { name: '🎮 Game', value: game || 'Unknown', inline: true },
      { name: '👁️ Viewers', value: String(viewerCount ?? 0), inline: true }
    )
    .setImage(thumbnailUrl ? thumbnailUrl.replace('{width}', '1280').replace('{height}', '720') : null)
    .setTimestamp()
    .setFooter({ text: 'Twitch • Go watch live!' });

  await channel.send({ content: `${pingText}🔴 Stream is live!`, embeds: [embed] });
  console.log('📢 Go-live embed posted.');
}

// ─── STREAM ENDED / SUMMARY EMBED ────────────────────────
async function postStreamSummary({ duration, topRedeems, peakViewers }) {
  const channel = await discordClient.channels.fetch(process.env.DISCORD_LIVE_CHANNEL_ID);
  if (!channel) return;

  const formatDuration = (ms) => {
    const totalMinutes = Math.floor(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const redeemsText = topRedeems && topRedeems.length > 0
    ? topRedeems.map(r => `• **${r.title}** — ${r.count}x`).join('\n')
    : 'No redeems this session.';

  const embed = new EmbedBuilder()
    .setColor(0x444444)
    .setTitle(`⬛ Stream Over — Thanks for watching!`)
    .addFields(
      { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
      { name: '📈 Peak Viewers', value: String(peakViewers ?? '—'), inline: true },
      { name: '🎯 Top Channel Point Redeems', value: redeemsText }
    )
    .setTimestamp()
    .setFooter({ text: 'See you next time!' });

  await channel.send({ embeds: [embed] });
  console.log('📋 Stream summary posted.');
}

// ─── CHANNEL POINTS REDEEM EMBED ─────────────────────────
async function postRedeemEmbed({ userName, rewardTitle, userInput }) {
  const channel = await discordClient.channels.fetch(process.env.DISCORD_REDEEMS_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xF0A000)
    .setTitle('🎯 Channel Points Redeemed')
    .addFields(
      { name: '👤 User', value: userName, inline: true },
      { name: '🏆 Reward', value: rewardTitle, inline: true }
    )
    .setTimestamp();

  if (userInput) {
    embed.addFields({ name: '💬 Message', value: userInput });
  }

  await channel.send({ embeds: [embed] });
}

module.exports = { startDiscordBot, postGoLiveEmbed, postStreamSummary, postRedeemEmbed };
