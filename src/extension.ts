import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ArduinoContext, BoardDetails } from 'vscode-arduino-api';
import { platform } from 'node:os';
import { spawn } from 'child_process';

const writeEmitter = new vscode.EventEmitter<string>();
let writerReady : boolean = false;

function makeTerminal(title : string) {
    // If it exists, move it to the front
    let w = vscode.window.terminals.find( (w) => ((w.name === title) && (w.exitStatus === undefined)));
    if (w !== undefined) {
        w.show(false);
        return;
    }
    // Not found, make a new terminal
    const pty = {
        onDidWrite: writeEmitter.event,
        open: () => { writerReady = true; },
        close: () => { writerReady = false; },
        handleInput: () => {}
    };
    const terminal = (<any>vscode.window).createTerminal({name: title, pty});
    terminal.show();
}

async function waitForTerminal(title : string) {
    makeTerminal("LittleFS Upload");

    // Wait for the terminal to become active.
    let cnt = 0;
    while (!writerReady) {
        if (cnt++ >= 50) { // Give it 5 seconds and then give up
            return false;
        }
        await new Promise( resolve => setTimeout(resolve, 100) );
    }

    return true;
}

function findTool(ctx: ArduinoContext, match : string) : string | undefined {
    let found = false;
    let ret = undefined;
    if (ctx.boardDetails !== undefined) {
        Object.keys(ctx.boardDetails.buildProperties).forEach( (elem) => {
            if (elem.startsWith(match) && !found && (ctx.boardDetails?.buildProperties[elem] !== undefined)) {
                ret = ctx.boardDetails.buildProperties[elem];
                found = true;
            }
        });
    }
    return ret;
}


// Taken from dankeboy32's esp-exception decoder.  Thanks!  https://github.com/dankeboy36/esp-exception-decoder
const clear = '\x1b[2J\x1b[3J\x1b[;H';
const resetStyle = '\x1b[0m';
enum ANSIStyle {
  'bold' = 1,
  'red' = 31,
  'green' = 32,
  'blue' = 34,
}

function red(text: string): string {
  return color(text, ANSIStyle.red);
}

function green(text: string, isBold = false): string {
  return color(text, ANSIStyle.green, isBold);
}

function blue(text: string, isBold = false): string {
  return color(text, ANSIStyle.blue, isBold);
}

function bold(text: string): string {
  return `\x1b[${ANSIStyle.bold}m${text}${resetStyle}`;
}

function color(
  text: string,
  foregroundColor: ANSIStyle,
  isBold = false
): string {
  return `\x1b[${foregroundColor}${
    isBold ? `;${ANSIStyle.bold}` : ''
  }m${text}${resetStyle}`;
}



// Execute a command and display it's output in the terminal
async function runCommand(exe : string, opts : any[]) {
    const cmd = spawn(exe, opts);
    for await (const chunk of cmd.stdout) {
        writeEmitter.fire(String(chunk).replace(/\n/g, "\r\n"));
    }
    for await (const chunk of cmd.stderr) {
        // Write stderr in red
        writeEmitter.fire("\x1b[31m" + String(chunk).replace(/\n/g, "\r\n") + "\x1b[0m");
    }
    // Wait until the executable finishes
    let exitCode = await new Promise( (resolve, reject) => {
        cmd.on('close', resolve);
    });
    return exitCode;
}

function getSelectedPartitionScheme(boardDetails : BoardDetails) : string | undefined {
    const partitionSchemeOptions = boardDetails.configOptions.find(option => option.option === "PartitionScheme");
    if (partitionSchemeOptions === undefined) {
        writeEmitter.fire(red("\r\n\r\nERROR: Failed to read partition scheme options\r\n"));
        return;
    }

    const selectedOption = partitionSchemeOptions.values.find(value => value.selected === true);
    if (selectedOption === undefined) {
        writeEmitter.fire(red("\r\n\r\nERROR: No partition scheme selected\r\n"));
        return;
    }

    return selectedOption.value;
}

function getDefaultPartitionScheme(boardDetails : BoardDetails) : string | undefined {
    // Default partition is in the key build.partitions
    let partitions = boardDetails.buildProperties["build.partitions"];
    if (!partitions) {
        writeEmitter.fire(red("\r\n\r\nERROR: Partitions not defined for this ESP32 board\r\n"));
    }

    return partitions;
}

