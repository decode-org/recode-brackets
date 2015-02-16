/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** Extension that starts/stops Recode and saves when appropriate */
define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule('command/CommandManager'),
        Menus = brackets.getModule('command/Menus'),
        MainViewManager = brackets.getModule('view/MainViewManager'),
        DocumentManager = brackets.getModule('document/DocumentManager');

    var Recoder = {
        onFileChange: function(e, newFile, newPaneId, oldFile, oldPaneId) {
            Recoder.removeDocument();
            Recoder.addDocument();
        },
        onTextChange: function(e, document, changelist) {
            console.log(changelist);
        },
        addDocument: function() {
            Recoder.currentDocument = DocumentManager.getCurrentDocument();
            if (Recoder.currentDocument) {
                Recoder.currentDocument.addRef();
                Recoder.currentDocument.on('change', Recoder.onTextChange);
            }
        },
        removeDocument: function() {
            if (Recoder.currentDocument) {
                Recoder.currentDocument.off('change', Recoder.onTextChange);
                Recoder.currentDocument.releaseRef();
            }
            Recoder.currentDocument = null;
        },
        currentDocument: null,
        recording: false
    };

    // Function to run when the menu item is clicked
    function handleRecode() {
        if (!Recoder.recording) {
            startRecode();
            command.setName('Stop Recoding');
        } else {
            stopRecode();
            command.setName('Recode');
        }
    }

    function startRecode() {
        Recoder.recording = true;

        // Bind events
        MainViewManager.on('currentFileChange', Recoder.onFileChange);
        Recoder.addDocument();
    }

    function stopRecode() {
        Recoder.recording = false;

        // Unbind events
        MainViewManager.off('currentFileChange', Recoder.onFileChange);
        Recoder.removeDocument();
    }

    // First, register a command - a UI-less object associating an id to a handler
    var RECODE_COMMAND_ID = "recode.recode";   // package-style naming to avoid collisions
    var command = CommandManager.register("Recode", RECODE_COMMAND_ID, handleRecode);

    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)
    var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    menu.addMenuItem(RECODE_COMMAND_ID);

    // We could also add a key binding at the same time:
    //menu.addMenuItem(MY_COMMAND_ID, "Ctrl-Alt-H");
    // (Note: "Ctrl" is automatically mapped to "Cmd" on Mac)
});
