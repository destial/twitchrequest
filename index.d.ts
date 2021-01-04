declare module 'twitchrequest' {
    import { EventEmitter } from 'events';

    export interface TwitchRequestOptions {
        interval: number,
        channels: string[],
        client_id: string,
        client_secret: string,
    }

    export class TwitchRequest extends EventEmitter {
        private channel: TwitchChannel[];
        private clientid: string;
        private clientsecret: string;
        private interval: number;
        private timeout: number;
        constructor(options: TwitchRequestOptions);
        
        public once<K extends keyof TwitchRequestEvents>(event: K, listener: (...args: TwitchRequestEvents[K]) => void): this;
        public on<K extends keyof TwitchRequestEvents>(event: K, listener: (...args: TwitchRequestEvents[K]) => void): this;

        public getUser(username: string): Promise<UserData>;
        public getStream(username: string): Promise<StreamData>;
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
    }

    export class UserData {
        public raw: any;
        public name: string;
        public description: string;
        public id: string;
        public profile: URL;
        public created: Date;
        public views: number;
    }

    export interface TwitchRequestEvents {
        live: [StreamData];
        unlive: [StreamData];
        debug: [StreamData];
    }

    export class TwitchChannel {
        name: string;
        private live: boolean;
    }
    
    export type URL = string;
    
}