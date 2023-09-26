import * as vscode from 'vscode';
import * as fs from 'fs';
import type { ArduinoContext } from 'vscode-arduino-api';
import { platform } from 'node:os';


export function activate(context: vscode.ExtensionContext) {
    // Get the Arduino info extension loaded
	const arduinoContext: ArduinoContext = vscode.extensions.getExtension(
		'dankeboy36.vscode-arduino-api'
	  )?.exports;
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

		if (!arduinoContext.fqbn.startsWith("pico:rp2040")) { //} && !arduinoContext.fqbn.startsWith("esp8266com:esp8266")) {
			vscode.window.showErrorMessage("Only Arduino-Pico RP2040 supported"); //and the ESP8266 supported");
			return;
		}

		// TODO - Can we get the ArduinoContext to export the actual set of values, not just the label?  Then we can use arduinoContext.boardDetails.configOptions
		if ((arduinoContext.compileSummary?.buildProperties["build.fs_start"] === undefined) || (arduinoContext.compileSummary?.buildProperties["build.fs_end"] === undefined)) {
			vscode.window.showErrorMessage("No filesystem settings defined. Compile the sketch once.");
			return;
		}

		let fsStart = Number(arduinoContext.compileSummary?.buildProperties["build.fs_start"]);
		let fsEnd = Number(arduinoContext.compileSummary?.buildProperties["build.fs_end"]);
		let page = 256;
		let blocksize = 4096;

		if (fsEnd <= fsStart) {
			vscode.window.showErrorMessage("No filesystem specified, check flash size menu");
			return;
		}

		// Windows exes need ".exe" suffix
		let ext = (platform() === 'win32') ? ".exe" : "";
		let mklittlefs = "mklittlefs" + ext;

		if (arduinoContext.boardDetails.buildProperties["runtime.tools.pqt-mklittlefs.path"] !== undefined) {
			mklittlefs = arduinoContext.boardDetails.buildProperties["runtime.tools.pqt-mklittlefs.path"] + "/" + mklittlefs;
		} // OTW, assume it's in the path is best we can do
		
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
		if (arduinoContext.boardDetails.buildProperties["runtime.tools.pqt-python3.path"] !== undefined) {
			python3 = arduinoContext.boardDetails.buildProperties["runtime.tools.pqt-python3.path"] + "/" + python3;
		} // OTW, assume it's in the path is best we can do

		let uf2conv = "tools/uf2conv.py";
		if (arduinoContext.boardDetails.buildProperties["runtime.platform.path"] !== undefined) {
			uf2conv = arduinoContext.boardDetails.buildProperties["runtime.platform.path"] + "/" + uf2conv;
		} // OTW, assume it's in the path is best we can do

		let dataFolder = arduinoContext.sketchPath + "/data";
		var path = require('path');
		let imageFile = "/" + path.basename(arduinoContext.sketchPath);
		if (arduinoContext.compileSummary?.buildPath !== undefined) {
			imageFile = arduinoContext.compileSummary?.buildPath + imageFile;
		}
		imageFile = imageFile + ".mklittlefs.bin";
		let buildOpts =  ["-c", dataFolder, "-p", String(page), "-b", String(blocksize), "-s", String(fsEnd - fsStart), imageFile];
		let uploadOpts = [uf2conv, "--base", String(fsStart), "--serial", serialPort, "--family", "RP2040", imageFile];
		
		const { spawnSync } = require('child_process');
		console.log("Building the file system image:   " + mklittlefs + " " + buildOpts.join(" "));
		spawnSync(mklittlefs, buildOpts);
		console.log("Uploading the file system image:  " + python3 + " " + uploadOpts.join(" "));
		spawnSync(python3, uploadOpts);
		console.log("Completed upload");
		vscode.window.showInformationMessage("LittleFS upload completed!");
	  });
	  context.subscriptions.push(disposable);
}

export function deactivate() {}


