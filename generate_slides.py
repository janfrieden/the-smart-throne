#!/usr/bin/env python3
"""Generate demo content for The Smart Throne slides.json format."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path


QUOTES = [
    ("Wer alles gibt, hat nichts zu verlieren.", "Unbekannt"),
    ("Die beste Zeit fuer einen Neuanfang ist jetzt.", "Buddha"),
    ("Einfachheit ist die hoechste Stufe der Vollendung.", "Leonardo da Vinci"),
    ("Probleme sind Gelegenheiten, zu zeigen, was man kann.", "Duke Ellington"),
    ("Niemand weiss, was er kann, bevor er es versucht.", "Publilius Syrus"),
]

RIDDLES = [
    ("Was hat Zaehne, kann aber nicht beissen?", "Ein Kamm"),
    ("Was wird nasser, je mehr es trocknet?", "Ein Handtuch"),
    ("Was gehoert dir, aber andere benutzen es oefter?", "Dein Name"),
    (
        "Ich bin schwer, wenn ich vorne bin, aber nicht, wenn ich hinten bin. Was bin ich?",
        "Der Buchstabe 'g'",
    ),
    ("Je mehr es davon gibt, desto weniger sieht man. Was ist es?", "Dunkelheit"),
]

VOCAB = [
    ("Ethereal", "Himmlisch / Fluechtig", "The music had an ethereal quality."),
    ("Luminous", "Leuchtend", "The watch has luminous hands."),
    ("Ambiguous", "Mehrdeutig", "The ending of the movie was very ambiguous."),
    ("Persistent", "Beharrlich", "She is a persistent investigator."),
    ("Inevitable", "Unvermeidlich", "Change is an inevitable part of life."),
]


def parse_size(value: str) -> tuple[int, int]:
    raw = value.lower().replace(" ", "")
    parts = raw.split("x", 1)
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("Size must be WIDTHxHEIGHT, e.g. 1080x1920")
    try:
        width = int(parts[0])
        height = int(parts[1])
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Size values must be integers") from exc
    if width < 100 or height < 100:
        raise argparse.ArgumentTypeError("Size too small; use values >= 100")
    return width, height


def build_image_url(source: str, width: int, height: int, seed: str) -> str:
    if source == "picsum-id":
        image_id = random.randint(10, 1000)
        return f"https://picsum.photos/id/{image_id}/{width}/{height}"
    return f"https://picsum.photos/seed/{seed}/{width}/{height}"


def generate_slides(count: int, width: int, height: int, image_source: str) -> list[dict]:
    slides: list[dict] = []
    choices = ["quote", "riddle", "vocab", "image"]
    weights = [3, 2, 2, 3]

    for index in range(1, count + 1):
        choice = random.choices(choices, weights=weights, k=1)[0]

        if choice == "quote":
            content, author = random.choice(QUOTES)
            slide = {
                "id": f"q_{index:03d}",
                "type": "text_quote",
                "category": "Motivation",
                "title": "Gedanke des Tages",
                "content": content,
                "sub_content": author,
                "duration": random.randint(12, 20),
            }
        elif choice == "riddle":
            content, answer = random.choice(RIDDLES)
            duration = random.randint(18, 24)
            reveal_delay = min(random.randint(8, 14), duration - 3)
            slide = {
                "id": f"r_{index:03d}",
                "type": "riddle",
                "category": "Brain Gym",
                "title": "Kurzes Raetsel",
                "content": content,
                "answer": answer,
                "reveal_delay": reveal_delay,
                "duration": duration,
            }
        elif choice == "vocab":
            word, translation, example = random.choice(VOCAB)
            slide = {
                "id": f"v_{index:03d}",
                "type": "vocabulary",
                "category": "English",
                "title": "Word of the Day",
                "content": word,
                "sub_content": translation,
                "example_sentence": example,
                "duration": random.randint(14, 20),
            }
        else:
            seed = f"smart-throne-{index}-{random.randint(1000, 9999)}"
            slide = {
                "id": f"i_{index:03d}",
                "type": "image_only",
                "category": "Gallery",
                "image_path": build_image_url(image_source, width, height, seed),
                "caption": f"Inspiration #{index}",
                "duration": random.randint(12, 18),
            }

        slides.append(slide)

    return slides


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Smart Throne content JSON (slides array)."
    )
    parser.add_argument(
        "-o",
        "--output",
        default="slides.generated.json",
        help="Output file path (default: slides.generated.json)",
    )
    parser.add_argument(
        "-n",
        "--count",
        type=int,
        default=50,
        help="Number of slides to generate (default: 50)",
    )
    parser.add_argument(
        "--size",
        type=parse_size,
        default=(1080, 1920),
        help="Image size as WIDTHxHEIGHT (default: 1080x1920)",
    )
    parser.add_argument(
        "--source",
        choices=["picsum-seed", "picsum-id"],
        default="picsum-seed",
        help="Image URL mode (default: picsum-seed)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional RNG seed for reproducible output",
    )

    args = parser.parse_args()

    if args.count < 1:
        raise SystemExit("count must be >= 1")

    if args.seed is not None:
        random.seed(args.seed)

    width, height = args.size
    slides = generate_slides(args.count, width, height, args.source)
    payload = {"slides": slides}

    output_path = Path(args.output)
    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"{len(slides)} slides written to '{output_path}' ({width}x{height}, {args.source})")


if __name__ == "__main__":
    main()