function getPartitionSchemeFile(arduinoContext : ArduinoContext) {
    if (arduinoContext.sketchPath !== undefined) {
        let localPartitionsFile = arduinoContext.sketchPath + path.sep + "partitions.csv";
        if (fs.existsSync(localPartitionsFile)) {
            writeEmitter.fire(blue("Using partition: " + green("partitions.csv in sketch folder") + "\r\n"));
            return localPartitionsFile;
        }
    }

    if (arduinoContext.boardDetails === undefined) {
        // This should never happen from the state in which this is called.
        writeEmitter.fire(red("\r\n\r\nERROR: Board details is undefined\r\n"));
        return;
    }

    let selectedScheme = getSelectedPartitionScheme(arduinoContext.boardDetails);
    if (selectedScheme === undefined) {
        selectedScheme = getDefaultPartitionScheme(arduinoContext.boardDetails);
        if (selectedScheme === undefined) {
            writeEmitter.fire(red("\r\n\r\nERROR: No board partition scheme found\r\n"));
            return;
        }
    }

    // Selected Partition is the filename.csv in the partitions directory
    writeEmitter.fire(blue("Using partition: ") + green(selectedScheme) + "\r\n");

    let platformPath = arduinoContext.boardDetails.buildProperties["runtime.platform.path"];
    return platformPath + path.sep + "tools" + path.sep + "partitions" + path.sep + selectedScheme + ".csv";
}

