import { EventEmitter } from 'events';
import * as Request from 'request';
import { TwitchRequestEvents } from './util/constants';

const isEmpty = (str: string) => {
    return (str == "" || str == null || str == undefined || str.length == 0 || str.trim().length == 0 || str.trim() == "");
}

const isNotEmpty = (response: any) => {
    return (response && response.data && response.data.length);
}

class Client extends EventEmitter {
    private channels: TwitchChannel[];
    private clientid: string;
    private clientsecret: string;
    private interval: number;
    private repeat: boolean;
    public manager: TwitchChannelManager;
    private cache_follow: boolean;
    constructor(options: TwitchRequestOptions) {
        super();
        const promise = new Promise((resolve,reject) => {
            this.interval = options.interval*1000 || 30000;
            this.channels = [];
            this.clientid = options.client_id || null;
            this.clientsecret = options.client_secret || null;
            this.repeat = options.repeat ? options.repeat : false;
            this.cache_follow = options.cache ? options.cache : false;
            this.manager = new TwitchChannelManager(this);

            const loadChannels = new Promise((res, rej) => {
                if (!options.channels.length) res(undefined);

                options.channels.forEach(async (ch, index) => {
                    const userData = await this.getUser(ch.toLowerCase())
                    const twitchChannel = new TwitchChannel(this, ch.toLowerCase(), userData);
                    this.channels.push(twitchChannel);
                    this.manager.cache.set(userData.id, twitchChannel);
                    if (options.cache) {
                        const followArray = await this.getFollowers(twitchChannel.name.toLowerCase());
                        for (const follower of followArray) {
                            console.log(`${follower}`);
                            twitchChannel.followers.cache.set(follower.id, follower);
                        }
                    }

                    if (index === options.channels.length-1) {
                        res(undefined);
                    }
                });
            });

            loadChannels.then(() => {
                this.liveListener();
                this.followListener();
                setInterval(this.liveListener, this.interval);
                setInterval(this.followListener, this.interval);

                resolve(true);
            });
        });
        promise.then(() => {
            this.emit(TwitchRequestEvents.READY, undefined);
        });

    }
    /**
     * @private
     */
    liveListener = async () => {
        this.channels.forEach(async (ch) => {
            try {
                const streamData = await this.resolveStream(ch.user.id);
                if (streamData) {
                    if (!ch.isLive()) {
                        if (!this.repeat) {
                            if (streamData.date.getTime() > (Date.now() - (1000 * 60 * 15))) {
                                this.emit(TwitchRequestEvents.LIVE, streamData);
                            }
                        } else {
                            this.emit(TwitchRequestEvents.LIVE, streamData);
                        }
                        ch._setLive();
                        ch.liveSince = new Date();
                    }
                } else if (ch.isLive()) {
                    const token = await this.getToken();
                    const response = await this.getData(`https://api.twitch.tv/helix/search/channels?query=${ch.user.name}`, token);
                    if (isNotEmpty(response)) {
                        const data = response.data.find((d: { id: string; }) => d.id === ch.user.id);
                        if (data && !data.is_live) { 
                            if (ch.liveSince && (ch.liveSince.getTime() < (Date.now() - (1000 * 60 * 3)))) {
                                const userData = await this.resolveID(ch.user.id);
                                if (userData) {
                                    const streamData = new StreamData(
                                        data, 
                                        data.display_name, 
                                        data.title, 
                                        data.game, 
                                        data.thumbnail_url, 
                                        userData.profile,
                                        0, userData);
                                    this.emit(TwitchRequestEvents.UNLIVE, streamData);
                                }
                                ch._notLive();
                                ch.liveSince = undefined;
                            }
                        }
                    }
                }
            } catch (err) {
                console.log(err);
            }
        });
    }
    
    /**
     * @private
     */
    followListener = async () => {
        const token = await this.getToken();
        this.channels.forEach(async (ch) => {
            try {
                const userData = await this.resolveID(ch.user.id);
                if (userData) {
                    const response = await this.getData(`https://api.twitch.tv/helix/users/follows?to_id=${userData.id}`, token);
                    if (response && response.data && response.data.length) {
                        const followedName = response.data[0].from_name;
                        if (!ch.isLoaded) {
                            ch.follows = response.total;
                            ch.isLoaded = true;
                            ch.latest = followedName;
                        } else {
                            if (response.total > ch.follows && ch.latest !== followedName) {
                                ch.latest = followedName;
                                ch.follows = response.total;
                                const followedUserData = await this.getUser(followedName.toLowerCase());
                                const streamData = await this.resolveStream(ch.user.id);
                                if (followedUserData && streamData) {
                                    this.emit(TwitchRequestEvents.FOLLOW, followedUserData, streamData);
                                }
                            } else if (response.total < ch.follows) {
                                ch.follows = response.total;
                                ch.latest = followedName;
                            }
                        }
                    }
                }
            } catch (err) {
                console.log(err);
            }
        });
    }

