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
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var CommandManager      = require("command/CommandManager"),
        Menus               = require("command/Menus"),
        Strings             = require("strings"),
        AppInit             = require("utils/AppInit");

    // private vars
    var creativeCloudConnector = null;

    function getAuthorizedUser() {
        if (creativeCloudConnector) {
            creativeCloudConnector.call(creativeCloudConnector, "getAuthorizedUser");
        }
    }

    function registerCreativeCloudConnector(connector) {
        creativeCloudConnector = connector;
    }

//    // Update the MenuItem by changing the underlying command
//    var updateEnabledState = function () {
//        var editor = EditorManager.getFocusedEditor();
//        command3.setEnabled(editor && editor.getSelectedText() !== "");
//    };

    // menu handler
    function _handleManageCreativeCloudAccount() {
        console.log("Manage Creative Cloud Account");
    }

    function _handleManageAdobeIDProfile() {
        console.log("Manage Adobe ID Profile");
    }

    var COMMAND_HELP_MANAGE_CREATIVE_CLOUD_ACCOUNT = "help.ManageCreativeCloudAccount",
        COMMAND_HELP_MANAGE_ADOBEID_PROFILE = "help.ManageAdobeIDProfile";

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
    exports.registerCreativeCloudConnector = registerCreativeCloudConnector;
});
