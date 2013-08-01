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
        return _constructKulerURL(KULER_RESOURCE_THEMES, "?filter=my_kuler&maxNumber=100&metadata=all");
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
     * Get a Kuler theme's URL. If the theme is publically visible, a direct URL
     * is constructed. If it is private, an IMS JumpURL is constructed that will
     * redirect to the theme after logging the user in.
     * 
     * @param {Object} theme - Kuler theme object
     * @return {$.Promise<string>} - a jQuery promise that resolves to the theme's URL
     */
    function getThemeURL(theme) {
        var fullId = theme.name.replace(/\ /g, "-") + "-color-theme-" + theme.id,
            url = Strings.KULER_URL + "/" + fullId + "/",
            deferred = $.Deferred();
        
        if (theme.access && theme.access.visibility === "public") {
            deferred.resolve(url);
        } else {
            if (brackets.authentication) {
                brackets.authentication.getAccessToken().done(function (token) {
                    if (!jumpURLCache.hasOwnProperty(token)) {
                        // only cache jumpURLs for the most recent access token
                        jumpURLCache = {};
                        jumpURLCache[token] = {};
                    }

                    var jumpURL = jumpURLCache[token][url];
                    
                    if (jumpURL) {
                        deferred.resolve(jumpURL);
                    } else {
                        $.post(IMS_JUMPTOKEN_URL, {
                            target_client_id: KULER_WEB_CLIENT_ID,
                            target_redirect_uri: url,
                            bearer_token: token
                        }).done(function (data) {
                            jumpURL = data.jump;
                            
                            // cache the jump URL if the token hasn't changed
                            if (jumpURLCache.hasOwnProperty(token)) {
                                jumpURLCache[token][url] = jumpURL;
                            }
                            
                            deferred.resolve(jumpURL);
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
    }
    
    // Public API
    exports.getMyThemes         = getMyThemes;
    exports.getFavoriteThemes   = getFavoriteThemes;
    exports.getThemeURL         = getThemeURL;
    exports.flushCachedThemes   = flushCachedThemes;

    // for testing purpose
    exports._constructKulerURL              = _constructKulerURL;
    exports._constructMyThemesRequestURL    = _constructMyThemesRequestURL;
    exports._constructMyFavoritesRequestURL = _constructMyFavoritesRequestURL;
});
