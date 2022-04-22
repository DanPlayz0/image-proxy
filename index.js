const express = require('express');
const config = require('./config.js');

const app = express();
const axios = require('axios');

const redis = new (require('ioredis'))(`redis://${config.redis.host}:${config.redis.port || 6379}`);
const urlRegex = /^https?:\/\/(?:[a-zA-Z0-9_-]+\.)?(?:[a-zA-Z0-9_-]+\.)?[a-zA-Z0-9_-]+\.[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s]*)?$/;

app.get('/b/:url', async (req, res) => {
  if (!req.params.url) return res.statusCode(400).send('No url provided');
  const url = Buffer.from(req.params.url, 'base64').toString();
  if (!urlRegex.test(url)) return res.statusCode(400).send('Invalid URL');

  let redisImage = await redis.get(`${config.redis.prefix}${encodeURIComponent(url)}:IMAGE`),
    redisMeta = await redis.get(`${config.redis.prefix}${encodeURIComponent(url)}:META`);
  if (!redisImage) {
    const image = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.3987.132 Safari/537.36'
      }, responseType: 'arraybuffer'
    });

    redisImage = Buffer.from(image.data).toString('base64');
    redisMeta = {
      content_type: image.headers['content-type'],
      expires: new Date(Date.now() + 60 * 60 * 6 * 1000).toUTCString()
    };
    redis.setex(`${config.redis.prefix}${encodeURIComponent(url)}:IMAGE`, 60 * 60 * 6, redisImage);
    redis.setex(`${config.redis.prefix}${encodeURIComponent(url)}:META`, 60 * 60 * 6, JSON.stringify(redisMeta));
  } else redisMeta = JSON.parse(redisMeta);

  res.writeHead(200, {
    'Content-Type': redisMeta.content_type,
    "Expires": redisMeta.expires
  })
  return res.end(Buffer.from(redisImage, 'base64'));
});

app.get('/e/:url', async (req, res) => {
  if (!req.params.url) return res.statusCode(400).send('No url provided');
  const url = decodeURIComponent(req.params.url);
  if (!urlRegex.test(url)) return res.statusCode(400).send('Invalid URL');

  let redisImage = await redis.get(`${config.redis.prefix}${encodeURIComponent(url)}:IMAGE`),
    redisMeta = await redis.get(`${config.redis.prefix}${encodeURIComponent(url)}:META`);
  if (!redisImage) {
    console.log(`Fetching ${url}`);
    const image = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.3987.132 Safari/537.36'
      }, responseType: 'arraybuffer'
    });

    redisImage = Buffer.from(image.data).toString('base64');
    redisMeta = {
      content_type: image.headers['content-type'],
      expires: new Date(Date.now() + 60 * 60 * 6 * 1000).toUTCString()
    };
    redis.setex(`${config.redis.prefix}${encodeURIComponent(url)}:IMAGE`, 60 * 60 * 6, redisImage);
    redis.setex(`${config.redis.prefix}${encodeURIComponent(url)}:META`, 60 * 60 * 6, JSON.stringify(redisMeta));
  } else redisMeta = JSON.parse(redisMeta);

  res.writeHead(200, {
    'Content-Type': redisMeta.content_type,
    "Expires": redisMeta.expires
  })
  return res.end(Buffer.from(redisImage, 'base64'));
})

app.listen(config.port, () => console.log(`Listening on port ${config.port}`));