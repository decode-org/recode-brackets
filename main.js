/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** Extension that starts/stops Recode and saves when appropriate */
define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule('command/CommandManager'),
        Menus = brackets.getModule('command/Menus'),
        MainViewManager = brackets.getModule('view/MainViewManager'),
        EditorManager = brackets.getModule('editor/EditorManager'),
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
        this.lastTime = null;
        this.trackedFiles = [];
        this.trackedFileObjects = [];
        this.actions = [];

        this.onTextChangeProxy = Recoder.prototype.onTextChange.bind(this);
        this.onActiveEditorChangeProxy = Recoder.prototype.onActiveEditorChange.bind(this);
        this.onSelectionChangeProxy = Recoder.prototype.onSelectionChange.bind(this);
    };

    Recoder.prototype.addEvent = function(e) {
        var now = Date.now();
        var difference = now - this.lastTime;

        if (e.distance == null) {
            e.distance = difference;
        }

        this.lastTime = now;

        this.actions.push(e);
    };

    Recoder.prototype.onActiveEditorChange = function(e, editorGainingFocus, editorLosingFocus) {
        this.removeDocument();
        this.addDocument();
    };

    // This function *tries* to handle multiple selections
    // Proper tests need to be built to make sure that actually works
    Recoder.prototype.onTextChange = function(e, document, changelist) {
        var first = true;

        // Make sure the changes are in order
        // So we can adjust for changes in position
        // As all changes are in in pre-change coordinates
        if (changelist.length > 1) {
            changelist = changelist.slice().sort(function(a, b) {
                if ((a.to.line > b.from.line) || ((a.to.line == b.from.line) && (a.to.ch > b.from.ch))) {
                    return 1;
                } else if ((a.to.line == b.from.line) && (a.to.ch == b.from.ch)) {
                    return 0;
                } else {
                    return -1;
                }
            });
        }

        var offsets = { },
            rowOffset = 0;

        for (var i in changelist) {
            var change = changelist[i];

            var offset = 0;

            if (!first) {
                offset = offsets[String(change.from.line)] || 0;
            }

            var event = {
                data: change.text,
                position: {
                    row: change.from.line,
                    col: change.from.ch + offset
                },
                length: {
                    row: change.to.line - change.from.line,
                    col: (change.to.ch + ((change.from.line == change.to.line) ? offset : 0)) - (change.from.ch + offset)
                },
                mode: 0
            };

            var addOffset = change.text[change.text.length - 1].length - ((change.from.line == change.to.line)
                ? change.to.ch - change.from.ch
                : change.to.ch);

            offsets[String(change.to.line)] = (offsets[String(change.to.line)] || 0) + addOffset;

            // It appears that line values are in a post-change coordinate system
            //rowOffset += change.text.length - (change.to.line - change.from.line);

            if (!first) {
                event.distance = 0;
            }

            this.addEvent(event);

            first = false;
        }
    };

    Recoder.prototype.onSelectionChange = function(e) {
        console.log(arguments);
    }

    Recoder.prototype.addDocument = function() {
        this.currentEditor = EditorManager.getActiveEditor();

        if (this.currentEditor) {
            this.currentDocument = this.currentEditor.document;

            var displayPath = ProjectManager.makeProjectRelativeIfPossible(this.currentDocument.file.fullPath);
            var name = displayPath.replace(/\//g, '--');

            this.addEvent({
                data: name,
                mode: 2
            });

            if (this.trackedFiles.indexOf(this.currentDocument.file.fullPath) === -1) {
                this.trackedFileObjects.push({
                    path: name,
                    name: displayPath
                });
                this.trackedFiles.push(this.currentDocument.file.fullPath);
                var path = this.saveDir + name;
                var file = FileSystem.getFileForPath(path);
                file.write(this.currentDocument.getText(), function(error, stats) {
                    if (error) {
                        console.error("Error saving new Recode file: " + error);
                    }
                });
            }
            this.currentDocument.addRef();
            this.currentDocument.on('change', this.onTextChangeProxy);
        }
    };

    Recoder.prototype.removeDocument = function() {
        if (this.currentEditor) {
            this.currentDocument.off('change', this.onTextChangeProxy);
            this.currentDocument.releaseRef();
        }
        this.currentDocument = null;
        this.currentEditor = null;
    };

    Recoder.prototype.start = function(callback) {
        var self = this;
        var now = new Date();
        var formatDate = (now.getFullYear()) + '-' + (now.getMonth() + 1) + '-' + (now.getDate()) + '_' + (now.getHours()) + '-' + (now.getMinutes()) + '-' + (now.getSeconds());
        var recodeFolder = ProjectManager.getProjectRoot().fullPath + 'recode-sessions/';

        var startRecode = function startRecode() {
            self.recording = true;

            self.startTime = self.lastTime = Date.now();

            EditorManager.on('activeEditorChange', self.onActiveEditorChangeProxy);
            self.addDocument();

            callback();
        };

        var makeDirectory = function makeDirectory() {
            self.startTime = now.getTime();
            self.saveDir = recodeFolder + formatDate + '/';

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

    Recoder.prototype.save = function() {
        var finaldata = { };

        finaldata.files = this.trackedFileObjects;
        finaldata.recorded = this.actions;

        var savepath = this.saveDir + 'recodedata.json';
        var file = FileSystem.getFileForPath(savepath);
        file.write(JSON.stringify(finaldata), function(error, stats) {
            if (error) {
                console.error("Error saving new Recode data: " + error);
            }
        });
    };

    Recoder.prototype.stop = function() {
        this.recording = false;

        this.save();

        // Unbind events
        EditorManager.off('activeEditorChange', this.onActiveEditorChangeProxy);
        this.trackedFiles = [];
        this.actions = [];
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
