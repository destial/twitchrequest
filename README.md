# What is Twitch Requests?
Twitch Requests is basically an advanced EventEmitter which adds a 'live' listener and 'unlive' listener. It can be used to detect if a streamer has gone live

# Installation

`npm install twitchrequest`

```
const { TwitchRequests } = require('twitchrequests');

const options = {
    // The channels you are listening to (all in lowercase)
    channels: ["destiall"],

    // Your client ID
    client_id: "your client id",

    // Your client secret
    client_secret: "your client secret",

    // The interval it will check (in seconds)
    interval: 15,

    // Increase this time if your internet connection is slower (if not set, defaults to 3 seconds)
    timeout: 7
};
const client = new TwitchRequests(options);

client.on('live', (data) => {
    console.log(`${data.name} is now live! Streaming ${data.title} on ${data.game}! Started at ${data.date}`);
});
```

# Events

This event is called when a channel included in the options goes live.
```
client.on('live', (streamData) => {
    // Do stuff
});
```

This event is called when a channel included in the options stops streaming.
```
client.on('unlive', (streamData) => {
    // Do stuff
});
```

This event is called every interval set in the options.
```
client.on('debug', (streamData) => {
    // Do stuff
});
```

# Types

```
// Example StreamData
StreamData {
  raw: {
    broadcaster_language: 'en',
    display_name: 'destiall',
    game_id: '509658',
    id: '142326619',
    is_live: true,
    tag_ids: [ '6ea6bca4-4712-4ab9-a906-e3336a9d8039' ],
    thumbnail_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/d555c2b8-fe43-4863-9e6f-78f5052eef41-profile_image-300x300.png',
    title: 'coding stream',
    started_at: '2020-12-22T08:29:53Z'
  },
  name: 'destiall',
  title: 'coding stream',
  game: 'Just Chatting',
  thumbnail: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_destiall-320x180.jpg',
  profile: 'https://static-cdn.jtvnw.net/jtv_user_pictures/d555c2b8-fe43-4863-9e6f-78f5052eef41-profile_image-300x300.png',
  date: 2020-12-22T08:29:53.000Z,
  viewers: 1
}
```
