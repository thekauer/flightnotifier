# JetPhotos Aircraft Mapping

This note maps the app's current spotting/image aircraft families to the public JetPhotos aircraft selector on `https://www.jetphotos.com/search-main.php`.

## Key findings

- JetPhotos exposes the aircraft selector server-side in the page HTML. I extracted 274 aircraft options directly from the `<select name="aircraft">` markup.
- The selector usually includes:
  - a generic family entry, for example `Boeing 747`
  - several variant entries prefixed with `-`, for example `- Boeing 747-200`
- Some of our app families are broader than JetPhotos' selector entries, so they need a combined-query strategy.
- JetPhotos photo pages expose a usable full-size image URL in `og:image`.
- Important legal note: JetPhotos photo pages explicitly say `Contact photographer for terms of use.` That means JetPhotos is technically usable as a discovery/source-of-links layer, but it is not automatically a safe bulk asset source for app-shipped images without permission.

## Recommended strategy

1. Use the generic JetPhotos aircraft selector option when it exists and matches our app family.
2. Only fall back to sub-variants when a family needs more coverage or when we want to bias a dataset.
3. For grouped app families that JetPhotos splits apart, merge results from multiple selector entries:
   - `Airbus A320 Family` -> `Airbus A318`, `Airbus A319`, `Airbus A320`, `Airbus A321`
   - `Embraer E-Jet` -> `Embraer 170`, `Embraer 190`, plus keyword fallback for `E175` / `E195`
4. For families where JetPhotos does not expose all our sub-variants:
   - use the generic selector
   - optionally add keyword filtering by variant in a second pass
5. If we want a production-safe asset pipeline, the better long-term path is:
   - use JetPhotos for discovery and curation
   - source the final shipped assets from explicitly licensed or permission-granted images

## Query mechanics

JetPhotos' public search flow uses `showphotos.php` and supports direct aircraft filtering. A working public result URL pattern looks like:

```text
https://www.jetphotos.com/showphotos.php?aircraft=Boeing+747%3B&airline=all&country-location=all&photographer-group=all&category=all&keywords-type=all&keywords-contain=3&keywords=&photo-year=all&width=&height=&genre=all&search-type=Advanced&sort-order=0
```

For individual photo pages, the full-size image can be resolved from the page metadata:

- photo page example: `https://www.jetphotos.com/photo/12037249`
- full image example from `og:image`: `https://cdn.jetphotos.com/full/5/711130_1772919675.jpg`

## Mapping

This mapping focuses on the current spotting/image families used by the app.

