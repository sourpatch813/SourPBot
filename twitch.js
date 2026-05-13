async function postStreamSummary({ duration, topRedeems, peakViewers, chatters = [], lurkers = [], firstTimers = [] }) {
  const channel = await discordClient.channels.fetch(process.env.DISCORD_SUMMARY_CHANNEL_ID);
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

  const chattersText = chatters.length > 0
    ? chatters.join(', ')
    : 'No one chatted this session.';

  const lurkersText = lurkers.length > 0
    ? lurkers.join(', ')
    : 'No lurkers detected.';

  const firstTimersText = firstTimers.length > 0
    ? firstTimers.map(u => `🌟 ${u}`).join('\n')
    : 'No first timers this session.';

  const embed = new EmbedBuilder()
    .setColor(0x1A1A1A)
    .setTitle(`🎬 Stream Wrapped — Thanks for pulling up!`)
    .setDescription('Another one in the books. See you next time! 💚')
    .addFields(
      { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
      { name: '📈 Peak Viewers', value: String(peakViewers ?? '—'), inline: true },
      { name: '🎯 Top Redeems', value: redeemsText },
      { name: `💬 Chatters (${chatters.length})`, value: chattersText.slice(0, 1024) },
      { name: `👀 Lurkers (${lurkers.length})`, value: lurkersText.slice(0, 1024) },
      { name: `🌟 First Timers (${firstTimers.length})`, value: firstTimersText.slice(0, 1024) }
    )
    .setTimestamp()
    .setFooter({ text: 'SOUR\_PATCH\_ • Stream Summary' });

  await channel.send({ embeds: [embed] });
  console.log('📋 Stream summary posted.');
}
