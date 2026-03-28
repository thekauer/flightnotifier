# Spotting Image Metadata Plan

This note defines how we should save image metadata for the spotting dataset.

The goal is to keep:

- the exact source metadata from the upstream photo page
- our app-specific normalized aircraft mapping
- enough provenance to re-download, audit, deduplicate, and curate the dataset later

## Requirements

For every imported image, we want to preserve at least:

- original link of the picture
- exact aircraft type from the source page
- airline
- photo date
- upload date
- location / airport
- registration
- serial number if available
- photographer
- source page URL
- direct image URL used for download
- local file path(s)

We also want to save normalized app metadata:

- app aircraft family, for example `boeing-747`
- app display name, for example `Boeing 747`
- whether the image is approved for quiz use
- any curation notes, for example `side profile`, `cargo variant`, `night shot`, `too backlit`

## Recommended storage model

Use both:

1. A single canonical manifest file tracked in git
2. One sidecar JSON file per imported image

Why both:

- the manifest makes it easy to query and review the whole dataset
- sidecars keep metadata physically close to the asset
- if files are moved between folders, sidecars remain useful

## Proposed file layout

```text
public/assets/aircraft/
  boeing-747/
    001.jpg
    001.webp
    001.json
    002.jpg
    002.webp
    002.json
    ...

data/spotting/
  manifest.json
  import-log.json
```

## Canonical record shape

Each image should have one canonical metadata record.

Suggested schema:

```json
{
  "id": "boeing-747-001",
  "familyId": "boeing-747",
  "familyName": "Boeing 747",
  "source": {
    "provider": "jetphotos",
    "originalLink": "https://www.jetphotos.com/photo/12037249",
    "photoPageUrl": "https://www.jetphotos.com/photo/12037249",
    "imageUrl": "https://cdn.jetphotos.com/full/5/711130_1772919675.jpg",
    "photographer": "Youchiuan Wei",
    "licenseStatus": "unknown",
    "termsNote": "JetPhotos page says to contact photographer for terms of use."
  },
  "aircraft": {
    "exactType": "Boeing 747-467F(SCD)",
    "normalizedFamily": "Boeing 747",
    "registration": "LX-GCL",
    "serialNumber": "34150",
    "airline": "Cargolux Airlines International"
  },
  "photo": {
    "photoDate": "2025-03-07",
    "uploadedDate": "2025-03-16",
    "locationName": "Luxembourg Airport - ELLX",
    "locationCountry": "Luxembourg",
    "notes": null
  },
  "files": {
    "jpg": "/assets/aircraft/boeing-747/001.jpg",
    "webp": "/assets/aircraft/boeing-747/001.webp",
    "sidecar": "/assets/aircraft/boeing-747/001.json"
  },
  "image": {
    "width": 1280,
    "height": 872,
    "sha256": "optional-content-hash",
    "sizeBytes": 706832
  },
  "curation": {
    "approved": false,
    "qualityScore": null,
    "viewAngle": null,
    "containsObstructions": false,
    "isNightShot": false,
    "isCabinInterior": false,
    "variantConfidence": "high",
    "notes": ""
  },
  "importedAt": "2026-03-28T15:30:00.000Z"
}
```

## Exact vs normalized metadata

We should save both layers.

### Exact source metadata

This is what the upstream page says, untouched:

- `originalLink`
- `exactType`
- `registration`
- `serialNumber`
- `airline`
- `photoDate`
- `uploadedDate`
- `locationName`
- `locationCountry`
- `photographer`

### Normalized app metadata

This is what our app needs:

- `familyId`
- `familyName`
- `normalizedFamily`

This lets us:

- group `Boeing 747-436`, `Boeing 747-8I/F`, and `Boeing 747SP` under one family
- still keep the exact subtype for later filtering or display

## Sidecar JSON format

Each image sidecar should contain the same canonical record as the manifest entry.

Example:

- image: `public/assets/aircraft/boeing-747/001.jpg`
- sidecar: `public/assets/aircraft/boeing-747/001.json`

This makes manual review easy in the file tree.

## Manifest format

Use a top-level manifest file at:

- `data/spotting/manifest.json`

Suggested shape:

```json
{
  "version": 1,
  "provider": "jetphotos",
  "updatedAt": "2026-03-28T15:30:00.000Z",
  "images": [
    {
      "...": "same record as sidecar"
    }
  ]
}
```

## Import log

Keep a lightweight import log at:

- `data/spotting/import-log.json`

Use it to store:

- which search URL was used
- which selector value was used
- which photo pages were inspected
- whether a download succeeded or failed
- why an image was rejected

This is useful when refreshing or rebuilding the dataset.

## Metadata fields we should parse from JetPhotos

From the current JetPhotos page structure, we should try to capture:

- original picture link
- aircraft exact type
- registration
- serial number
- airline
- photo date
- uploaded date
- airport / location
- country / state if shown
- photographer
- notes
- photo page URL
- `og:image` URL

## Original link policy

The original picture link is required metadata.

For every image record, save:

- `source.originalLink`
  - the canonical public page for the photo, for example the JetPhotos photo page
- `source.imageUrl`
  - the exact direct image URL used for the download

Why both matter:

- `originalLink` tells us where the image came from in human-reviewable form
- `imageUrl` tells us exactly which binary asset we fetched

If only one of these is available, the image record should be treated as incomplete.

## Additional derived metadata we should compute

During import, also compute:

- image width / height
- byte size
- content hash, ideally `sha256`
- normalized family mapping
- whether the image is a likely good quiz candidate

## Curation flags

We should add a few review-oriented flags so the quiz can later prefer cleaner photos:

- `approved`
- `qualityScore`
- `viewAngle`
  - `side`
  - `front-quarter`
  - `rear-quarter`
  - `head-on`
  - `underside`
- `containsObstructions`
- `isNightShot`
- `isCabinInterior`
- `isCloseCrop`
- `isSpecialLivery`

This gives us a path toward selecting better quiz images later.

## Versioning

The manifest should include a schema version:

- `version: 1`

If we later change field names or add mandatory fields, we can migrate explicitly.

## Recommended next implementation steps

1. Create `data/spotting/manifest.json`
2. Create a small importer that:
   - downloads an image
   - extracts dimensions and hash
   - writes the image sidecar JSON
   - updates the manifest
3. Extend the importer to also write `001.webp`
4. Add a review script that lists:
   - missing metadata
   - duplicate registrations
   - duplicate hashes
   - images not yet approved

## Important note about rights

Even if the technical import works, we should keep:

- `licenseStatus`
- `termsNote`
- source page provenance

for every image.

That way we can later replace any images whose usage status is unclear without losing the dataset structure.
