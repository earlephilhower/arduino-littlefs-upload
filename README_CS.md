# arduino-spiffs-upload README

Založeno na arduino-littlefs-uploader od (C) 2023 Earle F. Philhower, III

Pod licencí MIT, viz LICENSE.md

SPIFFS uploader kompatibilní s Arduino IDE 2.2.1 nebo vyšším. Pro použití s [Raspberry Pi Pico RP2040 Arduino core `arduino-pico`](https://github.com/earlephilhower/arduino-pico), komunitním [ESP8266 Arduino core](https://github.com/esp8266/Arduino) a komunitním [ESP32 Arduino core](https://github.com/espressif/arduino-esp32).

## Použití

`[Ctrl]` + `[Shift]` + `[P]`, potom "`Upload SPIFFS to Pico/ESP8266/ESP32`".

V systému macOS stiskněte `[⌘]` + `[Shift]` + `[P]` pro otevření palety příkazů v prostředí Arduino IDE a poté "`Upload SPIFFS to Pico/ESP8266/ESP32`".

## Závady

První sketch automaticky otevřený IDE může mít v současné době poškozený stav, což způsobuje neúspěšné nahrávání.
Chcete-li to obejít, můžete změnit desku (na jakoukoli jinou) a pak ji změnit zpět na správnou desku.
Můžete také otevřít jiný sketch, zavřít ten automaticky otevřený a pak jej znovu otevřít.

V repozitáři Arduina je již oprava tohoto problému.

Pokud se vám zobrazí:
```
A fatal error occurred: Could not open <serial port>, the port doesn't exist
ERROR:  Upload failed, error code: 2
```
tak se ujistěte, že jste zavřeli všechna otevřená okna `Serial Monitor`.

## Instalace

Zkopírujte soubor [VSIX](https://github.com/espx-cz/arduino-spiffs-upload/releases) do adresáře `~/.arduinoIDE/plugins/` v systémech Mac a Linux nebo `C:\Users\<uživatelské jméno>\.arduinoIDE\plugins\` v systému Windows (možná budete muset tento adresář předem vytvořit sami). Restartujte IDE.
