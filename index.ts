import { EventEmitter } from 'events';
import * as Request from 'request';
import { TwitchRequestEvents } from './util/constants';

class Client extends EventEmitter {
    private channels: TwitchChannel[];
    private clientid: string;
    private clientsecret: string;
    private interval: number;
    public manager: TwitchChannelManager;
    private cache_follow: boolean;
    constructor(options: TwitchRequestOptions) {
        super();
        const promise = new Promise((resolve,reject) => {
            this.interval = options.interval*1000 || 30000;
            this.channels = [];
            this.clientid = options.client_id || null;
            this.clientsecret = options.client_secret || null;
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
        const token = await this.getToken();
        this.channels.forEach(async (ch) => {
            try {
                const response = await this.getData(`https://api.twitch.tv/helix/search/channels?query=${ch.name}`, token);
                if (response && response.data && response.data.length) {
                    const e = response.data.find((d) => d.display_name.toLowerCase() === ch.name.toLowerCase());
                    if (e) {
                        const res = await this.getData(`https://api.twitch.tv/helix/games?id=${e.game_id}`, token);
                        if (res && res.data && res.data.length) {
                            const userData = await this.getUser(ch.name.toLowerCase());
                            this.emit(TwitchRequestEvents.DEBUG, new StreamData(e, e.display_name, e.title, res.data[0].name, e.thumbnail_url, null, 0, userData));
                            if (e && e.is_live && !ch.isLive()) {
                                const r = await this.getData(`https://api.twitch.tv/helix/streams?user_login=${ch.name}`, token);
                                if (r && r.data) {
                                    const ee = r.data.find((d) => d.user_name.toLowerCase() === ch.name.toLowerCase());
                                    if (r.data.length) {
                                        if (ee) {
                                            const userData = await this.getUser(ch.name.toLowerCase());
                                            if (new Date(e.started_at).getTime() > Date.now()-1000*60*15) {
                                                this.emit(TwitchRequestEvents.LIVE, 
                                                    new StreamData(e, 
                                                        e.display_name, 
                                                        e.title, res.data[0].name, 
                                                        e.thumbnail_url, 
                                                        `${ee.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}?r=${Math.floor(Math.random() * 999999)}`, 
                                                        ee.viewer_count,
                                                        userData));
                                            }
                                            ch._setLive();
                                            ch.liveSince = new Date();
                                        }
                                    }
                                }
                            } else if (!e.is_live && ch.isLive() && ((new Date()).getTime()-60000) > ch.liveSince.getTime()) {
                                const userData = await this.getUser(ch.name.toLowerCase());
                                this.emit(TwitchRequestEvents.UNLIVE, 
                                    new StreamData(e, 
                                        e.display_name, 
                                        e.title, 
                                        res.data[0].name, 
                                        e.thumbnail_url, 
                                        null, 
                                        0,
                                        userData));
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

    followListener = async () => {
        const token = await this.getToken();
        this.channels.forEach(async (ch) => {
            try {
                const userData = await this.getUser(ch.name);
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
                                const streamData = await this.getStream(ch.name);
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
     * @returns {Promise<UserData>} s
     */
    getUser = async (username: string) => {
        return new Promise<UserData>(async (resolve, reject) => {
            const token = await this.getToken();
            try {
                const response = await this.getData(`https://api.twitch.tv/helix/users?login=${username.toLowerCase()}`, token);
                if (!response || !response.data) {
                    resolve(undefined);
                } else {
                    const e = response.data.find((d) => d.display_name.toLowerCase() === username.toLowerCase());
                    const user = new UserData(e, e.display_name.toLowerCase(), e.description, e.id, e.profile_image_url, e.view_count, e.broadcaster_type);
                    resolve(user);
                }
            } catch (err) {
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
                if (response && response.data) {
                    for (const data of response.data) {
                        token = await this.getToken();
                        const res = await this.getData(`https://api.twitch.tv/helix/users?login=${data.from_login}`, token);
                        if (res) {
                            const raw = res.data.find((d) => d.display_name.toLowerCase() === username.toLowerCase());
                            if (raw) {
                                const followerUserData = new UserData(raw, raw.display_name.toLowerCase(), raw.description, raw.id, raw.profile_image_url, raw.view_count, raw.broadcaster_type);
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
     * 
     * @param {string} username The username of the channel
     * @returns {Promise<StreamData>} 
     */
    getStream = async (username: string) => {
        return new Promise<StreamData>(async (resolve, reject) => {
            const token = await this.getToken();
            try {
                const response = await this.getData(("https://api.twitch.tv/helix/streams?user_login=" + username.toLowerCase()), token);
                if (response.data === undefined) {
                    resolve(undefined);
                } else {
                    if (response.data.length === 0) {
                        resolve(undefined);
                    } else {
                        const e = response.data.find((d: any) => d.user_name.toLowerCase() === username.toLowerCase());
                        if (!e) {
                            resolve(undefined);
                        } else {
                            const res = await this.getData(("https://api.twitch.tv/helix/search/channels?query=" + username.toLowerCase()), token);
                            const ee = res.data.find((d: any) => d.display_name.toLowerCase() === username.toLowerCase());
                            const userData = await this.getUser(username.toLowerCase());
                            const stream = new StreamData(e, e.user_name.toLowerCase(), e.title, e.game_name, ee.thumbnail_url, `${e.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}?r=${Math.floor(Math.random() * 9999999)}`, e.viewer_count, userData);
                            resolve(stream);
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
            thumbnail: this.thumbnail,
            startedAt: this.date,
            user: this.user.toJSON()
        };
    }

    toString() {
        return this.name;
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

const isEmpty = (str: string) => {
    return (str == "" || str == null || str == undefined || str.length == 0 || str.trim().length == 0 || str.trim() == "");
}

interface TwitchRequestOptions {
    interval: number,
    channels: string[],
    client_id: string,
    client_secret: string,
    timeout?: number,
    cache?: boolean,
    callback?: URL,
}

type URL = string;

module.exports = {
    Client,
    StreamData,
    UserData,
    TwitchChannelManager,
    FollowManager,
    TwitchChannel
};