    /**
     * Adds a channel to the client to listen to
     * @param channel A Twitch channel name
     */
    addChannel = async (channel: string) => {
        if (this.channels.find(tch => tch.name === channel.toLowerCase())) return;
        const userData = await this.getUser(channel.toLowerCase());
        const twitchChannel = new TwitchChannel(this, channel.toLowerCase(), userData);
        this.channels.push(twitchChannel);
        this.manager.cache.set(userData.id, twitchChannel);
    }

    /**
     * Gets all the subscribed channels
     * @returns {TwitchChannel[]}
     */
    allChannels = () => {
        return this.channels;
    }

    /**
     * Removes a channel from the client to listen to
     * @param channel A Twitch channel name
     */
    removeChannel = (channel: string) => {
        if (!(this.channels.find(tch => tch.name === channel.toLowerCase()))) return;
        const twitchChannel = this.channels.find(tch => tch.name === channel.toLowerCase());
        const index = this.channels.indexOf(twitchChannel);
        if (index !== -1) {
            this.channels.splice(index, 1);
            this.manager.cache.delete(twitchChannel.user.id);
        }
    }

    /**
     * Check if a channel is included in the client's lists
     * @param channel A Twitch channel name
     */
    includesChannel = (channel: string) => {
        return (this.channels.find(tch => tch.name === channel.toLowerCase()) ? true : false)
    }

    /**
     * 
     * @param {string} username The username of the channel
     * @returns {Promise<UserData>} 
     */
    getUser = async (username: string) => {
        return new Promise<UserData>(async (resolve, reject) => {
            const token = await this.getToken();
            try {
                const response = await this.getData(`https://api.twitch.tv/helix/users?login=${username.toLowerCase()}`, token);
                if (!isNotEmpty(response)) {
                    resolve(undefined);
                } else {
                    const e = response.data.find((d) => d.display_name.toLowerCase() === username.toLowerCase());
                    if (e) {
                        const user = new UserData(e, e.display_name, e.description, e.id, e.profile_image_url, e.view_count, e.broadcaster_type);
                        resolve(user);
                    } else {
                        resolve(undefined);
                    }
                }
            } catch (err) {
                console.log(err);
            }
        });
    }

    /**
     * Resolves a user ID to a user channel
     * @param {string} id The ID of the user 
     */
    resolveID = async (id: string) => {
        return new Promise<UserData>(async (resolve, reject) => {
            const token = await this.getToken();
            try {
                const response = await this.getData(`https://api.twitch.tv/helix/users?id=${id}`, token);
                if (!isNotEmpty(response)) {
                    resolve(undefined);
                } else {
                    const e = response.data[0];
                    if (e) {
                        const user = new UserData(e, e.display_name, e.description, e.id, e.profile_image_url, e.view_count, e.broadcaster_type);
                        resolve(user);
                    } else {
                        resolve(undefined);
                    }
                }
            } catch(err) {
                console.log(err);
            }
        });
    }

    /**
     * Get the total number of follows of a user
     * @param username The username of the channel
     */
    getFollows = async (username: string) => {
        return new Promise<number>(async (resolve, reject) => {
            const token = await this.getToken();
            const userData = await this.getUser(username.toLowerCase());
                if (userData) {
                    const response = await this.getData(`https://api.twitch.tv/helix/users/follows?to_id=${userData.id}`, token);
                    resolve(response.total);
                } else {
                    resolve(undefined);
                }
        });
    }

    /**
     * Gets the array of followers from a channel
     * @param username The username of the channel
     */
    getFollowers = async (username: string) => {
        return new Promise<UserData[]>(async (resolve, reject) => {
            const userData = await this.getUser(username.toLowerCase());
            const followerData = [];
            if (userData) {
                var token = await this.getToken();
                const response = await this.getData(`https://api.twitch.tv/helix/users/follows?to_id=${userData.id}&first=100`, token);
                if (isNotEmpty(response)) {
                    for (const data of response.data) {
                        token = await this.getToken();
                        const res = await this.getData(`https://api.twitch.tv/helix/users?login=${data.from_login}`, token);
                        if (res) {
                            const raw = res.data.find((d) => d.display_name.toLowerCase() === username.toLowerCase());
                            if (raw) {
                                const followerUserData = new UserData(raw, raw.display_name, raw.description, raw.id, raw.profile_image_url, raw.view_count, raw.broadcaster_type);
                                followerData.push(followerUserData);
                            }
                        }
                    }
                    resolve(followerData);
                }
            }
            resolve(followerData);
        });
    }

