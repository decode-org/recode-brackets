/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** Extension that starts/stops Recode and saves when appropriate */
define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule('command/CommandManager'),
        Menus = brackets.getModule('command/Menus'),
        ExtensionUtils = brackets.getModule('utils/ExtensionUtils');

    var Recoder = require('recoder');

    var recoder = new Recoder();

    // Function to run when the menu item is clicked
    function handleRecode() {
        if (!recoder.recording) {
            recoder.start(function() {
                command.setName('Stop Recoding');
                $icon.addClass('active');
            });
        } else {
            recoder.stop();
            $icon.removeClass('active');
            command.setName('Recode');
        }
    }

    // First, register a command - a UI-less object associating an id to a handler
    var RECODE_COMMAND_ID = "recode.recode";   // package-style naming to avoid collisions
    var command = CommandManager.register("Recode", RECODE_COMMAND_ID, handleRecode);

    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)

    var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    menu.addMenuItem(RECODE_COMMAND_ID, "Ctrl-Alt-T");

    var $icon = $('<a id="recode-toolbar-icon"><span class="recode-toolbar-circle"></span></a>');
    $icon.appendTo($('#main-toolbar .buttons'));
    $icon.click(handleRecode);
    ExtensionUtils.loadStyleSheet(module, 'main.css');
    // (Note: "Ctrl" is automatically mapped to "Cmd" on Mac)
});
