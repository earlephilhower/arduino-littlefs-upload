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
//		let str = JSON.stringify(arduinoContext, null, 4);
//		console.log(str);

		if ((arduinoContext.boardDetails === undefined) ||  (arduinoContext.fqbn === undefined)){
			vscode.window.showErrorMessage("Board details not available. Compile the sketch once.");
			return;
		}

		if (!arduinoContext.fqbn.startsWith("pico:rp2040")) { //} && !arduinoContext.compileSummary?.buildProperties.fqbn.startsWith("esp8266com:esp8266")) {
			vscode.window.showErrorMessage("Only Arduino-Pico RP2040 supported"); //and the ESP8266 supported");
			return;
		}

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

		let mklittlefs = "mklittlefs";
		if (arduinoContext.compileSummary?.buildProperties["runtime.os"].includes("windows")) {
			mklittlefs = mklittlefs + ".exe";
		}

		if (arduinoContext.compileSummary?.buildProperties["runtime.tools.pqt-mklittlefs.path"] !== undefined) {
			mklittlefs = arduinoContext.compileSummary?.buildProperties["runtime.tools.pqt-mklittlefs.path"] + "/" + mklittlefs;
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

		let python3 = "python3";
		if (arduinoContext.compileSummary?.buildProperties["runtime.tools.pqt-python3.path"] !== undefined) {
			python3 = arduinoContext.compileSummary?.buildProperties["runtime.tools.pqt-python3.path"] + "/" + python3;
		} // OTW, assume it's in the path is best we can do
		if (arduinoContext.compileSummary?.buildProperties["runtime.os"].includes("windows")) {
			python3 = python3 + ".exe";
		}

		let uf2conv = "tools/uf2conv.py";
		if (arduinoContext.compileSummary?.buildProperties["runtime.platform.path"] !== undefined) {
			uf2conv = arduinoContext.compileSummary?.buildProperties["runtime.platform.path"] + "/" + uf2conv;
		} // OTW, assume it's in the path is best we can do

		let dataFolder = arduinoContext.sketchPath + "/data";
		var path = require('path');
		let imageFile = "/" + path.basename(arduinoContext.sketchPath);
		if (arduinoContext.compileSummary?.buildPath !== undefined) {
			imageFile = arduinoContext.compileSummary?.buildPath + imageFile;
		}
		imageFile = imageFile + ".mklittlefs.bin";
		let buildCmd =  ["-c", dataFolder, "-p", String(page), "-b", String(blocksize), "-s", String(fsEnd - fsStart), imageFile];
		let uploadCmd = [uf2conv, "--base", String(fsStart), "--serial", serialPort, "--family", "RP2040", imageFile];
		
		const { spawnSync } = require('child_process');
		console.log("Building the file system image:   " + mklittlefs + " " + buildCmd.join(" "));
		spawnSync(mklittlefs, buildCmd);
		console.log("Uploading the file system image:  " + python3 + " " + uploadCmd.join(" "));
		spawnSync(python3, uploadCmd);
		console.log("Completed upload");
		vscode.window.showInformationMessage("LittleFS upload completed!");
	  });
	  context.subscriptions.push(disposable);
}

export function deactivate() {}


