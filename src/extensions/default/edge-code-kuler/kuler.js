/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, Mustache, $, setTimeout, clearTimeout */

define(function (require, exports, module) {
    "use strict";

    var PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    var Strings = require("strings");

    var KULER_PRODUCTION_URL = "https://www.adobeku.com/api/v2/{{resource}}?{{{querystring}}}",
        KULER_RESOURCE_THEMES = "themes",
        KULER_WEB_CLIENT_ID = "KulerWeb1",
        EC_KULER_API_KEY = "DBDB768C3A1EF5A0AFFF91C28C77E66A",
        AUTH_HEADER = "Bearer {{accesstoken}}",
        PREFS_URLS_KEY = "KULER_URLS",
        PREFS_LAST_DISPLAYED_COLLECTION_KEY = "LAST_DISPLAYED_COLLECTION",
        REFRESH_INTERVAL = 1000 * 60 * 15; // 15 minutes
    
    // TODO due to https://github.com/adobe/brackets/issues/4758 the number of
    // themes fetched may not be bigger than 60. Otherwise the scrollbar leaves
    // an artifact on screen when it is being hidden.
    var MAX_THEMES = 60;

    var IMS_JUMPTOKEN_URL = "https://ims-na1.adobelogin.com/ims/jumptoken/v1",
        IMS_JUMPTOKEN_SCOPE = "openid",
        IMS_JUMPTOKEN_RESPONSE_TYPE = "token";
    
    var COLLECTION_MY_THEMES    = "MY_KULER_THEMES",
        COLLECTION_FAVORITES    = "FAVORITE_KULER_THEMES",
        COLLECTION_POPULAR      = "POPULAR_KULER_THEMES",
        COLLECTION_RANDOM       = "RANDOM_KULER_THEMES";
    
    var COLLECTION_URLS = (function () {
        var queryParams = {};
            
        queryParams[COLLECTION_MY_THEMES] = {
            "filter": "my_themes",
            "maxNumber": MAX_THEMES,
            "metadata": "all"
        };
        
        queryParams[COLLECTION_FAVORITES] = {
            "filter": "likes",
            "maxNumber": MAX_THEMES,
            "metadata": "all"
        };
        
        queryParams[COLLECTION_POPULAR] = {
            "filter": "public",
            "maxNumber": MAX_THEMES,
            "metadata": "all",
            "sort": "view_count",
            "time": "month"
        };

        queryParams[COLLECTION_RANDOM] = {
            "filter": "public",
            "maxNumber": MAX_THEMES,
            "metadata": "all",
            "sort": "random"
        };
        
        function getQueryString(params) {
            var keys = Object.keys(params).sort(),
                args = keys.map(function (key) {
                    var value = encodeURIComponent(params[key]);
                    return key + "=" + value;
                });
    
            return args.join("&");
        }
        
        function getURL(collection) {
            var params = queryParams[collection],
                querystring = getQueryString(params),
                settings = {
                    resource: KULER_RESOURCE_THEMES,
                    querystring: querystring
                };
            return Mustache.render(KULER_PRODUCTION_URL, settings);
        }

        return Object.keys(queryParams).reduce(function (prev, collectionName) {
            prev[collectionName] = getURL(collectionName);
            return prev;
        }, {});
    }());
    
    var prefs           = PreferencesManager.getPreferenceStorage(module),
        themesCache     = {},
        promiseCache    = {},
        timers          = {},
        jumpURLCache    = {};

    /*
     * Load the set of cached themes URLs from the prefs. Each URL in the set
     * is a key in the preferences module at which a themes object is found.
     *
     * @return {Object.<string:bool>} A set of URLs.
     */
    function _loadCachedThemesURLsFromPrefs() {
        var urlsObj;
        try {
            var urlsJSON = prefs.getValue(PREFS_URLS_KEY);
            urlsObj = JSON.parse(urlsJSON);
        } catch (e) {
            urlsObj = {};
            prefs.setValue(PREFS_URLS_KEY, urlsObj);
        }
        return urlsObj;
    }

    /**
     * Load all the themes saved in the prefs into the themesCache
     */
    function loadCachedThemesFromPrefs() {
        var urlObj = _loadCachedThemesURLsFromPrefs(),
            urls = Object.keys(urlObj);

        urls.forEach(function (url) {
            try {
                var themesJSON  = prefs.getValue(url),
                    themesObj   = JSON.parse(themesJSON);

                themesCache[url] = themesObj;
            } catch (e) {
                prefs.remove(url);
            }
        });
    }

    /*
     * Saves a themesObj, keyed by the url from whence it came, in the prefs.
     *
     * @param {string} url - from whence the themesObj came
     * @param {Object} themesObj - a themesObj from the Kuler REST API
     */
    function _storeCachedThemesToPrefs(url, themesObj) {
        var urlsObj = _loadCachedThemesURLsFromPrefs();

        urlsObj[url] = true;
        prefs.setValue(PREFS_URLS_KEY, JSON.stringify(urlsObj));
        prefs.setValue(url, JSON.stringify(themesObj));
    }

    /*
     * Remove all saved themes objects from the prefs.
     */
    function _flushCachedThemesFromPrefs() {
        var urlsObj = _loadCachedThemesURLsFromPrefs(),
            urls = Object.keys(urlsObj);

        urls.forEach(function (url) {
            prefs.remove(url);
        });

        prefs.setValue(PREFS_URLS_KEY, {});
    }

    function _executeAjaxRequest(requestConfig) {
        return $.ajax(requestConfig);
    }

    function _prepareKulerRequest(kulerUrl, accessToken) {
        var headers = {
            "x-api-key" : EC_KULER_API_KEY,
            "Authorization" : Mustache.render(AUTH_HEADER, {accesstoken : accessToken})
        };

        return exports._executeAjaxRequest({url: kulerUrl, headers : headers});
    }

    function _getThemesFromKuler(collectionName) {
        var url = COLLECTION_URLS[collectionName],
            deferred = new $.Deferred();

        if (brackets.authentication) {
            var accessTokenPromise = brackets.authentication.getAccessToken();

            accessTokenPromise.done(function (accessToken) {
                var jqXHR = _prepareKulerRequest(url, accessToken);

                jqXHR.done(function (data) {
                    deferred.resolve(data);
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    deferred.reject(errorThrown);
                });
            }).fail(function (err) {
                deferred.reject(err);
            });
        } else {
            deferred.reject();
        }

        return deferred.promise();
    }

    function getThemes(collectionName, refresh) {
        function _refreshThemes() {
            var promise = promiseCache[collectionName];

            if (promise) {
                // return the not-yet-fulfilled promise
                return promise;
            } else {
                if (timers[collectionName]) {
                    clearTimeout(timers[collectionName]);
                    delete timers[collectionName];
                }

                promise = _getThemesFromKuler(collectionName);
                promiseCache[collectionName] = promise;

                promise.always(function () {
                    delete promiseCache[collectionName];

                    timers[collectionName] = setTimeout(function () {
                        // refresh themes occasionally
                        getThemes(collectionName, true);
                    }, REFRESH_INTERVAL);
                });

                promise.done(function (themes) {
                    // promise fulfilled. Cache the updated themes.
                    themesCache[collectionName] = themes;

                    // save the theme in the prefs for offline use
                    _storeCachedThemesToPrefs(collectionName, themes);
                    
                    // notify listeners that the cached themes were updated
                    $(exports).triggerHandler("themesUpdated", [collectionName, themes]);
                });

                return promise;
            }
        }

        var cachedThemes = themesCache[collectionName],
            refreshPromise;

        if (refresh || !cachedThemes) {
            refreshPromise = _refreshThemes();
        }

        if (cachedThemes) {
            // return the set of cached themes
            return $.Deferred().resolve(cachedThemes).promise();
        } else {
            // return the promise to be refreshed
            return refreshPromise;
        }
    }

    /**
     * Get URL info about Kuler theme in the form of a jQuery promise that resolves to a
     * function that produces a theme's URL. The URL can change after each request, so
     * clients should always call the returned function before crafting a request.
     *
     * @param {Object} theme - Kuler theme object
     * @return {Promise.<function(): string>} -
     *      a jQuery promise that resolves a function that dynamically provides the correct
     *      URL for a theme. Clients should call this function before crafting each request.
     */
    function getThemeURLInfo(theme) {
        var fullId = theme.name.replace(/\ /g, "-") + "-color-theme-" + theme.id,
            url = Strings.KULER_URL + "/" + fullId + "/",
            deferred = $.Deferred();

        if (theme.access && theme.access.visibility === "public") {
            // public themes can always use the direct URL
            deferred.resolve(function () {
                return url;
            });
        } else {
            if (brackets.authentication) {
                brackets.authentication.getAccessToken().done(function (token) {
                    /*
                     * A function that returns the correct URL for the given theme.
                     * If there is no cached jump URL then return the direct URL.
                     * Otherwise return the cached jumpURL before nullifying it, so
                     * that it won't be returned a second time.
                     */
                    function getURL() {
                        if (jumpURLCache.hasOwnProperty(token)) {
                            if (jumpURLCache[token].hasOwnProperty(url)) {
                                var jumpURL = jumpURLCache[token][url];
                                if (typeof jumpURL === "string") {
                                    // a cached jump URL exists
                                    if (jumpURLCache.hasOwnProperty(token) && jumpURLCache[token][url]) {
                                        // ... but a null value indicates that the jump url has
                                        // both been generated and already used once
                                        jumpURLCache[token][url] = null;
                                    }
                                    return jumpURL;
                                }
                            }
                        }
                        return url;
                    }

                    if (!jumpURLCache.hasOwnProperty(token)) {
                        jumpURLCache[token] = {};
                    }

                    if (!jumpURLCache[token].hasOwnProperty(url)) {
                        // no jump URL has previously been fetched for this URL
                        // so request a new one before resolving
                        $.post(IMS_JUMPTOKEN_URL, {
                            target_scope: IMS_JUMPTOKEN_SCOPE,
                            target_response_type: IMS_JUMPTOKEN_RESPONSE_TYPE,
                            target_client_id: KULER_WEB_CLIENT_ID,
                            target_redirect_uri: url,
                            bearer_token: token
                        }).done(function (data) {
                            var jumpURL = data.jump;

                            // cache the jump URL if the token hasn't changed
                            if (jumpURLCache.hasOwnProperty(token)) {
                                jumpURLCache[token][url] = jumpURL;
                                setTimeout(function () {
                                    // remove the cached jump URL entirely once it expires
                                    if (jumpURLCache.hasOwnProperty(token)) {
                                        if (jumpURLCache[token].hasOwnProperty(url)) {
                                            delete jumpURLCache[token][url];
                                        }

                                        if (Object.keys(jumpURLCache[token]).length === 0) {
                                            delete jumpURLCache[token];
                                        }
                                    }
                                }, REFRESH_INTERVAL);
                            }

                            deferred.resolve(getURL);
                        }).fail(function (err) {
                            deferred.reject(err);
                        });
                    } else {
                        deferred.resolve(getURL);
                    }
                }).fail(function (err) {
                    deferred.reject(err);
                });
            } else {
                deferred.reject();
            }
        }

        return deferred.promise();
    }

    /**
     * Retrieves the name of the last collection displayed as previously stored
     * by the PreferenceManager.
     *
     * @return {string} Name of last collection.  Can be 'undefined' if nothing
     *      had been previously saved.
     */
    function getLastDisplayedCollection() {
        return prefs.getValue(PREFS_LAST_DISPLAYED_COLLECTION_KEY);
    }
    
    /**
     * Remember the name of the last collection displayed in the Kuler panel.
     * Will persist the value in the PreferenceManager to be available across
     * application instances.
     *
     * @param {string} Name of last collection to save
     */
    function setLastDisplayedCollection(collection) {
        prefs.setValue(PREFS_LAST_DISPLAYED_COLLECTION_KEY, collection);
    }
    
    function flushCachedThemes() {
        themesCache = {};
        promiseCache = {};
        _flushCachedThemesFromPrefs();
    }

    // Public API
    exports.getThemes                   = getThemes;
    exports.getThemeURLInfo             = getThemeURLInfo;
    exports.loadCachedThemesFromPrefs   = loadCachedThemesFromPrefs;
    exports.getLastDisplayedCollection  = getLastDisplayedCollection;
    exports.setLastDisplayedCollection  = setLastDisplayedCollection;
    exports.flushCachedThemes           = flushCachedThemes;
    
    exports.COLLECTION_MY_THEMES    = COLLECTION_MY_THEMES;
    exports.COLLECTION_FAVORITES    = COLLECTION_FAVORITES;
    exports.COLLECTION_POPULAR      = COLLECTION_POPULAR;
    exports.COLLECTION_RANDOM       = COLLECTION_RANDOM;
    exports.orderedCollectionNames  = [COLLECTION_MY_THEMES,
                                       COLLECTION_FAVORITES,
                                       COLLECTION_POPULAR,
                                       COLLECTION_RANDOM];

    // for testing purposes
    exports.COLLECTION_URLS     = COLLECTION_URLS;
    exports._executeAjaxRequest = _executeAjaxRequest;
});
