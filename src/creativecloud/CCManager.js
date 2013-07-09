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
/*global define, Mustache, */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var CommandManager      = require("command/CommandManager"),
        Menus               = require("command/Menus"),
        Strings             = require("strings"),
        NativeApp           = require("utils/NativeApp"),
        AppInit             = require("utils/AppInit");

    // private vars
    var _creativeCloudConnector = null;

    var COMMAND_HELP_MANAGE_CREATIVE_CLOUD_ACCOUNT = "help.ManageCreativeCloudAccount",
        COMMAND_HELP_MANAGE_ADOBEID_PROFILE = "help.ManageAdobeIDProfile";

    // TODO: what about fr and jp Adobe homepage?
    var URL_MANAGE_ADOBE_ID = "https://www.adobe.com/account/sign-in.adobedotcom.html?returnURL=https://www.adobe.com/account/account-information.html#mypersonalprofile",
        URL_CREATIVE_CLOUD_HOMEPAGE = "http://creative.adobe.com";

    function getAuthorizedUser() {
        if (_creativeCloudConnector) {
            return _creativeCloudConnector.getAuthorizedUser();
        }
    }

    function getAccessToken() {
        if (_creativeCloudConnector) {
            return _creativeCloudConnector.getAccessToken();
        }
    }

    function registerCreativeCloudConnector(connector) {
        if (_creativeCloudConnector !== null) {
            console.log("There is already a Creative Cloud Connector registered. This will overwrite the previous one.");
        }

        _creativeCloudConnector = connector;

        getAuthorizedUser().done(function (authorizedUserInfo) {
            console.log(authorizedUserInfo);

            var menuEntryLabel = Mustache.render(Strings.COMPLETE_UPDATE_ADOBEID_PROFILE_EMAIL, {email : authorizedUserInfo.email});
            CommandManager.get(COMMAND_HELP_MANAGE_ADOBEID_PROFILE).setName(menuEntryLabel);
        }).fail(function (error) {
            console.log("Unable to retrieve information about logged in user. Perhaps not logged in?");
        });
    }

    // menu handler
    function _handleManageCreativeCloudAccount() {
        NativeApp.openURLInDefaultBrowser(URL_CREATIVE_CLOUD_HOMEPAGE);
    }

    function _handleManageAdobeIDProfile() {
        NativeApp.openURLInDefaultBrowser(URL_MANAGE_ADOBE_ID);
    }

    // register the Menu handler
    CommandManager.register(Strings.MANAGE_ACCOUNT_ONLINE, COMMAND_HELP_MANAGE_CREATIVE_CLOUD_ACCOUNT, _handleManageCreativeCloudAccount);
    CommandManager.register(Strings.COMPLETE_UPDATE_ADOBEID_PROFILE, COMMAND_HELP_MANAGE_ADOBEID_PROFILE, _handleManageAdobeIDProfile);

    function setupCCMenuEntries() {
        var helpMenu = Menus.getMenu(Menus.AppMenuBar.HELP_MENU);

        helpMenu.addMenuDivider();
        helpMenu.addMenuItem(COMMAND_HELP_MANAGE_CREATIVE_CLOUD_ACCOUNT);
        helpMenu.addMenuItem(COMMAND_HELP_MANAGE_ADOBEID_PROFILE);
    }

    AppInit.appReady(function () {
        setupCCMenuEntries();
    });

    // Define public API
    exports.getAuthorizedUser              = getAuthorizedUser;
    exports.getAccessToken                 = getAccessToken;
    exports.registerCreativeCloudConnector = registerCreativeCloudConnector;
});
