/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** Extension that starts/stops Recode and saves when appropriate */
define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule('command/CommandManager'),
        Menus = brackets.getModule('command/Menus'),
        MainViewManager = brackets.getModule('view/MainViewManager'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        FileSystem = brackets.getModule('filesystem/FileSystem'),
        ProjectManager = brackets.getModule('project/ProjectManager'),
        Dialogs = brackets.getModule('widgets/Dialogs'),
        DefaultDialogs = brackets.getModule('widgets/DefaultDialogs'),
        ProjectModel = brackets.getModule('project/ProjectModel');

    var Recoder = function() {
        var self = this;

        this.currentDocument = null;
        this.recording = false;
        this.saveDir = null;
        this.startTime = null;
        this.trackedFiles = [];

        this.onTextChangeProxy = function() {
            Recoder.prototype.onTextChange.apply(self, arguments);
        };

        this.onFileChangeProxy = function() {
            Recoder.prototype.onFileChange.apply(self, arguments);
        }
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
        console.log(this.currentDocument);
        if (this.currentDocument) {
            if (this.trackedFiles.indexOf(this.currentDocument.file.fullPath) === -1) {
                this.trackedFiles.push(this.currentDocument.file.fullPath);
                var path = this.saveDir + ProjectManager.makeProjectRelativeIfPossible(this.currentDocument.file.fullPath).replace(/\//g, '--');
                var file = FileSystem.getFileForPath(path);
                file.write(this.currentDocument.getText(), function(error, stats) {
                    console.error("Error saving new Recode file: " + error);
                });
            }
            this.currentDocument.addRef();
            this.currentDocument.on('change', this.onTextChangeProxy);
        }
    };

    Recoder.prototype.removeDocument = function() {
        if (this.currentDocument) {
            this.currentDocument.off('change', this.onTextChangeProxy);
            this.currentDocument.releaseRef();
        }
        this.currentDocument = null;
    };

    Recoder.prototype.start = function(callback) {
        var self = this;
        var now = new Date();
        var formatDate = (now.getFullYear()) + '-' + (now.getMonth() + 1) + '-' + (now.getDate()) + '_' + (now.getHours()) + '-' + (now.getMinutes()) + '-' + (now.getSeconds());
        var recodeFolder = ProjectManager.getProjectRoot().fullPath + 'recode-sessions/';

        var startRecode = function startRecode() {
            self.recording = true;

            MainViewManager.on('currentFileChange', self.onFileChangeProxy);
            self.addDocument();

            callback();
        };

        var makeDirectory = function makeDirectory() {
            self.startTime = now.getTime();
            self.saveDir = recodeFolder + formatDate + '/';
            console.log(self.saveDir);

            ProjectManager
                .createNewItem(ProjectManager.getProjectRoot(), 'recode-sessions/' + formatDate + '/', true, true)
                .done(startRecode);
        };

        FileSystem.resolve(recodeFolder, function(error, file, stats) {
            if ((error) && (error !== 'NotFound')) {
                Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_ERROR, 'Error', 'Something went wrong when trying to find the recode-sessions folder: ' + error);
                return;
            }

            if ((!file) || (file.isDirectory)) {
                makeDirectory();
            } else {
                Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_ERROR, 'Save Error', 'The entry "recode-sessions" at project root must be a directory, currently it is not.');
            }
        });
    };

    Recoder.prototype.stop = function() {
        this.recording = false;

        // Unbind events
        MainViewManager.off('currentFileChange', this.onFileChangeProxy);
        this.trackedFiles = [];
        this.removeDocument();
    };



    var recoder = new Recoder();

    // Function to run when the menu item is clicked
    function handleRecode() {
        if (!recoder.recording) {
            recoder.start(function() {
                command.setName('Stop Recoding');
            });
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
