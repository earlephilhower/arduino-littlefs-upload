# arduino-littlefs-upload README
(C) 2023 Earle F. Philhower, III

MIT licensed, see LICENSE.md

LittleFS uploader compatible with Arduino IDE 2.2.1 or higher. For use with the [Raspberry Pi Pico RP2040 Arduino core `arduino-pico`](https://github.com/earlephilhower/arduino-pico) and the community [ESP8266 Arduino core](https://github.com/esp8266/Arduino).

## Usage

`[Ctrl]` + `[Shift]` + `[P]`, then "`Upload LittleFS to Pico/ESP8266`".

On macOS, press `[⌘]` + `[Shift]` + `[P]` to open the Command Palette in the Arduino IDE, then "`Upload LittleFS to Pico/ESP8266`".

## Glitches

The first sketch auto-opened by the IDE presently may have corrupted state which causes uploads to fail.
To work around this, you can change the board once (to anything) and then change it back to your proper board.
You can also open another sketch, close the auto-opened one, then re-open it.

A fix is already in the Arduino repository for this issue.

## Installation

Copy the VSIX file to `~/.arduinoIDE/plugins/` (you may need to make this directory yourself beforehand) and restart the IDE.
