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
    makeTerminal(title);

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

function fancyParseInt(str: string) : number {
    var up = str.toUpperCase().trim();
    if (up == "") {
        return 0;
    }
    if (up.indexOf('0X') >= 0) {
        return parseInt(str, 16);
    } else if (up.indexOf('K') >= 0) {
        return 1024 * parseInt(up.substring(0, up.indexOf('K')));
    } else if (up.indexOf('M') >= 0) {
        return 1024 * 1024 * parseInt(up.substring(0, up.indexOf('M')));
    } else {
        return parseInt(str);
    }
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

function getSelectedUploadMethod(boardDetails : BoardDetails) : string {
    const uploadOptions = boardDetails.configOptions.find(option => option.option === "uploadmethod");
    if (uploadOptions === undefined) {
        return "default";
    }

    const selectedOption = uploadOptions.values.find(value => value.selected === true);
    if (selectedOption === undefined) {
        return "default";
    }

    return selectedOption.value;
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

    return boardDetails.buildProperties["menu.PartitionScheme." + selectedOption.value + ".build.partitions"];
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

    // Register the upload command
    const disposable = vscode.commands.registerCommand('arduino-littlefs-upload.uploadLittleFS', async () => { doOperation(context, arduinoContext, true); });
    context.subscriptions.push(disposable);

    // Register the build command
    const disposable2 = vscode.commands.registerCommand('arduino-littlefs-upload.buildLittleFS', async () => { doOperation(context, arduinoContext, false); });
    context.subscriptions.push(disposable2);
}

async function doOperation(context: vscode.ExtensionContext, arduinoContext: ArduinoContext, doUpload: boolean) {
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

    writeEmitter.fire(bold("LittleFS Filesystem " + (doUpload ? "Uploader" : "Builder" ) + " v" + String(context.extension.packageJSON.version) + " -- https://github.com/earlephilhower/arduino-littlefs-upload\r\n\r\n"));

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
    let rp2350 = false;
    let uploadmethod = "default";
    let esp8266 = false;
    let esp32 = false;
    let esp32variant = "";
    switch (arduinoContext.fqbn.split(':')[1]) {
        case "rp2040": {
            writeEmitter.fire(blue("      Device: ") + green("RP2040 series") + "\r\n");
            pico = true;
            rp2350 = arduinoContext.boardDetails.buildProperties['build.chip'].startsWith("rp2350");
            uploadmethod = getSelectedUploadMethod(arduinoContext.boardDetails);
            writeEmitter.fire(blue("Upload Using: ") + green(uploadmethod) + "\r\n");
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
            writeEmitter.fire(red("\r\n\r\nERROR: Only Arduino-Pico RP2040, RP2350, ESP32, and ESP8266 supported.\r\n"));
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
        var lastend = 0x8000 + 0xc00;
        for (var i = 0; i < partitionDataArray.length; i++){
            var line = partitionDataArray[i];
            if (line.indexOf('#') >= 0) {
                line = line.substring(0, line.indexOf('#'));
            }
            var partitionEntry = line.split(",");
            if (partitionEntry.length > 4) {
                var offset = fancyParseInt(partitionEntry[3]);
                var length = fancyParseInt(partitionEntry[4]);
                if (offset == 0) {
                    offset = lastend;
                }
                lastend = offset + length;
                var parttype = partitionEntry[2].toUpperCase().trim();
                if ((parttype == "SPIFFS") || (parttype == "LITTLEFS")) {
                    fsStart = offset;
                    fsEnd = fsStart + length;
                }
            }
        }
        if (!fsStart || !fsEnd) {
            writeEmitter.fire(red("\r\n\r\nERROR: Partition entry not found in csv file!\r\n"));
            return;
        }
        writeEmitter.fire(blue("       Start: ") + green("0x" + fsStart.toString(16)) + "\r\n");
        writeEmitter.fire(blue("         End: ") + green("0x" + fsEnd.toString(16)) + "\r\n");

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
        } else if ((String(opt.option) === "baud") || (String(opt.option) === "UploadSpeed")) {
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
        tool = findTool(arduinoContext, "runtime.tools.mklittlefs-3.1.0-gcc10.3-e5f9fec.path");
    }
    if (tool) {
        mklittlefs = tool + path.sep + mklittlefs;
    } else {
        writeEmitter.fire(red("\r\n\r\nERROR: mklittlefs not found!\r\n" + resetStyle));
    }

    let network = false;
    let networkPort = 0;
    let serialPort = "";
    if (uploadmethod === "picotool") {
        serialPort = "picotool";
    } else if (uploadmethod === "picoprobe_cmsis_dap") {
        serialPort = "openocd";
    } else if (arduinoContext.port?.address === undefined) {
        if (doUpload) {
            writeEmitter.fire(red("\r\n\r\nERROR: No port specified, check IDE menus.\r\n"));
            return;
        }
    } else {
        serialPort = arduinoContext.port?.address;
    }
    if (arduinoContext.port?.protocol === "network") {
        if (!arduinoContext.port?.properties.port) {
            writeEmitter.fire(red("\r\n\r\nERROR: Network upload but port specified, check IDE menus.\r\n"));
            return;
        }
        networkPort = Number(arduinoContext.port?.properties.port);
        network = true;
        writeEmitter.fire(blue("Network Info: ") + green(serialPort + ":" + String(networkPort)) + "\r\n");
    } else if (arduinoContext.port?.protocol === "serial") {
        writeEmitter.fire(blue(" Serial Port: ") + green(serialPort) + "\r\n");
    } else {
        if (doUpload) {
            writeEmitter.fire(red("\r\n\r\nERROR: Unknown upload method '" + String(arduinoContext.port?.properties.port) + "' specified, check IDE menus.\r\n"));
            return;
        }
    }

    let python3 = "python3" + ext;
    let python3Path = undefined;
    let picotool = "picotool" + ext;
    let picotoolPath = undefined;
    let openocd = "openocd" + ext;
    let openocdPath = undefined;
    if (pico) {
        python3Path = findTool(arduinoContext, "runtime.tools.pqt-python3");
        picotoolPath = findTool(arduinoContext, "runtime.tools.pqt-picotool");
        openocdPath = findTool(arduinoContext, "runtime.tools.pqt-openocd");
    } else if (esp8266) {
        python3Path = findTool(arduinoContext, "runtime.tools.python3");
    } else if (esp32) {
        python3Path = findTool(arduinoContext, "runtime.tools.python3.path");
    }
    if (python3Path) {
        python3 = python3Path + path.sep + python3;
    }
    if (picotoolPath) {
        picotool = picotoolPath + path.sep + picotool;
    }
    if (openocdPath) {
        openocd = openocdPath + path.sep + "bin" + path.sep + openocd;
    }

    // We can't always know where the compile path is, so just use a temp name
    const tmp = require('tmp');
    tmp.setGracefulCleanup();
    let imageFile = "";
    if (doUpload) {
        imageFile = tmp.tmpNameSync({postfix: ".littlefs.bin"});
    } else {
        imageFile = arduinoContext.sketchPath + path.sep + "mklittlefs.bin";
        writeEmitter.fire(blue("Output File:  ") + green(imageFile) + "\r\n");
    }

    let buildOpts =  ["-c", dataFolder, "-p", String(page), "-b", String(blocksize), "-s", String(fsEnd - fsStart), imageFile];

    // All mklittlefs take the same options, so run in common
    writeEmitter.fire(bold("\r\nBuilding LittleFS filesystem\r\n"));
    writeEmitter.fire(blue("Command Line: ") + green(mklittlefs + " " + buildOpts.join(" ")) + "\r\n");

    let exitCode = await runCommand(mklittlefs, buildOpts);
    if (exitCode) {
        writeEmitter.fire(red("\r\n\r\nERROR:  Mklittlefs failed, error code: " + String(exitCode) + "\r\n\r\n"));
        return;
    }

    if (!doUpload) {
        writeEmitter.fire(bold("\r\nCompleted build.\r\n\r\n"));
        vscode.window.showInformationMessage("LittleFS build completed!");
        return;
    }

    let conversion = false
    if (pico) {
        if (Number(arduinoContext.boardDetails?.buildProperties['version'].split('.')[0]) > 3) {
            if (rp2350) {
                // Pico 4.x needs a preparation stage for the RP2350
                writeEmitter.fire(bold("\r\n4.0 or above\r\n"));
                let picotoolOpts = ["uf2", "convert", imageFile, "-t", "bin", imageFile +  ".uf2", "-o", "0x" + fsStart.toString(16), "--family", "data"];
                writeEmitter.fire(bold("\r\nGenerating UF2 image\r\n"));
                writeEmitter.fire(blue("Command Line: ") + green(picotool + " " + picotoolOpts.join(" ") + "\r\n"));
                exitCode = await runCommand(picotool, picotoolOpts);
                if (exitCode) {
                    writeEmitter.fire(red("\r\n\r\nERROR:  Generation failed, error code: " + String(exitCode) + "\r\n\r\n"));
                    return;
                }
                conversion = true;
            }
        } else {
            writeEmitter.fire(bold("\r\n3.x, no UF2 conversion\r\n"));
        }
    }

    // Upload stage differs per core
    let uploadOpts : any[] = [];
    let cmdApp = python3;
    if (pico) {
        if (uploadmethod === "picotool") {
            cmdApp = picotool;
            uploadOpts = ["load", imageFile, "-o",  "0x" + fsStart.toString(16), "-f", "-x"];
        } else if (uploadmethod === "picoprobe_cmsis_dap") {
            cmdApp = openocd;
            let chip = "rp2040";
            if (arduinoContext.boardDetails.buildProperties['build.chip']) {
                chip = arduinoContext.boardDetails.buildProperties['build.chip'];
            }
            uploadOpts = ["-f", "interface/cmsis-dap.cfg", "-f", "target/" + chip +".cfg", "-s", openocdPath + "/share/openocd/scripts",
                          "-c", "init; adapter speed 5000; program "+ imageFile + " verify 0x" + fsStart.toString(16) + "; reset; exit"];
        } else {
            if (network) {
                let espota = "tools" + path.sep + "espota.py";
                let espotaPath = findTool(arduinoContext, "runtime.platform.path");
                if (espotaPath) {
                    espota = espotaPath + path.sep + espota;
                }
                uploadOpts = ["-I", espota, "-i", serialPort, "-p", String(networkPort), "-f", imageFile, "-s"];
            } else {
                let uf2conv = "tools" + path.sep + "uf2conv.py";
                let uf2Path = findTool(arduinoContext, "runtime.platform.path");
                if (uf2Path) {
                    uf2conv = uf2Path + path.sep + uf2conv;
                }
                if (conversion) {
                    uploadOpts = [uf2conv, "--serial", serialPort, "--family", "RP2040", imageFile + ".uf2", "--deploy"];
                } else {
                    uploadOpts = [uf2conv, "--base", String(fsStart), "--serial", serialPort, "--family", "RP2040", imageFile];
                }
            }
        }
    } else if (esp32) {
        if (network) {
            let espota = "tools" + path.sep + "espota";
            let espotaPath = findTool(arduinoContext, "runtime.platform.path");
            if (espotaPath) {
                espota = espotaPath + path.sep + espota;
            }
            uploadOpts = ["-r", "-i", serialPort, "-p", String(networkPort), "-f", imageFile, "-s"];

            if (platform() === 'win32') {
                cmdApp = espota; // Have binary EXE on Windows
            } else {
                cmdApp = "python3"; // Not shipped, assumed installed on Linux and MacOS
                uploadOpts.unshift(espota + ".py"); // Need to call Python3
            }
        } else {
            let flashMode = arduinoContext.boardDetails.buildProperties["build.flash_mode"];
            let flashFreq = arduinoContext.boardDetails.buildProperties["build.flash_freq"];
            let espTool = "esptool";
            let espToolPath = findTool(arduinoContext, "runtime.tools.esptool_py.path");
            if (espToolPath) {
                espTool = espToolPath + path.sep + espTool;
            }
            uploadOpts = ["--chip", esp32variant, "--port", serialPort, "--baud", String(uploadSpeed),
                "--before", "default_reset", "--after", "hard_reset", "write_flash", "-z",
                "--flash_mode", flashMode, "--flash_freq", flashFreq, "--flash_size", "detect", String(fsStart), imageFile];
            if ((platform() === 'win32') || (platform() === 'darwin')) {
                cmdApp = espTool + extEspTool; // Have binary EXE on Mac/Windows
            } else {
                // Sometimes they give a .py, sometimes they give a precompiled binary
                // If there's a .py we'll use that one, OTW hope there's a binary one
                if (fs.existsSync(espTool + extEspTool)) {
                    cmdApp = "python3"; // Not shipped, assumed installed on Linux
                    uploadOpts.unshift(espTool + extEspTool); // Need to call Python3
                } else {
                    cmdApp = espTool; // Binary without extension
                }
            }
        }
    } else { // esp8266
        if (network) {
            let espota = "tools" + path.sep + "espota.py";
            let espotaPath = findTool(arduinoContext, "runtime.platform.path");
            if (espotaPath) {
                espota = espotaPath + path.sep + espota;
            }
            uploadOpts = [espota, "-i", serialPort, "-p", String(networkPort), "-f", imageFile, "-s"];
        } else {
            let upload = "tools" + path.sep + "upload.py";
            let uploadPath = findTool(arduinoContext, "runtime.platform.path");
            if (uploadPath) {
                upload = uploadPath + path.sep + upload;
            }
            uploadOpts = [upload, "--chip", "esp8266", "--port", serialPort, "--baud", String(uploadSpeed), "write_flash", String(fsStart), imageFile];
        }
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
}

export function deactivate() { }
