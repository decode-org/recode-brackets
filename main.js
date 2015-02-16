/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** Extension that starts/stops Recode and saves when appropriate */
define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule('command/CommandManager'),
        Menus = brackets.getModule('command/Menus'),
        MainViewManager = brackets.getModule('view/MainViewManager'),
        DocumentManager = brackets.getModule('document/DocumentManager');

    var Recoder = function() {
        this.currentDocument = null;
        this.recording = false;
    };

    Recoder.prototype.onFileChange = function(e, newFile, newPaneId, oldFile, oldPaneId) {
        this.removeDocument();
        this.addDocument();
    };

    Recoder.prototype.onTextChange = function(e, document, changelist) {
        console.log(changelist);
    };

    Recoder.prototype.addDocument = function() {
        this.currentDocument = DocumentManager.getCurrentDocument();
        if (this.currentDocument) {
            this.currentDocument.addRef();
            this.currentDocument.on('change', this.onTextChange);
        }
    };

    Recoder.prototype.removeDocument = function() {
        if (this.currentDocument) {
            this.currentDocument.off('change', this.onTextChange);
            this.currentDocument.releaseRef();
        }
        this.currentDocument = null;
    };

    Recoder.prototype.start = function() {
        this.recording = true;

        MainViewManager.on('currentFileChange', this.onFileChange);
        this.addDocument();
    };

    Recoder.prototype.stop = function() {
        this.recording = false;

        // Unbind events
        MainViewManager.off('currentFileChange', this.onFileChange);
        this.removeDocument();
    };



    var recoder = new Recoder();

    // Function to run when the menu item is clicked
    function handleRecode() {
        if (!recoder.recording) {
            recoder.start();
            command.setName('Stop Recoding');
        } else {
            recoder.stop();
            command.setName('Recode');
        }
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
