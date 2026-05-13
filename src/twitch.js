const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { postGoLiveEmbed, postStreamSummary, postRedeemEmbed } = require('./discord');

const session = {
  streamStartTime: null,
  peakViewers: 0,
  redeemCounts: {},
};

let appAccessToken = null;

async function getTwitchToken() {
  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  });
  appAccessToken = res.data.access_token;
  console.log('🔑 Twitch token obtained.');
  return appAccessToken;
}

async function fetchStreamInfo() {
  const res = await axios.get('https://api.twitch.tv/helix/streams', {
    params: { user_id: process.env.TWITCH_BROADCASTER_ID },
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${appAccessToken}`,
    },
  });
  return res.data.data[0] || null;
}

async function registerSubscriptions() {
  const callbackUrl = process.env.EVENTSUB_CALLBACK_URL + '/eventsub';
  const secret = process.env.EVENTSUB_SECRET;
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;

  const subscriptions = [
    { type: 'stream.online', version: '1', condition: { broadcaster_user_id: broadcasterId } },
    { type: 'stream.offline', version: '1', condition: { broadcaster_user_id: broadcasterId } },
    {
      type: 'channel.channel_points_custom_reward_redemption.add',
      version: '1',
      condition: { broadcaster_user_id: broadcasterId },
    },
  ];

  for (const sub of subscriptions) {
    try {
      await axios.post(
        'https://api.twitch.tv/helix/eventsub/subscriptions',
        { ...sub, transport: { method: 'webhook', callback: callbackUrl, secret } },
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            Authorization: `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`✅ Subscribed to ${sub.type}`);
    } catch (err) {
      if (err.response?.status === 409) {
        console.log(`ℹ️  Already subscribed to ${sub.type}`);
      } else {
        console.warn(`⚠️  Could not subscribe to ${sub.type}:`, err.response?.data?.message || err.message);
      }
    }
  }
}

function verifySignature(req) {
  const msgId = req.headers['twitch-eventsub-message-id'];
  const timestamp = req.headers['twitch-eventsub-message-timestamp'];
  const signature = req.headers['twitch-eventsub-message-signature'];
  const body = req.rawBody;
  const hmac = 'sha256=' + crypto
    .createHmac('sha256', process.env.EVENTSUB_SECRET)
    .update(msgId + timestamp + body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

async function handleStreamOnline() {
  session.streamStartTime = Date.now();
  session.peakViewers = 0;
  session.redeemCounts = {};
  await new Promise(r => setTimeout(r, 5000));
  const streamInfo = await fetchStreamInfo();
  if (!streamInfo) return;
  const streamUrl = `https://twitch.tv/${process.env.TWITCH_CHANNEL_NAME}`;
  await postGoLiveEmbed({
    title: streamInfo.title,
    game: streamInfo.game_name,
    thumbnailUrl: streamInfo.thumbnail_url,
    streamUrl,
    viewerCount: streamInfo.viewer_count,
  });
  session.peakViewers = streamInfo.viewer_count || 0;
  const viewerPoll = setInterval(async () => {
    try {
      const info = await fetchStreamInfo();
      if (info && info.viewer_count > session.peakViewers) {
        session.peakViewers = info.viewer_count;
      }
    } catch {}
  }, 5 * 60 * 1000);
  session.viewerPoll = viewerPoll;
}

async function handleStreamOffline() {
  if (session.viewerPoll) clearInterval(session.viewerPoll);
  const duration = session.streamStartTime ? Date.now() - session.streamStartTime : 0;
  const topRedeems = Object.entries(session.redeemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count]) => ({ title, count }));
  await postStreamSummary({ duration, topRedeems, peakViewers: session.peakViewers });
  session.streamStartTime = null;
}

async function handleRedeem(event) {
  const { user_name, reward, user_input } = event;
  const rewardTitle = reward.title;
  session.redeemCounts[rewardTitle] = (session.redeemCounts[rewardTitle] || 0) + 1;
  await postRedeemEmbed({
    userName: user_name,
    rewardTitle,
    userInput: user_input || null,
  });
}

async function startTwitchListener(discordClient) {
  await getTwitchToken();
  const app = express();
  app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf.toString(); }
  }));

  app.post('/eventsub', async (req, res) => {
    try {
      if (!verifySignature(req)) {
        console.warn('⚠️  Invalid signature from Twitch');
        return res.status(403).send('Forbidden');
      }
    } catch {
      return res.status(403).send('Forbidden');
    }

    const messageType = req.headers['twitch-eventsub-message-type'];

    if (messageType === 'webhook_callback_verification') {
      console.log('🤝 Twitch webhook verified!');
      return res.status(200).send(req.body.challenge);
    }
    if (messageType === 'revocation') {
      console.warn('⚠️  Subscription revoked:', req.body.subscription.type);
      return res.sendStatus(204);
    }
    if (messageType === 'notification') {
      const { type } = req.body.subscription;
      const event = req.body.event;
      console.log(`📨 Event received: ${type}`);
      if (type === 'stream.online') await handleStreamOnline();
      else if (type === 'stream.offline') await handleStreamOffline();
      else if (type === 'channel.channel_points_custom_reward_redemption.add') await handleRedeem(event);
    }
    res.sendStatus(204);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🌐 EventSub webhook listening on port ${port}`);
  });

  await registerSubscriptions();
}

module.exports = { startTwitchListener };
