# arduino-littlefs-upload README
(C) 2023 Earle F. Philhower, III

MIT licensed, see LICENSE.md

LittleFS uploader and builder compatible with Arduino IDE 2.2.1 or higher. For use with the [Raspberry Pi Pico RP2040 Arduino core `arduino-pico`](https://github.com/earlephilhower/arduino-pico), the community [ESP8266 Arduino core](https://github.com/esp8266/Arduino) and the community [ESP32 Arduino core](https://github.com/espressif/arduino-esp32).

## Usage, uploading a filesystem to the device

`[Ctrl]` + `[Shift]` + `[P]`, then "`Upload LittleFS to Pico/ESP8266/ESP32`".

On macOS, press `[⌘]` + `[Shift]` + `[P]` to open the Command Palette in the Arduino IDE, then "`Upload LittleFS to Pico/ESP8266/ESP32`".

## Usage, building (but not uploading) a filesystem to the device

For most users this is not ever needed, but it can be useful if you are distributing filesystem updates to many devices without needing the IDE.  The created filesystem image will be stored in the sketch directory as `mklittlefs.bin`, shown in the command output.

`[Ctrl]` + `[Shift]` + `[P]`, then "`Build LittleFS image in sketch directory`"

On macOS, press `[⌘]` + `[Shift]` + `[P]` to open the Command Palette in the Arduino IDE, then "`Build LittleFS image in sketch directory`"


## Glitches

The first sketch auto-opened by the IDE presently may have corrupted state which causes uploads to fail.
To work around this, you can change the board once (to anything) and then change it back to your proper board.
You can also open another sketch, close the auto-opened one, then re-open it.

A fix is already in the Arduino repository for this issue.

## Could not open <serial port>

If you get:
```
A fatal error occurred: Could not open <serial port>, the port doesn't exist
ERROR:  Upload failed, error code: 2
```
Make sure that you close any open `Serial Monitor` windows.


## Installation

Copy the [VSIX file](https://github.com/earlephilhower/arduino-littlefs-upload/releases) to `~/.arduinoIDE/plugins/` on Mac and Linux or `C:\Users\<username>\.arduinoIDE\plugins\` on Windows (you may need to make this directory yourself beforehand). Restart the IDE.

## Arduino Nano ESP32 Notes

This board uses DFU mode by default and requires several steps to make it compatible with this plug in.  See the Arduino Forum post for the necessary steps: https://forum.arduino.cc/t/best-method-for-utilizing-on-board-flash/1222469/15
