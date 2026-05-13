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

async function postGoLiveEmbed({ title, game, thumbnailUrl, streamUrl, viewerCount }) {
  const channel = await discordClient.channels.fetch(process.env.DISCORD_LIVE_CHANNEL_ID);
  if (!channel) return;

  const pingRole = process.env.DISCORD_PING_ROLE_ID;
  const pingText = pingRole ? `<@&${pingRole}> ` : '';

  const embed = new EmbedBuilder()
    .setColor(0x6BDD00) // Sour_Patch bright green
    .setTitle(`⚡ SOUR\_PATCH\_ IS LIVE — LET'S GET IT! 🔥`)
    .setURL(streamUrl)
    .setDescription(`> 🎮 **${title}**\n> Drop in, lurk, chat — you already know the vibe.`)
    .addFields(
      { name: '🕹️ Game', value: game || 'Unknown', inline: true },
      { name: '👁️ Viewers', value: String(viewerCount ?? 0), inline: true },
      { name: '📺 Watch Now', value: `[Click here to join](${streamUrl})`, inline: true }
    )
    .setImage(thumbnailUrl ? thumbnailUrl.replace('{width}', '1280').replace('{height}', '720') : null)
    .setTimestamp()
    .setFooter({ text: '🟢 Stream just went live • Twitch' });

  await channel.send({
    content: `${pingText}🚨 **SOUR\_PATCH\_ JUST WENT LIVE!** Don't sleep on it 👀`,
    embeds: [embed]
  });
  console.log('📢 Go-live embed posted.');
}

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
    .setColor(0x1A1A1A) // Dark finish
    .setTitle(`🎬 Stream Wrapped — Thanks for pulling up!`)
    .setDescription('Another one in the books. See you next time! 💚')
    .addFields(
      { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
      { name: '📈 Peak Viewers', value: String(peakViewers ?? '—'), inline: true },
      { name: '🎯 Top Redeems', value: redeemsText }
    )
    .setTimestamp()
    .setFooter({ text: 'SOUR\_PATCH\_ • Stream Summary' });

  await channel.send({ embeds: [embed] });
  console.log('📋 Stream summary posted.');
}

async function postRedeemEmbed({ userName, rewardTitle, userInput }) {
  const channel = await discordClient.channels.fetch(process.env.DISCORD_REDEEMS_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xD4A017) // Gold/yellow accent
    .setTitle('🎯 Channel Points Redeemed!')
    .setDescription(`**${userName}** just cashed in their points!`)
    .addFields(
      { name: '🏆 Reward', value: rewardTitle, inline: true },
      { name: '👤 User', value: userName, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'SOUR\_PATCH\_ • Channel Points' });

  if (userInput) {
    embed.addFields({ name: '💬 Message', value: userInput });
  }

  await channel.send({ embeds: [embed] });
}

module.exports = { startDiscordBot, postGoLiveEmbed, postStreamSummary, postRedeemEmbed };
