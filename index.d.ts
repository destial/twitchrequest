declare module 'twitchrequest' {
    import { EventEmitter } from 'events';

    export interface TwitchRequestOptions {
        interval: number,
        channels: string[],
        client_id: string,
        client_secret: string,
        timeout?: number,
        cache?: boolean,
        callback?: URL,
    }

    export class Client extends EventEmitter {
        private channel: TwitchChannel[];
        private clientid: string;
        private clientsecret: string;
        private interval: number;
        private timeout: number;
        constructor(options: TwitchRequestOptions);

        public once<K extends keyof TwitchRequestEvents>(event: K, listener: (...args: TwitchRequestEvents[K]) => void): this;
        public on<K extends keyof TwitchRequestEvents>(event: K, listener: (...args: TwitchRequestEvents[K]) => void): this;

        public getUser(username: string): Promise<UserData>;
        public resolveID(id: string): Promise<UserData>;
        public getStream(username: string): Promise<StreamData>;
        public getFollows(username: string): Promise<number>;
        public addChannel(channel: string): void;
        public removeChannel(channel: string): void;
        public includesChannel(channel: string): boolean;
        public allChannels(): TwitchChannel[];
    }    

    export class StreamData {
        public raw: any;
        public name: string;
        public title: string;
        public game: string;
        public date: Date;
        public profile: URL;
        public thumbnail: URL;
        public viewers: number;
        public toJSON(): Object;
    }

    export class UserData {
        public raw: any;
        public name: string;
        public description: string;
        public id: string;
        public profile: URL;
        public created: Date;
        public views: number;
        public type: string;
        public toJSON(): Object;
    }

    export interface TwitchRequestEvents {
        ready: [void];
        live: [StreamData];
        unlive: [StreamData];
        debug: [StreamData];
        follow: [UserData, StreamData];
    }

    export class TwitchChannel {
        public client: Client;
        public name: string;
        private live: boolean;
        public follows: number;
        public isLoaded: boolean;
        public latest: string;
        public liveSince: Date;
        public user: UserData;
        public followers: FollowManager;
        public toJSON(): Object;
    }

    export class TwitchChannelManager {
        public cache: Map<string, TwitchChannel>;
        public client: Client;
    }
    
    export class FollowManager {
        public cache: Map<string, UserData>;
        public channel: TwitchChannel;
    }
    
    export type URL = string;
}