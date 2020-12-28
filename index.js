"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var events_1 = require("events");
var Request = require("request");
var constants_1 = require("./util/constants");
var TwitchRequest = /** @class */ (function (_super) {
    __extends(TwitchRequest, _super);
    function TwitchRequest(options) {
        var _this = _super.call(this) || this;
        /**
         * @type {number}
         */
        _this.interval = options.interval * 1000 || 30000;
        /**
         * @type {TwitchChannel[]}
         */
        _this.channel = [];
        options.channels.forEach(function (ch) {
            var twitchChannel = new TwitchChannel(ch.toLowerCase());
            _this.channel.push(twitchChannel);
        });
        /**
         * @type {string}
         */
        _this.clientid = options.client_id || null;
        /**
         * @type {string}
         */
        _this.clientsecret = options.client_secret || null;
        /**
         * @type {number}
         */
        _this.timeout = options.timeout * 1000 || 5000;
        setInterval(_this.listener, _this.interval, _this);
        return _this;
    }
    /**
     * @private
     * @param {TwitchRequest} main
     */
    TwitchRequest.prototype.listener = function (main) {
        var _this = this;
        var getToken = function (callback) {
            var options = {
                url: "https://id.twitch.tv/oauth2/token",
                json: true,
                body: {
                    client_id: main.clientid,
                    client_secret: main.clientsecret,
                    grant_type: 'client_credentials'
                }
            };
            Request.post(options, function (err, res, body) {
                if (err)
                    return console.log(err);
                callback(res.body.access_token);
            });
        };
        var token = "";
        getToken(function (t) {
            token = t;
            return t;
        });
        var getData = function (url, token, callback) {
            var options = {
                url: url,
                method: 'GET',
                headers: {
                    'client-id': main.clientid,
                    'Authorization': 'Bearer ' + token
                }
            };
            Request.get(options, function (err, res, body) {
                if (err)
                    return console.log(err);
                callback(JSON.parse(body));
            });
        };
        setTimeout(function () {
            main.channel.forEach(function (ch) {
                getData(("https://api.twitch.tv/helix/search/channels?query=" + ch.name), token, function (response) {
                    if (response.data === undefined) {
                        console.log("Error! {channel=" + ch.name + ", clientid=" + main.clientid + ", clientsecret=" + main.clientsecret + ", interval=" + main.interval + ", timeout=" + main.timeout + "}");
                    }
                    else {
                        var e_1 = response.data.find(function (d) { return d.display_name === ch.name; });
                        getData(("https://api.twitch.tv/helix/games?id=" + e_1.game_id), token, function (res) {
                            main.emit(constants_1.TwitchRequestEvents.DEBUG, new StreamData(e_1, e_1.display_name, e_1.title, res.data[0].name, e_1.thumbnail_url, null, 0));
                            if (e_1.is_live && !ch.isLive()) {
                                getData(("https://api.twitch.tv/helix/streams?user_login=" + ch.name), token, function (r) {
                                    if (r.data === undefined) {
                                        console.log("Error! {channel=" + ch.name + ", clientid=" + _this.clientid + ", clientsecret=" + _this.clientsecret + ", interval=" + _this.interval + ", timeout=" + main.timeout + "}");
                                    }
                                    else {
                                        var ee = r.data.find(function (d) { return d.user_name.toLowerCase() === ch.name; });
                                        if (ch.thumbnail !== ee.thumbnail_url) {
                                            main.emit(constants_1.TwitchRequestEvents.LIVE, new StreamData(e_1, e_1.display_name, e_1.title, res.data[0].name, e_1.thumbnail_url, ee.thumbnail_url.replace('{width}', '320').replace('{height}', '180'), ee.viewer_count));
                                            ch.setTB(ee.thumbnail_url);
                                            ch.setLive();
                                        }
                                    }
                                });
                            }
                            else if (!e_1.is_live && ch.isLive()) {
                                main.emit(constants_1.TwitchRequestEvents.UNLIVE, new StreamData(e_1, e_1.display_name, e_1.title, res.data[0].name, e_1.thumbnail_url, null, 0));
                                ch.notLive();
                            }
                        });
                    }
                });
            });
        }, main.timeout);
    };
    /**
     *
     * @param {string} username The username of the channel
     * @returns {UserData}
     */
    TwitchRequest.prototype.getUser = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var getToken, token, getData, cid, cs, int, time, promise;
            var _this = this;
            return __generator(this, function (_a) {
                getToken = function (callback) {
                    var options = {
                        url: "https://id.twitch.tv/oauth2/token",
                        json: true,
                        body: {
                            client_id: _this.clientid,
                            client_secret: _this.clientsecret,
                            grant_type: 'client_credentials'
                        }
                    };
                    Request.post(options, function (err, res, body) {
                        if (err)
                            return console.log(err);
                        callback(res.body.access_token);
                    });
                };
                token = "";
                getToken(function (t) {
                    token = t;
                    return t;
                });
                getData = function (url, token, callback) {
                    var options = {
                        url: url,
                        method: 'GET',
                        headers: {
                            'client-id': _this.clientid,
                            'Authorization': 'Bearer ' + token
                        }
                    };
                    Request.get(options, function (err, res, body) {
                        if (err)
                            return console.log(err);
                        callback(JSON.parse(body));
                    });
                };
                cid = this.clientid;
                cs = this.clientsecret;
                int = this.interval;
                time = this.timeout;
                promise = new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        var user = null;
                        getData(("https://api.twitch.tv/helix/user?login=" + username), token, function (response) {
                            if (response.data === undefined) {
                                console.log("Error! {channel=" + username + ", clientid=" + cid + ", clientsecret=" + cs + ", interval=" + int + ", timeout=" + time + "}");
                                resolve(user);
                            }
                            else {
                                var pfp;
                                getData(("https://api.twitch.tv/helix/search/channels?query=" + username), token, function (res) {
                                    var ee = res.data.find(function (d) { return d.display_name === username; });
                                    pfp = ee.thumbnail_url;
                                });
                                var e = response.data.find(function (d) { return d.display_name.toLowerCase() === username; });
                                user = new UserData(e, e.display_name.toLowerCase(), e.description, e.id, pfp, e.view_count);
                                resolve(user);
                            }
                        });
                    }, time);
                });
                return [2 /*return*/, promise];
            });
        });
    };
    /**
     *
     * @param {string} username The username of the channel
     * @returns {StreamData}
     */
    TwitchRequest.prototype.getStream = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var getToken, token, getData, cid, cs, int, time, promise;
            var _this = this;
            return __generator(this, function (_a) {
                getToken = function (callback) {
                    var options = {
                        url: "https://id.twitch.tv/oauth2/token",
                        json: true,
                        body: {
                            client_id: _this.clientid,
                            client_secret: _this.clientsecret,
                            grant_type: 'client_credentials'
                        }
                    };
                    Request.post(options, function (err, res, body) {
                        if (err)
                            return console.log(err);
                        callback(res.body.access_token);
                    });
                };
                token = "";
                getToken(function (t) {
                    token = t;
                    return t;
                });
                getData = function (url, token, callback) {
                    var options = {
                        url: url,
                        method: 'GET',
                        headers: {
                            'client-id': _this.clientid,
                            'Authorization': 'Bearer ' + token
                        }
                    };
                    Request.get(options, function (err, res, body) {
                        if (err)
                            return console.log(err);
                        callback((JSON.parse(body)));
                    });
                };
                cid = this.clientid;
                cs = this.clientsecret;
                int = this.interval;
                time = this.timeout;
                promise = new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        /**
                         * @type {StreamData}
                         */
                        var user = null;
                        getData(("https://api.twitch.tv/helix/streams?user_login=" + username.toLowerCase()), token, function (response) {
                            if (response.data === undefined) {
                                console.log("Error! {channel=" + username + ", clientid=" + cid + ", clientsecret=" + cs + ", interval=" + int + ". timeout=" + time + "}");
                                resolve(user);
                            }
                            else {
                                console.log(response.data);
                                var pfp = "";
                                getData(("https://api.twitch.tv/helix/search/channels?query=" + username), token, function (res) {
                                    var ee = res.data.find(function (d) { return d.display_name === username; });
                                    pfp = ee.thumbnail_url;
                                });
                                var e = response.data.find(function (d) { return d.user_name.toLowerCase() === username; });
                                user = new StreamData(e, e.user_name.toLowerCase(), e.title, e.game_name, pfp, e.thumbnail_url.replace('{width}', '320').replace('{height}', '180'), e.viewer_count);
                                resolve(user);
                            }
                        });
                    }, time);
                });
                return [2 /*return*/, promise];
            });
        });
    };
    return TwitchRequest;
}(events_1.EventEmitter));
var StreamData = /** @class */ (function () {
    function StreamData(r, n, t, g, pfp, tb, v) {
        /**
         * @type {any} Raw Data
         */
        this.raw = r;
        /**
         * @type {string} The channel name
         */
        this.name = n;
        /**
         * @type {string} The stream title
         */
        this.title = t;
        /**
         * @type {string} The currently playing game
         */
        this.game = g;
        /**
         * @type {URL} The channel's profile picture
         */
        this.profile = pfp;
        /**
         * @type {URL} The channel's thumbnail
         */
        this.thumbnail = tb;
        /**
         * @type {Date} The date when the stream started
         */
        this.date = new Date();
        this.viewers = v;
        if (!isEmpty(r.started_at)) {
            this.date = new Date(r.started_at);
        }
    }
    return StreamData;
}());
var UserData = /** @class */ (function () {
    function UserData(r, n, d, id, pfp, v) {
        this.raw = r;
        this.name = n;
        this.description = d;
        this.id = id;
        this.profile = pfp;
        this.views = v;
        if (!isEmpty(r.started_at)) {
            this.created = new Date(r.created_at);
        }
    }
    return UserData;
}());
var TwitchChannel = /** @class */ (function () {
    function TwitchChannel(n) {
        this.name = n;
        this.live = false;
        this.thumbnail = null;
    }
    TwitchChannel.prototype.setLive = function () {
        this.live = true;
    };
    TwitchChannel.prototype.notLive = function () {
        this.live = false;
    };
    TwitchChannel.prototype.isLive = function () {
        return this.live;
    };
    TwitchChannel.prototype.setTB = function (tb) {
        this.thumbnail = tb;
    };
    return TwitchChannel;
}());
function isEmpty(str) {
    if (str == "" || str == null || str == undefined || str.length == 0 || str.trim().length == 0 || str.trim() == "")
        return true;
    return false;
}
module.exports = {
    TwitchRequest: TwitchRequest,
    StreamData: StreamData,
    UserData: UserData,
    TwitchChannel: TwitchChannel
};
