# The Smart Throne (Webapp MVP)

Webapp-Prototyp fuer den Kiosk-Flow.

## Enthaltene MVP-Funktionen

- Endlos-Loop ueber Slides (Text, Raetsel, Vokabeln, Bilder)
- Timer pro Slide mit Progressbar
- Reveal-Logik fuer Raetsel (`revealDelay`)
- Persistenz von `last_index` via `localStorage`
- JSON-Einlesen aus `slides.json` beim Start (mit Fallback auf Defaults)
- Verstecktes Admin-Menue per Long-Press oben rechts
- Auto-Import von Bildern anhand Dateinamen-Schema

## JSON-Format

Die App erwartet ein Objekt mit `slides`-Array in `slides.json`.
Unterstuetzte Felder je Slide:

- `id`
- `type` (`text_quote`, `image_only`, `riddle`, `vocabulary`)
- `category`
- `title`
- `content`
- `sub_content`
- `answer` (wird bei `riddle` als aufgedeckter Text genutzt)
- `image_path`
- `caption` (Fallback fuer `content`/`sub_content`)
- `duration`
- `reveal_delay`

## Dateinamen-Schema fuer Import

`TYPE_DURATION_REVEAL_TITLE.webp`

Beispiele:

- `IMAGE_ONLY_20_0_Klare_Gedanken.webp`
- `RIDDLE_25_12_Was_hat_Zaehne_aber_beisst_nicht.jpg`

## Lokal starten

```bash
cd /Users/alleki/Documents/codex-apps/meine-desktop-app/the-smart-throne
python3 -m http.server 8080
```

Dann `http://localhost:8080` oeffnen.

## Demo-Content generieren

```bash
cd /Users/alleki/Documents/codex-apps/meine-desktop-app/the-smart-throne
python3 generate_slides.py --count 60 --size 1080x1920 --output slides.json
```

Optionen:

- `--count`: Anzahl Slides
- `--size`: Bildgroesse fuer `image_path` (z. B. `1080x1920`)
- `--source`: `picsum-seed` (stabil) oder `picsum-id` (zufaellige IDs)
- `--output`: Zieldatei (standardmaessig `slides.generated.json`)