export function activate(context: vscode.ExtensionContext) {
    // Get the Arduino info extension loaded
    const arduinoContext: ArduinoContext = vscode.extensions.getExtension('dankeboy36.vscode-arduino-api')?.exports;
    if (!arduinoContext) {
        // Failed to load the Arduino API.
        vscode.window.showErrorMessage("Unable to load the Arduino IDE Context extension.");
        return;
    }

    // Register the command
    const disposable = vscode.commands.registerCommand('arduino-littlefs-upload.uploadLittleFS', async () => {

        //let str = JSON.stringify(arduinoContext, null, 4);
        //console.log(str);

        if ((arduinoContext.boardDetails === undefined) ||  (arduinoContext.fqbn === undefined)){
            vscode.window.showErrorMessage("Board details not available. Compile the sketch once.");
            return;
        }

        if (!await waitForTerminal("LittleFS Upload")) {
            vscode.window.showErrorMessage("Unable to open upload terminal");
        }

        // Clear the terminal
        writeEmitter.fire(clear + resetStyle);

        writeEmitter.fire(bold("LittleFS Filesystem Uploader v" + String(context.extension.packageJSON.version) + " -- https://github.com/earlephilhower/arduino-littlefs-upload\r\n\r\n"));

        writeEmitter.fire(blue(" Sketch Path: ") + green("" + arduinoContext.sketchPath) + "\r\n");
        // Need to have a data folder present, or this isn't gonna work...
        let dataFolder = arduinoContext.sketchPath + path.sep + "data";
        writeEmitter.fire(blue("   Data Path: ") + green(dataFolder) + "\r\n");
        if (!fs.existsSync(dataFolder)) {
            writeEmitter.fire(red("\r\n\r\nERROR: No data folder found at " + dataFolder) + "\r\n");
            return;
        }

        // Figure out what we're running on
        let pico = false;
        let esp8266 = false;
        let esp32 = false;
        let esp32variant = "";
        switch (arduinoContext.fqbn.split(':')[1]) {
            case "rp2040": {
                writeEmitter.fire(blue("      Device: ") + green("RP2040 series") + "\r\n");
                pico = true;
                break;
            }
            case "esp8266": {
                writeEmitter.fire(blue("      Device: ") + green("ESP8266 series") + "\r\n");
                esp8266 = true;
                break;
            }
            case "esp32": {
                esp32 = true;
                esp32variant = arduinoContext.boardDetails.buildProperties['build.mcu'];
                writeEmitter.fire(blue("      Device: ") + green("ESP32 series, model " + esp32variant) + "\r\n");
                break;
            }
            default: {
                writeEmitter.fire(red("\r\n\r\nERROR: Only Arduino-Pico RP2040, ESP32, and ESP8266 supported.\r\n"));
                return;
            }
        }

        // Need to find the selected menu item, then get the associated build values for the FS configuration
        let fsStart = 0;
        let fsEnd = 0;
        let page = 0;
        let blocksize = 0;
        let uploadSpeed = 115200; // ESP8266-only
        if (esp32) {
            const partitionFile = getPartitionSchemeFile(arduinoContext);
            if (partitionFile === undefined) {
                writeEmitter.fire(red("\r\n\r\nERROR: Partitions not defined for this ESP32 board\r\n"));
                return;
            }
            writeEmitter.fire(blue("  Partitions: ") + green(partitionFile) + "\r\n");
            if (!fs.existsSync(partitionFile)) {
                writeEmitter.fire(red("\r\n\r\nERROR: Partition file not found!\r\n"));
                return;
            }
            let partitionData = fs.readFileSync(partitionFile, 'utf8');
            let partitionDataArray = partitionData.split("\n");
            for (var i = 1; i < partitionDataArray.length; i++){
                var partitionEntry = partitionDataArray[i].split(",");
                if (partitionEntry[0].includes("spiffs")) {
                    fsStart = parseInt(partitionEntry[3], 16); // Partition Offset
                    fsEnd = fsStart + parseInt(partitionEntry[4], 16); // Partition Length
                }
            }
            if (!fsStart || !fsEnd) {
                writeEmitter.fire(red("\r\n\r\nERROR: Partition entry not found in csv file!\r\n"));
                return;
            }

            uploadSpeed = Number(arduinoContext.boardDetails.buildProperties["upload.speed"]);
            // Fixed for ESP32
            page = 256;
            blocksize = 4096;
        }

        arduinoContext.boardDetails.configOptions.forEach( (opt) => {
            let optSeek = pico ? "flash" : "eesz";
            let startMarker = pico ? "fs_start" : "spiffs_start";
            let endMarker = pico ? "fs_end" : "spiffs_end";
            if (String(opt.option) === String(optSeek)) {
                opt.values.forEach( (itm) => {
                    if (itm.selected) {
                        let menustr = "menu." + optSeek + "." + itm.value + ".build.";
                        fsStart = Number(arduinoContext.boardDetails?.buildProperties[menustr + startMarker]);
                        fsEnd = Number(arduinoContext.boardDetails?.buildProperties[menustr + endMarker]);
                        if (pico) { // Fixed-size always
                            page = 256;
                            blocksize = 4096;
                        } else if (esp8266) {
                            page = Number(arduinoContext.boardDetails?.buildProperties[menustr + "spiffs_pagesize"]);
                            blocksize = Number(arduinoContext.boardDetails?.buildProperties[menustr + "spiffs_blocksize"]);
                        }
                    }
                });
            } else if (String(opt.option) === "baud") {
                opt.values.forEach( (itm) => {
                    if (itm.selected) {
                        uploadSpeed = Number(itm.value);
                    }
                });
            }
        });
        if (!fsStart || !fsEnd || !page || !blocksize || (fsEnd <= fsStart)) {
            writeEmitter.fire(red("\r\n\r\nERROR: No filesystem specified, check flash size menu\r\n"));
            return;
        }

        // Windows exes need ".exe" suffix
        let ext = (platform() === 'win32') ? ".exe" : "";
        let extEspTool = (platform() === 'win32') ? ".exe" : ((platform() === 'darwin') ? "" :  ".py");
        let mklittlefs = "mklittlefs" + ext;

        let tool = undefined;
        if (pico) {
            tool = findTool(arduinoContext, "runtime.tools.pqt-mklittlefs");
        } else if (esp32) {
            tool = findTool(arduinoContext, "runtime.tools.mklittlefs.path");
        } else { // ESP8266
            tool = findTool(arduinoContext, "runtime.tools.mklittlefs");
        }
        if (tool) {
            mklittlefs = tool + path.sep + mklittlefs;
        } else {
            writeEmitter.fire(red("\r\n\r\nERROR: mklittlefs not found!\r\n" + resetStyle));
        }

        // TBD - add non-serial UF2 upload via OpenOCD
        let serialPort = "";
        if (arduinoContext.port?.address === undefined) {
            writeEmitter.fire(red("\r\n\r\nERROR: No port specified, check IDE menus.\r\n"));
            return;
        } else {
            serialPort = arduinoContext.port?.address;
        }
        if (arduinoContext.port?.protocol !== "serial") {
            writeEmitter.fire(red("\r\n\r\nERROR: Only serial port upload supported at this time.\r\n"));
            return;
        }

        let python3 = "python3" + ext;
        let python3Path = undefined;
        if (pico) {
            python3Path = findTool(arduinoContext, "runtime.tools.pqt-python3");
        } else if (esp8266) {
            python3Path = findTool(arduinoContext, "runtime.tools.python3");
        } else if (esp32) {
            python3Path = findTool(arduinoContext, "runtime.tools.python3.path");
        }
        if (python3Path) {
            python3 = python3Path + path.sep + python3;
        }

        // We can't always know where the compile path is, so just use a temp name
        const tmp = require('tmp');
        tmp.setGracefulCleanup();
        let imageFile = tmp.tmpNameSync({postfix: ".littlefs.bin"});

        let buildOpts =  ["-c", dataFolder, "-p", String(page), "-b", String(blocksize), "-s", String(fsEnd - fsStart), imageFile];

        // All mklittlefs take the same options, so run in common
        writeEmitter.fire(bold("\r\nBuilding LittleFS filesystem\r\n"));
        writeEmitter.fire(blue("Command Line: ") + green(mklittlefs + " " + buildOpts.join(" ")) + "\r\n");

        let exitCode = await runCommand(mklittlefs, buildOpts);
        if (exitCode) {
            writeEmitter.fire(red("\r\n\r\nERROR:  Mklittlefs failed, error code: " + String(exitCode) + "\r\n\r\n"));
            return;
        }

        // Upload stage differs per core
        let uploadOpts : any[] = [];
        let cmdApp = python3;
        if (pico) {
            let uf2conv = "tools" + path.sep + "uf2conv.py";
            let uf2Path = findTool(arduinoContext, "runtime.platform.path");
            if (uf2Path) {
                uf2conv = uf2Path + path.sep + uf2conv;
            }
            uploadOpts = [uf2conv, "--base", String(fsStart), "--serial", serialPort, "--family", "RP2040", imageFile];
        } else if (esp32) {
            let flashMode = arduinoContext.boardDetails.buildProperties["build.flash_mode"];
            let flashFreq = arduinoContext.boardDetails.buildProperties["build.flash_freq"];
            let espTool = "esptool" + extEspTool;
            let espToolPath = findTool(arduinoContext, "runtime.tools.esptool_py.path");
            if (espToolPath) {
                espTool = espToolPath + path.sep + espTool;
            }
            uploadOpts = ["--chip", esp32variant, "--port", serialPort, "--baud", String(uploadSpeed),
                "--before", "default_reset", "--after", "hard_reset", "write_flash", "-z",
                "--flash_mode", flashMode, "--flash_freq", flashFreq, "--flash_size", "detect", String(fsStart), imageFile];
            if ((platform() === 'win32') || (platform() === 'darwin')) {
                cmdApp = espTool; // Have binary EXE on Mac/Windows
            } else {
                cmdApp = "python3"; // Not shipped, assumed installed on Linux
                uploadOpts.unshift(espTool); // Need to call Python3
            }
        } else { // esp8266
            let upload = "tools" + path.sep + "upload.py";
            let uploadPath = findTool(arduinoContext, "runtime.platform.path");
            if (uploadPath) {
                upload = uploadPath + path.sep + upload;
            }
            uploadOpts = [upload, "--chip", "esp8266", "--port", serialPort, "--baud", String(uploadSpeed), "write_flash", String(fsStart), imageFile];
        }

        writeEmitter.fire(bold("\r\nUploading LittleFS filesystem\r\n"));
        writeEmitter.fire(blue("Command Line: ") + green(cmdApp + " " + uploadOpts.join(" ") + "\r\n"));

        exitCode = await runCommand(cmdApp, uploadOpts);
        if (exitCode) {
            writeEmitter.fire(red("\r\n\r\nERROR:  Upload failed, error code: " + String(exitCode) + "\r\n\r\n"));
            return;
        }

        writeEmitter.fire(bold("\r\nCompleted upload.\r\n\r\n"));
        vscode.window.showInformationMessage("LittleFS upload completed!");
      });

      const findFile = vscode.commands.registerCommand('arduino-littlefs-upload.findPartitionFile', async () => {
        if ((arduinoContext.boardDetails === undefined) ||  (arduinoContext.fqbn === undefined)){
            vscode.window.showErrorMessage("Board details not available. Compile the sketch once.");
            return;
        }

        if (!await waitForTerminal("Partition Scheme")) {
            vscode.window.showErrorMessage("Unable to open terminal");
        }

        const partitionFile = getPartitionSchemeFile(arduinoContext);
        if (partitionFile === undefined) {
            writeEmitter.fire(red("\r\n\r\nError: Failed to find partition scheme file\r\n"));
            return;
        }

        writeEmitter.fire(blue("Partition scheme file: ") + green(partitionFile) + "\r\n");
      });
      context.subscriptions.push(disposable, findFile);
}

export function deactivate() { }