    /**
     * Resolves a user ID to an active stream
     * @param {string} id 
     * @returns {Promise<StreamData>}
     */
    resolveStream = async (id: string) => {
        return new Promise<StreamData>(async (resolve, reject) => {
            try {
                const token = await this.getToken();
                const response = await this.getData(`https://api.twitch.tv/helix/streams?user_id=${id}`, token);
                if (isNotEmpty(response)) {
                    const e = response.data.find((d: { user_id: string; }) => d.user_id === id);
                    const userData = await this.resolveID(id);
                    if (e && userData) {  
                        const stream = new StreamData(
                            e, 
                            e.user_name, 
                            e.title, 
                            e.game_name, 
                            userData.profile, 
                            `${e.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}?r=${Math.floor(Math.random() * 999999)}`, 
                            e.viewer_count,
                            userData);
                        resolve(stream);
                    } else {
                        resolve(undefined);
                    }
                } else {
                    resolve(undefined);
                }
            } catch(err) {
                console.log(err);
                reject(err);
            }
        });
    }

    /**
     * 
     * @param {string} username The username of the channel
     * @returns {Promise<StreamData>} 
     */
    getStream = async (username: string) => {
        return new Promise<StreamData>(async (resolve, reject) => {
            const token = await this.getToken();
            try {
                const response = await this.getData(`https://api.twitch.tv/helix/streams?user_login=${username}`, token);
                if (!isNotEmpty(response)) {
                    resolve(undefined);
                } else {
                    const e = response.data.find((d: any) => d.user_name.toLowerCase() === username.toLowerCase());
                    if (!e) {
                        resolve(undefined);
                    } else {
                        const res = await this.getData(`https://api.twitch.tv/helix/search/channels?query=${username}`, token);
                        const ee = res.data.find((d: any) => d.display_name.toLowerCase() === username.toLowerCase());
                        const userData = await this.getUser(username.toLowerCase());
                        const stream = new StreamData(e, e.user_name, e.title, e.game_name, ee.thumbnail_url, `${e.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}?r=${Math.floor(Math.random() * 9999999)}`, e.viewer_count, userData);
                        resolve(stream);
                    }
                }
            } catch (err) {
                console.log(err);
            }
        });
    }

    /**
     * @private
     */
    private getToken = async () => {
        return new Promise<string>(async (resolve, reject) => {
            const options = {
                url: "https://id.twitch.tv/oauth2/token",
                json: true,
                body: {
                    client_id: this.clientid,
                    client_secret: this.clientsecret,
                    grant_type: 'client_credentials'
                }
            };
            Request.post(options, (err, res, body) => {
                if (err){
                    resolve(undefined);
                } else {
                    resolve(res.body.access_token);
                }
            });
        });
    }

    /**
     * @private
     * @param url URL 
     * @param token Token
     */
    private getData = async (url: URL, token: string) => {
        return new Promise<any>(async (resolve, reject) => {
            const options = {
                url: url,
                method: 'GET',
                headers: {
                    'client-id': this.clientid,
                    'Authorization': 'Bearer ' + token
                }
            };
            Request.get(options, (err, res, body: string) => {
                if (err) {
                    resolve(undefined);
                } else {
                    if (body.startsWith('{') && body.endsWith('}')) {
                        resolve(JSON.parse(body));
                    } else {
                        resolve(undefined);
                    }
                }
            });
        });
    };

    toJSON = () => {
        return {
            channels: this.channels,
            options: {
                interval: this.interval,
                cache: this.cache_follow,
                client_id: this.clientid,
            },
            manager: this.manager
        };
    }
}

class StreamData {
    raw: any;
    name: string;
    title: string;
    game: string;
    date: Date;
    profile: URL;
    thumbnail: URL;
    viewers: number;
    user: UserData;
    constructor(r: any, n: string, t: string, g: string, pfp: URL, tb: URL, v: number, u: UserData) {
        /**
         * @constant
         */
        this.raw = r;
        this.name = n;
        this.title = t;
        this.game = g;
        this.profile = pfp;
        this.thumbnail = tb;
        this.date = new Date();
        this.viewers = v;
        this.user = u;
        if (!isEmpty(r.started_at)) {
            this.date = new Date(r.started_at);
        }
    }

