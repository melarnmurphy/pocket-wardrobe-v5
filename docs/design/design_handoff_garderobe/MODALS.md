# Modal inventory

Every dialog, sheet and toast the product needs, and which of them are drawn. Read with
`README.md` § *Interactions and behaviour*: a **sheet** edits one object, a **dialog** asks one
yes/no question, a **toast** reports a result and carries at most one action (usually `undo`).

Status column: **drawn** = it exists in the mockups at the id given · **missing** = a build agent
will invent it unless it is designed or specified first.

---

Wardrobe modals are now designed on both platforms: phone turn 18 (18a–18d) and web turn w6
(w6a–w6c). Everything still marked **missing** below is intake, trust and safety, account or auth.

## 1. Wardrobe — the piece itself

| modal | kind | status |
| --- | --- | --- |
| log a wear | sheet | drawn — phone 11a column |
| log a clean | sheet | drawn — phone 11a column |
| let this one go? | dialog | drawn — phone 11a column |
| delete the camel coat? | dialog | drawn — phone 5d |
| edit piece | sheet | drawn — phone 5c |
| wash cycle done? | dialog | drawn — phone 9a column |
| sold — remove it? | dialog | drawn — phone 9d column |
| you may already own this | dialog (compare) | drawn — phone 14b column |
| unsaved changes on edit piece | dialog | drawn — 18b, w6c |
| recut the photo | sheet | drawn — 18d, w6c |
| merge these two | dialog | drawn — 18a, w6c |
| add or edit a price | sheet · desktop panel | drawn — 18a, w6b |
| change fabric | picker sheet | drawn — 18d, w6b. Category and colour follow the same pattern |
| what happened to it — sold, given away, damaged, lost | sheet | drawn — 18a, w6c |
| remove or correct a logged wear | sheet | drawn — 18a, w6b |
| **retire / store for the season** | dialog | **missing** — the piece still counts in the totals |
| recently deleted / restore | sheet | drawn — 18b, w6c |

## 2. Wardrobe — the grid

| modal | kind | status |
| --- | --- | --- |
| filters | sheet | drawn — phone 1e (live prototype) |
| select mode — bulk actions | bar | drawn — 18c, w6a |
| delete N pieces | dialog | drawn — 18c, w6a |
| new collection | sheet | drawn — 18c. **Missing**: rename and delete a collection |
| piece is used elsewhere — refuse, offer archive | dialog | drawn — 18b, w6c |
| archived toast with undo | toast | drawn — 18b, w6c |
| sort | sheet | drawn — 18c (phone). Inline on desktop |

## 3. Getting pieces in

| modal | kind | status |
| --- | --- | --- |
| garderobe needs the camera | permission dialog | drawn — 7a column |
| shoot on a plain wall | tip dialog | drawn — 14a column |
| cutting out 12 pieces | progress dialog | drawn — 14a column |
| that's three garments | dialog | drawn — 14a column |
| no garments found | dialog | drawn — prototype |
| there's an image on your clipboard | dialog | drawn — 15c column |
| that one has a background | dialog | drawn — 15c column |
| couldn't read that tag | dialog | drawn — 8b column |
| reading the receipt / couldn't read two prices | dialog | drawn — 13b column |
| let us read your order emails | permission dialog | drawn — 10a column |
| **photo library permission** | permission dialog | **missing** — camera is drawn, the library is not, and batch add starts there |
| **notification permission** | permission dialog | **missing** — asked after the first wear log, per the settings copy |
| **upload failed / unsupported file** | dialog | **missing** — HEIC, size caps, a dead product URL |
| **this receipt matches three pieces** | sheet | **missing** — the resolver for an ambiguous price |
| **disconnect a resale account** | dialog | **missing** — what happens to pieces it imported |

## 4. Local threads

| modal | kind | status |
| --- | --- | --- |
| make an offer | sheet | drawn — 16b column |
| A$185 offered — counter / accept | dialog | drawn — 15d column |
| list the bias skirt / list the blazer | sheet | drawn — 15d, 9d columns |
| where you'll hand it over | sheet | drawn — 16d column |
| handed over? | dialog | drawn — 16d column |
| how far counts as local? | sheet | drawn — 16a column |
| **decline an offer / withdraw an offer** | dialog | **missing** |
| **cancel a listing with a live offer** | dialog | **missing** |
| **cancel or reschedule a handover** | sheet | **missing** |
| **they didn't show** | sheet | **missing** — the only trust signal the marketplace has |
| **report a listing / report a person** | sheet | **missing** — `blockUser` and `reportListing` are in the contract with no UI |
| **block — confirm** | dialog | **missing** — account shows `blocked · 1 person` with no way in or out |
| **first listing safety brief** | one-time dialog | **missing** — public places, no addresses, no money through the app |
| **age check** | dialog | **missing** — an under-18 position is required before launch |

## 5. Account, billing, data

| modal | kind | status |
| --- | --- | --- |
| use your location? | permission dialog | drawn — 12a column |
| you're in auckland — change region? | dialog | drawn — 12b column |
| where do the prices come from? | sheet | drawn — 15b column |
| **sign out** | dialog | **missing** |
| **delete my photos, keep the records** | dialog | **missing** — a row in w3e with no dialog behind it |
| **close the account** | dialog | **missing** — destructive, irreversible; type-to-confirm, and it must say what happens to live listings and open threads |
| **export started / export ready** | toast | **missing** |
| **paywall interrupt** | sheet | drawn as a screen (9h) — **missing** as the interrupt that fires from a plus-only action |
| **payment failed / subscription lapsed** | dialog | **missing** |

## 5b. Placeholder copy — not a modal, but do not ship it as written

| where | what is provisional |
| --- | --- |
| w7c pricing hero | "help you decide what to wear, keep and buy next" — wear planning, looks and cost per wear are all free in the drawn tiers, so this overclaims. The four plus features that ARE drawn: analytics, in-store scan, trend calls / packing / let-go list, availability. Rewrite when the paid scope is fixed |
| w3e plan card | says A$49; w7c and the phone paywall say A$69 a year. One is stale |

## 6. Auth (new — w5b, w5c, w5d)

| modal | kind | status |
| --- | --- | --- |
| **wrong password** | inline error | **missing** |
| **check your email** — reset sent | dialog | **missing** |
| **that email already has a wardrobe** | dialog | **missing** |
| **handle taken** | inline | drawn as the positive state only (`available`) |
| **signed in on another device** | dialog | **missing** |

---

## Standing rules for anything built from this list

1. **Destructive dialogs name the consequence, not the action.** `delete the camel coat?` then one
   line: what it removes from looks, listings and the numbers. Never *are you sure?*
2. **Nothing destructive resolves in a toast alone.** Toasts carry `undo` for 6 seconds; anything
   that cannot be undone gets a dialog first.
3. **A dialog asks one question.** If it needs two answers it is a sheet.
4. **Permission prompts explain the trade before the system sheet appears**, in one sentence, with
   a way to continue without granting it.
5. **Low confidence is a question, not a fact** — dashed chips, never a silent guess.
6. **Price is optional.** Every price modal offers *skip*; a null price never renders as A$0.
7. Sheets carry a 38 × 3px grab handle and 20px top corners; dialogs are 14px radius, centred,
   with 44px buttons. Both dim the page with `rgba(30,26,23,.45)`.
