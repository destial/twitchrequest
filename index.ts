import { EventEmitter } from 'events';
import * as Request from 'request';
import { TwitchRequestEvents } from './util/constants';

class Client extends EventEmitter {
    private channel: TwitchChannel[];
    private clientid: string;
    private clientsecret: string;
    private interval: number;
    constructor(options: TwitchRequestOptions) {
        super();
        this.interval = options.interval*1000 || 30000;
        this.channel = [];
        options.channels.forEach((ch) => {
            const twitchChannel = new TwitchChannel(ch.toLowerCase());
            this.channel.push(twitchChannel);
        });
        this.clientid = options.client_id || null;
        this.clientsecret = options.client_secret || null;

        this.emit(TwitchRequestEvents.READY);

        this.liveListener();
        this.followListener();
        setInterval(this.liveListener, this.interval);
        setInterval(this.followListener, this.interval);
    }
    /**
     * @private
     */
    liveListener = async () => {
        const token = await this.getToken();
        this.channel.forEach(async (ch) => {
            try {
                const response = await this.getData(`https://api.twitch.tv/helix/search/channels?query=${ch.name}`, token);
                if (response && response.data && response.data.length) {
                    const e = response.data.find((d) => d.display_name === ch.name);
                    const res = await this.getData(`https://api.twitch.tv/helix/games?id=${e.game_id}`, token);
                    if (res && res.data && res.data.length) {
                        this.emit(TwitchRequestEvents.DEBUG, new StreamData(e, e.display_name, e.title, res.data[0].name, e.thumbnail_url, null, 0));
                        if (e && e.is_live && !ch.isLive()) {
                            const r = await this.getData(`https://api.twitch.tv/helix/streams?user_login=${ch.name}`, token);
                            if (r && r.data) {
                                const ee = r.data.find((d) => d.user_name.toLowerCase() === ch.name);
                                if (r.data.length) {
                                    if (ee) {
                                        this.emit(TwitchRequestEvents.LIVE, 
                                            new StreamData(e, 
                                                e.display_name, 
                                                e.title, res.data[0].name, 
                                                e.thumbnail_url, 
                                                `${ee.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}?r=${Math.floor(Math.random() * 999999)}`, 
                                                ee.viewer_count));
                                        ch._setLive();
                                        ch.liveSince = new Date();
                                    }
                                }
                            }
                        } else if (!e.is_live && ch.isLive() && ((new Date()).getTime()-60000) > ch.liveSince.getTime()) {
                            this.emit(TwitchRequestEvents.UNLIVE, 
                                new StreamData(e, 
                                    e.display_name, 
                                    e.title, 
                                    res.data[0].name, 
                                    e.thumbnail_url, 
                                    null, 
                                    0));
                            ch._notLive();
                            ch.liveSince = undefined;
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
        this.channel.forEach(async (ch) => {
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
    addChannel = (channel: string) => {
        if (this.channel.find(tch => tch.name === channel.toLowerCase())) return;
        const twitchChannel = new TwitchChannel(channel.toLowerCase());
        this.channel.push(twitchChannel);
    }

    /**
     * Gets all the subscribed channels
     * @returns {TwitchChannel[]}
     */
    allChannels = () => {
        return this.channel;
    }

    /**
     * Removes a channel from the client to listen to
     * @param channel A Twitch channel name
     */
    removeChannel = (channel: string) => {
        if (!(this.channel.find(tch => tch.name === channel.toLowerCase()))) return;
        const twitchChannel = this.channel.find(tch => tch.name === channel.toLowerCase());
        const index = this.channel.indexOf(twitchChannel);
        if (index !== -1) {
            this.channel.splice(index, 1);
        }
    }

    /**
     * Check if a channel is included in the client's lists
     * @param channel A Twitch channel name
     */
    includesChannel = (channel: string) => {
        return (this.channel.find(tch => tch.name === channel.toLowerCase()) ? true : false)
    }

    /**
     * 
     * @param {string} username The username of the channel
     * @returns {Promise<UserData>} s
     */
    getUser = async (username: string) => {
        const promise = new Promise<UserData>(async (resolve, reject) => {
            const token = await this.getToken();
            try {
                var user: UserData;
                const response = await this.getData(`https://api.twitch.tv/helix/users?login=${username.toLowerCase()}`, token);
                if (!response || !response.data) {
                    console.log(`[TwitchRequest] Error while fetching user data! (User=${username.toLowerCase()})`);
                    resolve(undefined);
                } else {
                    const e = response.data.find((d) => d.display_name.toLowerCase() === username.toLowerCase());
                    user = new UserData(e, e.display_name.toLowerCase(), e.description, e.id, e.profile_image_url, e.view_count, e.broadcaster_type);
                    resolve(user);
                }
            } catch (err) {
                console.log(err);
            }
        });
        return promise;
    }

    /**
     * Get the total number of follows of a user
     * @param username The username of the channel
     */
    getFollows = async (username: string) => {
        const promise = new Promise<number>(async (resolve, reject) => {
            const token = await this.getToken();
            const userData = await this.getUser(username.toLowerCase());
                if (userData) {
                    const response = await this.getData(`https://api.twitch.tv/helix/users/follows?to_id=${userData.id}`, token);
                    resolve(response.total);
                } else {
                    console.log(`[TwitchRequest] Error while fetching user follows! (User=${username.toLowerCase()})`);
                    resolve(undefined);
                }
        });
        return promise;
    }

    /**
     * 
     * @param {string} username The username of the channel
     * @returns {Promise<StreamData>} 
     */
    getStream = async (username: string) => {
        const promise = new Promise<StreamData>(async (resolve, reject) => {
            const token = await this.getToken();
            var user: StreamData;
            try {
                const response = await this.getData(("https://api.twitch.tv/helix/streams?user_login=" + username.toLowerCase()), token);
                if (response.data === undefined) {
                    console.log(`[TwitchRequest] Error while fetching stream data! (Channel=${username.toLowerCase()})`);
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
                            user = new StreamData(e, e.user_name.toLowerCase(), e.title, e.game_name, ee.thumbnail_url, `${e.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}?r=${Math.floor(Math.random() * 9999999)}`, e.viewer_count);
                            resolve(user);
                        }
                    }
                }
            } catch (err) {
                console.log(err);
            }
        });
        return promise;
    }

    /**
     * @private
     */
    private getToken = async () => {
        const promise = new Promise<string>(async (resolve, reject) => {
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
                    console.log(`[TwitchRequest] Error while fetching OAuth token!`);
                    resolve(undefined);
                } else {
                    resolve(res.body.access_token);
                }
            });
        });
        return promise;
    }

    /**
     * @private
     * @param url URL 
     * @param token Token
     */
    private getData = async (url: URL, token: string) => {
        const promise = new Promise<any>(async (resolve, reject) => {
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
                    console.log(`[TwitchRequest] Error while fetching from Twitch API!`)
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
        return promise;
    };
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
    constructor(r: any, n: string, t: string, g: string, pfp: URL, tb: URL, v: number) {
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
        if (!isEmpty(r.started_at)) {
            this.date = new Date(r.started_at);
        }
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
}

class TwitchChannel {
    name: string;
    private live: boolean;
    follows: number;
    isLoaded: boolean;
    latest: string;
    liveSince: Date;
    constructor(n: string) {
        this.name = n;
        this.live = false;
        this.follows = 0;
        this.isLoaded = false;
        this.latest = undefined;
        this.liveSince = undefined;
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
    timeout?: number
}

type URL = string;

module.exports = {
    Client,
    StreamData,
    UserData,
    TwitchChannel
};