    toJSON() {
        return {
            name: this.name,
            title: this.title,
            game: this.game,
            profile: this.profile,
            viewers: this.viewers,
            thumbnail: this.thumbnail,
            startedAt: this.date,
            user: this.user.toJSON()
        };
    }

    toString() {
        return this.name;
    }
}

class User {
    client: Client;
    id: string;
    name: string;
    description: string;
    profile: URL;
    created: Date;
    views: number;
    type: string
    constructor(client: Client, id: string) {
        this.client = client;
        this.id = id;
        (async () => {
            const user = await this.client.resolveID(this.id)
            if (user) {
                this.name = user.name;
                this.description = user.description;
                this.profile = user.profile;
                this.created = user.created;
                this.views = user.views;
                this.type = user.type;
            }
            return this;
        })();
    }
    
    init = async () => {
        return (async () => {
            const user = await this.client.resolveID(this.id)
            if (user) {
                this.name = user.name;
                this.description = user.description;
                this.profile = user.profile;
                this.created = user.created;
                this.views = user.views;
                this.type = user.type;
                return this;
            }
        });
    }
}

class Stream {
    client: Client;
    name: string;
    id: string;
    title: string;
    game: string;
    date: Date;
    profile: URL;
    thumbnail: URL;
    viewers: number;
    user: UserData;
    constructor(client: Client, id: string) {
        this.client = client;
        this.id = id;
    }

    init = () => {
        this.client.resolveStream(this.id).then(stream => {
            if (stream) {
                this.name = stream.name;
                this.title = stream.title;
                this.game = stream.game;
                this.profile = stream.profile;
                this.thumbnail = stream.thumbnail;
                this.viewers = stream.viewers;
                this.user = stream.user;
            }
        });
    }
}

class UserData {
    raw: any;
    name: string;
    description: string;
    id: string;
    profile: URL;
    created: Date;
    views: number;
    type: string
    constructor(r: any, n: string, d: string, id: string, pfp: URL, v: number, t: string) {
        this.raw = r;
        this.name = n;
        this.description = d;
        this.id = id;
        this.profile = pfp;
        this.views = v;
        this.type = t;
        if (!isEmpty(r.created_at)) {
            this.created = new Date(r.created_at);
        } else {
            this.created = undefined;
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            views: this.views,
            type: this.type,
            createdAt: this.created,
            profile: this.profile
        };
    }

    toString() {
        return this.name;
    }
}

class TwitchChannelManager {
    public cache: Map<string, TwitchChannel>;
    public client: Client;
    constructor(client: Client) {
        this.client = client;
        this.cache = new Map<string, TwitchChannel>();
    }
}

class FollowManager {
    public cache: Map<string, UserData>;
    public channel: TwitchChannel;
    constructor(channel: TwitchChannel) {
        this.channel = channel;
        this.cache = new Map<string, UserData>();
    }
}

class TwitchChannel {
    client: Client;
    name: string;
    private live: boolean;
    follows: number;
    isLoaded: boolean;
    latest: string;
    liveSince: Date;
    user: UserData;
    followers: FollowManager;
    constructor(client: Client, n: string, uD: UserData) {
        this.client = client;
        this.name = n;
        this.live = false;
        this.follows = 0;
        this.isLoaded = false;
        this.latest = undefined;
        this.liveSince = undefined;
        this.user = uD;
        this.followers = new FollowManager(this);
    }

    toJSON() {
        return {
            name: this.name,
            live: this.live,
            follows: this.follows,
            followers: this.followers,
            liveSince: this.liveSince,
            user: this.user.toJSON()
        };
    }

    toString() {
        return this.name;
    }

    /**
     * **DO NOT USE THIS METHOD OR IT WILL MESS UP THE CLIENT**
     */
    _setLive() {
        this.live = true;
    }

    /**
     * **DO NOT USE THIS METHOD OR IT WILL MESS UP THE CLIENT**
     */
    _notLive() {
        this.live = false;
    }

    /**
     * Check if the channel is live according to the client
     */
    isLive() {
        return this.live;
    }
}

interface TwitchRequestOptions {
    interval: number,
    channels: string[],
    client_id: string,
    client_secret: string,
    timeout?: number,
    cache?: boolean,
    repeat?: boolean,
    callback?: URL,
}

type URL = string;

module.exports = {
    Client,
    StreamData,
    UserData,
    TwitchChannelManager,
    FollowManager,
    TwitchChannel,
    User,
    Stream
};