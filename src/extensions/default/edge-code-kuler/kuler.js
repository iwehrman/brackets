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
        IMS_JUMPTOKEN_URL = "https://ims-na1.adobelogin.com/ims/jumptoken/v1",
        KULER_RESOURCE_THEMES = "themes",
        KULER_RESOURCE_SEARCH = "search",
        KULER_WEB_CLIENT_ID = "KulerWeb1",
        EC_KULER_API_KEY = "DBDB768C3A1EF5A0AFFF91C28C77E66A",
        AUTH_HEADER = "Bearer {{accesstoken}}",
        REFRESH_INTERVAL = 1000 * 60 * 10; // 10 minutes

    var themesCache = {},
        promiseCache = {},
        timers = {},
        jumpURLCache = {};

    function _constructKulerURL(resource, queryParams) {
        return Mustache.render(KULER_PRODUCTION_URL, {"resource" : resource, "queryparams" : queryParams});
    }

    function _constructMyThemesRequestURL() {
        return _constructKulerURL(KULER_RESOURCE_THEMES, "?filter=my_themes&maxNumber=100&metadata=all");
    }

    function _constructMyFavoritesRequestURL() {
        return _constructKulerURL(KULER_RESOURCE_THEMES, "?filter=likes&maxNumber=100&metadata=all");
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
    
    /**
     * Get URL info about Kuler theme, including a direct URL that is immediately
     * usable if the theme is public, and possibly also a jump URL that can be used
     * exactly once if theme is private. The jump URL will authenticate the user before
     * redirecting to the direct URL. If a jump URL is used once then the invalidate
     * function must be called to ensure that it will not be used again, and the direct
     * URL should be used thereafter.
     * 
     * @param {Object} theme - Kuler theme object
     * @return {$.Promise<{kulerURL: string, jumpURL: ?string, invalidate: Function()}>} - 
     *      a jQuery promise that resolves to the theme's URL info object, which includes
     *      a direct URL and optionally also a jump URL and invalidation function
     */
    function getThemeURLInfo(theme) {
        var fullId = theme.name.replace(/\ /g, "-") + "-color-theme-" + theme.id,
            url = Strings.KULER_URL + "/" + fullId + "/",
            deferred = $.Deferred();
        
        if (theme.access && theme.access.visibility === "public") {
            deferred.resolve({
                kulerURL: url
            });
        } else {
            if (brackets.authentication) {
                brackets.authentication.getAccessToken().done(function (token) {
                    if (!jumpURLCache.hasOwnProperty(token)) {
                        // only cache jumpURLs for the most recent access token
                        jumpURLCache = {};
                        jumpURLCache[token] = {};
                    }
                    
                    var jumpURL = jumpURLCache[token][url],
                        invalidateTimer = null,
                        invalidate = function () {
                            if (jumpURLCache.hasOwnProperty(token)) {
                                // the null value indicates that the jump token has
                                // already been generated and used for this token
                                jumpURLCache[token][url] = null;
                            }
                            
                            if (invalidateTimer) {
                                clearTimeout(invalidateTimer);
                            }
                        };
                    
                    if (jumpURL === null) {
                        // a jump url was previously fetched for this url, but it was invalidated
                        deferred.resolve({
                            kulerURL: url
                        });
                    } else if (typeof jumpURL === "string") {
                        // an unused jump url is available in the cache
                        deferred.resolve({
                            kulerURL: url,
                            jumpURL: jumpURL,
                            invalidate: invalidate
                        });
                    } else {
                        // no jump url has previously been fetched for this url
                        $.post(IMS_JUMPTOKEN_URL, {
                            target_client_id: KULER_WEB_CLIENT_ID,
                            target_redirect_uri: url,
                            bearer_token: token
                        }).done(function (data) {
                            jumpURL = data.jump;
                            
                            // cache the jump URL if the token hasn't changed
                            if (jumpURLCache.hasOwnProperty(token)) {
                                jumpURLCache[token][url] = jumpURL;
                                invalidateTimer = setTimeout(invalidate, REFRESH_INTERVAL);
                                // TODO: fire an event to notify clients when jump URLs expire
                            }
                            
                            deferred.resolve({
                                kulerURL: url,
                                jumpURL: jumpURL,
                                invalidate: invalidate
                            });
                        }).fail(function (err) {
                            deferred.reject(err);
                        });
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
    exports.getThemeURLInfo     = getThemeURLInfo;
    exports.flushCachedThemes   = flushCachedThemes;

    // for testing purpose
    exports._constructKulerURL              = _constructKulerURL;
    exports._constructMyThemesRequestURL    = _constructMyThemesRequestURL;
    exports._constructMyFavoritesRequestURL = _constructMyFavoritesRequestURL;
});