| App family | App variants / meaning | JetPhotos generic selector | JetPhotos variant selectors | Recommended request strategy | Notes |
| --- | --- | --- | --- | --- | --- |
| `Boeing 747` | All 747 variants grouped | `Boeing 747` | `Boeing 747-1`, `Boeing 747-2`, `Boeing 747-3`, `Boeing 747-4`, `Boeing 747-8`, `Boeing 747SP`, `Boeing 747SR` | Use generic `Boeing 747` first | Good direct match for app family |
| `Boeing 777` | 777 family grouped | `Boeing 777` | `Boeing 777-2`, `Boeing 777-3` | Use generic `Boeing 777` | JetPhotos does not surface 77W / 77L / freighter as separate selector entries here |
| `Boeing 787` | 787 family grouped | `Boeing 787` | `Boeing 787-8`, `Boeing 787-9` | Use generic `Boeing 787` | No explicit `787-10` selector in the extracted list |
| `Airbus A330` | A330 family grouped | `Airbus A330` | `Airbus A330-2`, `Airbus A330-3` | Use generic `Airbus A330` | No explicit A330neo selector in the extracted list |
| `Airbus A340` | A340 family grouped | `Airbus A340` | `Airbus A340-2`, `Airbus A340-3`, `Airbus A340-5`, `Airbus A340-6` | Use generic `Airbus A340` | Good direct match |
| `Airbus A350` | A350 family grouped | `Airbus A350` | none exposed in extracted selector | Use generic `Airbus A350` | No `-900` / `-1000` split in selector |
| `Airbus A380` | A380 family grouped | `Airbus A380` | none exposed in extracted selector | Use generic `Airbus A380` | Good direct match |
| `Boeing 737` | All 737 variants grouped | `Boeing 737` | `Boeing 737-1` through `Boeing 737-9` | Use generic `Boeing 737` | Good direct match; MAX variants are not separately named in extracted selector |
| `Boeing 757` | 757 family grouped | `Boeing 757` | `Boeing 757-2`, `Boeing 757-3` | Use generic `Boeing 757` | Good direct match |
| `Boeing 767` | 767 family grouped | `Boeing 767` | `Boeing 767-2`, `Boeing 767-3`, `Boeing 767-4` | Use generic `Boeing 767` | Good direct match |
| `Airbus A320 Family` | A318/A319/A320/A321 grouped in app | no single family selector | `Airbus A318`, `Airbus A319`, `Airbus A320`, `Airbus A321`, plus `Airbus A320-1`, `Airbus A320-2` | Merge results from A318 + A319 + A320 + A321 | JetPhotos splits the family instead of exposing one umbrella selector |
| `Embraer E-Jet` | E170/E175/E190/E195 grouped in app | no exact umbrella for E-Jet | `Embraer 170`, `Embraer 170-1`, `Embraer 170-2`, `Embraer 190`, `Embraer 190-1`, `Embraer 190-2` | Merge `Embraer 170` and `Embraer 190`, then keyword-filter for `E175` / `E195` if needed | JetPhotos selector is incomplete for our grouped E-Jet family |
| `ATR 72` | ATR 72 grouped | `ATR 72` | none exposed in extracted selector | Use generic `ATR 72` | Good direct match |
| `Dash 8 / Q400` | Dash 8 family grouped in app | `Bombardier Dash 8` | `Bombardier Dash 8-1`, `Bombardier Dash 8-2`, `Bombardier Dash 8-3`, `Bombardier Dash 8-Q4` | Use generic `Bombardier Dash 8`; optionally bias with `Dash 8-Q400` | Good direct family match |
| `Bombardier CRJ` | CRJ family grouped | `Bombardier CRJ` | `Bombardier CRJ-1`, `Bombardier CRJ-2`, `Bombardier CRJ-7`, `Bombardier CRJ-705`, `Bombardier CRJ-9` | Use generic `Bombardier CRJ` | Good direct match; no explicit CRJ-1000 in selector |

## Notable non-quiz families already in our aircraft hierarchy

These are present in `lib/aircraftTypes.ts` but not part of the current spotting image asset set:

| App family | JetPhotos selector note |
| --- | --- |
| `McDonnell Douglas MD-11` | Direct match: `McDonnell Douglas MD-11` |
| `Antonov / AN-124` | Text entry exists as `Antonov AN-124`, but the static selector markup had an empty `value` attribute for some Antonov rows; this needs a live browser/form submission test before automation |
| `Ilyushin / IL-76` | Direct match: `Ilyushin IL-76` |

## Practical implementation approach

If we still want to technically build a JetPhotos-powered ingestion pipeline, the safest sequence is:

1. Build a family-to-selector map from the table above.
2. Generate one or more result URLs per family.
3. Parse result cards from `showphotos.php`.
4. Resolve chosen photo pages like `/photo/12037249`.
5. Read `og:image` from each photo page to obtain the full-size image URL.
6. Store source metadata alongside each asset:
   - JetPhotos photo page URL
   - CDN image URL
   - aircraft selector used
   - photographer
   - registration
7. Do not bulk-ship the assets unless usage rights are confirmed.

## Proof-of-concept sample

I verified the flow technically with a Boeing 747 sample:

- search URL:
  - `https://www.jetphotos.com/showphotos.php?aircraft=Boeing+747%3B&airline=all&country-location=all&photographer-group=all&category=all&keywords-type=all&keywords-contain=3&keywords=&photo-year=all&width=&height=&genre=all&search-type=Advanced&sort-order=0`
- first photo page found:
  - `https://www.jetphotos.com/photo/12037249`
- resolved image URL from `og:image`:
  - `https://cdn.jetphotos.com/full/5/711130_1772919675.jpg`

That proves the technical flow works for at least one family, but the licensing/permission question remains the main blocker for using JetPhotos as the final asset source.
