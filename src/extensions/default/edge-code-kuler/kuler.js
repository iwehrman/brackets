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
    
    var Strings = require("strings");

    var KULER_PRODUCTION_URL = "https://www.adobeku.com/api/v2/{{resource}}{{{queryparams}}}",
        KULER_RESOURCE_THEMES = "themes",
        KULER_WEB_CLIENT_ID = "KulerWeb1",
        EC_KULER_API_KEY = "DBDB768C3A1EF5A0AFFF91C28C77E66A",
        AUTH_HEADER = "Bearer {{accesstoken}}",
        REFRESH_INTERVAL = 1000 * 60 * 15; // 15 minutes

    var IMS_JUMPTOKEN_URL = "https://ims-na1.adobelogin.com/ims/jumptoken/v1",
        IMS_JUMPTOKEN_SCOPE = "openid",
        IMS_JUMPTOKEN_RESPONSE_TYPE = "token";
    
    // TODO due to https://github.com/adobe/brackets/issues/4758 the number of
    // themes fetched may not be bigger than 60. Otherwise the scrollbar leaves
    // an artifact on screen when it is being hidden.
    var MAX_THEMES = 60;

    var themesCache = {},
        promiseCache = {},
        timers = {},
        jumpURLCache = {};

    function _constructKulerURL(resource, queryParams) {
        return Mustache.render(KULER_PRODUCTION_URL, {"resource" : resource, "queryparams" : queryParams});
    }

    function _constructMyThemesRequestURL() {
        var queryParams = "?filter=my_themes&maxNumber=" + MAX_THEMES + "&metadata=all";
        return _constructKulerURL(KULER_RESOURCE_THEMES, queryParams);
    }

    function _constructMyFavoritesRequestURL() {
        var queryParams = "?filter=likes&maxNumber=" + MAX_THEMES + "&metadata=all";
        return _constructKulerURL(KULER_RESOURCE_THEMES, queryParams);
    }
    
    function _constructRandomThemesRequestURL() {
        var queryParams = "?filter=public&maxNumber=" + MAX_THEMES + "&metadata=all&sort=random";
        return _constructKulerURL(KULER_RESOURCE_THEMES, queryParams);
    }
    
    function _constructPopularThemesRequestURL() {
        var queryParams = "?filter=public&maxNumber=" + MAX_THEMES + "&metadata=all&sort=view_count&time=month";
        return _constructKulerURL(KULER_RESOURCE_THEMES, queryParams);
    }

    function _prepareKulerRequest(kulerUrl, accessToken) {
        var headers = {
            "x-api-key" : EC_KULER_API_KEY,
            "Authorization" : Mustache.render(AUTH_HEADER, {accesstoken : accessToken})
        };

        return $.ajax({url: kulerUrl, headers : headers});
    }

    function _executeRequest(url) {
        var deferred = new $.Deferred();

        if (brackets.authentication) {
            var accessTokenPromise = brackets.authentication.getAccessToken();

            accessTokenPromise.done(function (accessToken) {
                var jqXHR = _prepareKulerRequest(url, accessToken);

                jqXHR.done(function (data) {
                    deferred.resolve(data);
                }).fail(function () {
                    deferred.reject();
                });
            });

            accessTokenPromise.fail(function () {
                deferred.reject();
            });
        } else {
            deferred.reject();
        }

        return deferred.promise();
    }

    function _getThemes(url, refresh) {
        function _refreshThemes() {
            var promise = promiseCache[url];
    
            if (promise) {
                // return the not-yet-fulfilled promise
                return promise;
            } else {
                if (timers[url]) {
                    clearTimeout(timers[url]);
                    delete timers[url];
                }
                
                promise = _executeRequest(url);
                promiseCache[url] = promise;
                
                promise.always(function () {
                    delete promiseCache[url];
                    
                    timers[url] = setTimeout(function () {
                        // refresh themes occasionally
                        _getThemes(url, true);
                    }, REFRESH_INTERVAL);
                });
                
                promise.done(function (data) {
                    // promise fulfilled.  Cache the updated themes.
                    themesCache[url] = data;
                });
                
                return promise;
            }
        }
        
        var cachedThemes = themesCache[url],
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

    function getMyThemes(refresh) {
        var url = _constructMyThemesRequestURL();
        return _getThemes(url, refresh);
    }

    function getFavoriteThemes(refresh) {
        var url = _constructMyFavoritesRequestURL();
        
        return _getThemes(url, refresh);
    }
    
    function getRandomThemes(refresh) {
        var url = _constructRandomThemesRequestURL();
        
        return _getThemes(url, refresh);
    }
    
    function getPopularThemes(refresh) {
        var url = _constructPopularThemesRequestURL();
        
        return _getThemes(url, refresh);
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
    
    function flushCachedThemes() {
        themesCache = {};
        promiseCache = {};
    }
    
    // Public API
    exports.getMyThemes         = getMyThemes;
    exports.getFavoriteThemes   = getFavoriteThemes;
    exports.getRandomThemes     = getRandomThemes;
    exports.getPopularThemes    = getPopularThemes;
    exports.getThemeURLInfo     = getThemeURLInfo;
    exports.flushCachedThemes   = flushCachedThemes;

    // for testing purpose
    exports._constructKulerURL                  = _constructKulerURL;
    exports._constructMyThemesRequestURL        = _constructMyThemesRequestURL;
    exports._constructRandomThemesRequestURL    = _constructRandomThemesRequestURL;
    exports._constructPopularThemesRequestURL   = _constructPopularThemesRequestURL;
    exports._constructMyFavoritesRequestURL     = _constructMyFavoritesRequestURL;
});
