# What is Twitch Requests?
Twitch Requests is basically an advanced EventEmitter which adds a 'live' listener and 'unlive' listener. It can be used to detect if a streamer has gone live

# Installation

`npm install twitchrequest`

```
const { TwitchRequest } = require('twitchrequest');

const options = {
    // The channels you are listening to (all in lowercase)
    channels: ["destiall"],

    // Your client ID
    client_id: "your client id",

    // Your client secret
    client_secret: "your client secret",

    // The interval it will check (in seconds)
    interval: 15
};
const client = new TwitchRequest(options);

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

# Methods

This method can be used to get a specific StreamData of a channel.
```
const streamData = await client.getStream('username');
// Do stuff
```

This method can be used to get a specific UserData of a channel.
```
const userData = await client.getUser('username');
// Do stuff
```

This method can be used to add a channel to the list of channels to listen to.
```
client.addChannel('username');
```

This method can be used to remove a channel from the list of channels to listen to.
```
client.removeChannel('username');
```

This method can be used check if that channel is already in the list of channels to listen to.
```
client.includesChannel('username');
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

// Example UserData
UserData {
  raw: {
    id: '47454325',
    login: 'dextimo',
    display_name: 'Dextimo',
    type: '',
    broadcaster_type: 'affiliate',
    description: "Hi i'm Dextimo, I love pandas, Formula 1 and  occasionally cod zombies.Btw tomatoes are disgusting :)",
    profile_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/8d9dd056-177f-43f2-966d-5c83d09a0e88-profile_image-300x300.png',
    offline_image_url: '',
    view_count: 977,
    created_at: '2013-08-11T20:17:02.073455Z'
  },
  name: 'dextimo',
  description: "Hi i'm Dextimo, I love pandas, Formula 1 and  occasionally cod zombies.Btw tomatoes are disgusting :)",
  id: '47454325',
  profile: 'https://static-cdn.jtvnw.net/jtv_user_pictures/8d9dd056-177f-43f2-966d-5c83d09a0e88-profile_image-300x300.png',
  views: 977,
  type: 'affiliate',
  created: 2013-08-11T20:17:02.073Z
}
```
