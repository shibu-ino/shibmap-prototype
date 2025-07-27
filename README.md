# sibmap-prototype
Sibmap PWA test

# Sibmap - Prototype

This is the prototype version of Sibmap, a PWA (Progressive Web App) designed for displaying custom travel spots on a map using JSON data.

## Features

- Paste JSON-formatted spots and display them instantly on a map
- Supports multiple markers with images, tags, and descriptions
- Works offline (PWA)
- LocalStorage persistence
- Designed for iPhone and mobile use

## Usage

1. Open the app in a supported browser (preferably iPhone Safari or Chrome).
2. Paste your JSON data using the required format.
3. Click the “地図に表示” button to visualize the spots.

## JSON Format

Example:

```json
[
  {
    "title": "日光金谷ホテル",
    "coords": [36.7554, 139.5969],
    "image": "https://images.unsplash.com/photo-1584771569407-ccac0e6510d6?auto=format&fit=crop&w=800&q=80",
    "tags": ["AWA", "クラシックホテル"],
    "note": "明治の記憶が今も残る、日本最古の西洋式ホテル。",
    "link": "https://www.kanayahotel.co.jp/nkh/"
  }
]
```

## License

Licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Commercial use requires a separate license.