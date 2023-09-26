import * as vscode from 'vscode';
import * as fs from 'fs';
import type { ArduinoContext } from 'vscode-arduino-api';
import { platform } from 'node:os';


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


export function activate(context: vscode.ExtensionContext) {
	// Get the Arduino info extension loaded
	const arduinoContext: ArduinoContext = vscode.extensions.getExtension('dankeboy36.vscode-arduino-api')?.exports;
	if (!arduinoContext) {
		// Failed to load the Arduino API.
		vscode.window.showErrorMessage("Unable to load the Arduino IDE Context extension.");
		return;
		}

	// Register the command
	let disposable = vscode.commands.registerCommand('pico-littlefs-upload.uploadLittleFS', () => {
		//let str = JSON.stringify(arduinoContext, null, 4);
		//console.log(str);

		if ((arduinoContext.boardDetails === undefined) ||  (arduinoContext.fqbn === undefined)){
			vscode.window.showErrorMessage("Board details not available. Compile the sketch once.");
			return;
		}

		// Figure out what we're running on
		let pico = false;
		let esp8266 = false;
		let esp32 = false;
		switch(arduinoContext.fqbn.split(':')[1]) {
			case "rp2040": {
				pico = true;
				break;
			}
			case "esp8266": {
				esp8266 = true;
				break;
			}
			//case "esp32": {
			//	esp32 = true;
			//	break;
			//}
			default: {
				vscode.window.showErrorMessage("Only Arduino-Pico RP2040 and ESP8266 supported"); //, and ESP32 supported");
				return;
			}

		}

		// Need to find the selected menu item, then get the associated build values
		let fsStart = 0;
		let fsEnd = 0;
		let page = 0;
		let blocksize = 0;
		let uploadSpeed = 0; // ESP8266-only
		if (pico || esp8266) {
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
		} else if (esp32) {
			// TODO
		}
		if (!fsStart || !fsEnd || !page || !blocksize || (fsEnd <= fsStart)) {
			vscode.window.showErrorMessage("No filesystem specified, check flash size menu");
			return;
		}

		// Windows exes need ".exe" suffix
		let ext = (platform() === 'win32') ? ".exe" : "";
		let mklittlefs = "mklittlefs" + ext;

		let tool = undefined;
		if (pico) {
			tool = findTool(arduinoContext, "runtime.tools.pqt-mklittlefs");
		} else { // ESP8266 and ESP32 have same name
			tool = findTool(arduinoContext, "runtime.tools.mklittlefs");
		}
		if (tool) {
			mklittlefs = tool + "/" + mklittlefs;
		}

		// TBD - add non-serial UF2 upload via OpenOCD
		let serialPort = "";
		if (arduinoContext.port?.address === undefined) {
			vscode.window.showErrorMessage("No port specified, check IDE menus");
			return;
		} else {
			serialPort = arduinoContext.port?.address;
		}
		if (arduinoContext.port?.protocol !== "serial") {
			vscode.window.showErrorMessage("Only serial port upload supported at this time");
			return;
		}

		let python3 = "python3" + ext;
		let python3Path = undefined;
		if (pico) {
			python3Path = findTool(arduinoContext, "runtime.tools.pqt-python3");
		} else if (esp8266) {
			python3Path = findTool(arduinoContext, "runtime.tools.python3");
		}
		if (python3Path) {
			python3 = python3Path + "/" + python3;
		}

		// We can't always know where the compile path is, so just use a temp name
		const tmp = require('tmp');
		tmp.setGracefulCleanup();
		let imageFile = tmp.tmpNameSync({postfix: ".littlefs.bin"});
		let dataFolder = arduinoContext.sketchPath + "/data";
		let buildOpts =  ["-c", dataFolder, "-p", String(page), "-b", String(blocksize), "-s", String(fsEnd - fsStart), imageFile];

		// All mklittlefs take the same options, so run in common
		const { spawnSync } = require('child_process');
		console.log("Building the file system image:   " + mklittlefs + " " + buildOpts.join(" "));
		vscode.window.showInformationMessage("Building LittleFS filesystem");
		spawnSync(mklittlefs, buildOpts);

		// Upload stage differs per core
		if (pico || esp8266) {
			let uploadOpts : String[] = [];
			if (pico) {
				let uf2conv = "tools/uf2conv.py";
				let uf2Path = findTool(arduinoContext, "runtime.platform.path");
				if (uf2Path) {
					uf2conv = uf2Path + "/" + uf2conv;
				}
				uploadOpts = [uf2conv, "--base", String(fsStart), "--serial", serialPort, "--family", "RP2040", imageFile];
			} else {
				let upload = "tools/upload.py";
				let uploadPath = findTool(arduinoContext, "runtime.platform.path");
				if (uploadPath) {
					upload = uploadPath + "/" + upload;
				}
				uploadOpts = [upload, "--chip", "esp8266", "--port", serialPort, "--baud", String(uploadSpeed), "write_flash", String(fsStart), imageFile];
			}

			console.log("Uploading the file system image:  " + python3 + " " + uploadOpts.join(" "));
			vscode.window.showInformationMessage("Uploading LittleFS filesystem");
			spawnSync(python3, uploadOpts);
			console.log("Completed upload");
		}
		vscode.window.showInformationMessage("LittleFS upload completed!");
	  });
	  context.subscriptions.push(disposable);
}

export function deactivate() {}