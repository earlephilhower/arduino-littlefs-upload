# arduino-littlefs-upload README
(C) 2023 Earle F. Philhower, III
MIT licensed, see LICENSE.md

Really rough LittleFS uploader compatiblew with Arduino IDE 2.2.1 or higher.
For use with the [Raspberry Pi Pico RP2040 Arduino core `arduino-pico`](https://github.com/earlephilhower/arduino-pico) and the community [ESP8266 Arduino core](https://github.com/esp8266/Arduino).

## Usage

`[Ctrl]+[Shift]+[P]``, then "`Upload LittleFS to Pico/ESP8266"

## Glitches

The first sketch auto-opened by the IDE presently has corrupted state and uploads cannot be done on it.
You need to open another sketch, close the first auto-opened sketch, and then re-open it to upload for that one.
You also need to run a build/compile (upload of sketch is uptional) one time for certain file system parameters to be available.

## Installation

Copy the VSIX file to `~/.arduinoIDE/plugins/` (you may need to make this directory yourself beforehand) and restart the IDE.
