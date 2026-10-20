# Nebenkosten Check

Tenants in Germany get a utility statement (Nebenkostenabrechnung) every year and often pay it unchecked: this checks it against the deadlines and the rules on what a landlord may pass on, and writes the letter to the landlord.

**Use it free:** https://hmsk.life/de/tools/nebenkosten-check/ (English: https://hmsk.life/tools/nebenkosten-check/)

## What it does

- Deadlines under § 556 Abs. 3 BGB: billing period of at most 12 months; statement received by the end of the 12th
  month after the period (otherwise no Nachzahlung); the tenant's own 12-month objection deadline, with an .ics reminder
  30 days before it ends.
- Each cost line against the Betriebskostenverordnung: flags items that are never Betriebskosten (Verwaltung,
  Instandhaltung/Reparaturen, Rücklagen, Bankgebühren, Leerstand, Rauchmelder-Miete, Notdienstpauschale, wrong
  insurances, Anschaffungen), cable TV after 30 June 2024, and "sonstige" costs that need a lease clause.
- Umlageschlüssel: recalculates your share from building total × your units / total units, finds a different floor
  area for the same flat, notes that a split by persons needs an agreement (§ 556a BGB).
- Heizkosten (HeizkostenV): consumption share 50 to 70 %, 15 % cut when not billed by consumption, 3 % cut when
  remote-read meters exist but no monthly information was sent.
- CO2 cost split (CO2KostAufG) for periods from 1 January 2023: ten-step model by kg CO2 per m² and year, 3 % cut
  when the split is missing.
- Optional comparison of each line with the Deutscher Mieterbund Betriebskostenspiegel (billing year 2024, published
  18 December 2025).
- A letter in German: Widerspruch with every point and its legal source plus a request for Belegeinsicht (§ 259 BGB),
  or only the Belegeinsicht. Editable, printable, save as PDF from the print dialog.
- German and English interface (`?lang=de|en`), entries saved only in the browser (localStorage), "Clear all" deletes them.

Every finding shows its legal source and the date the rules were checked (`AS_OF` in `public/logic.js`).

## Quick start

A static page with no build step and no dependencies.

```sh
python3 -m http.server 8080 --directory public   # then open http://localhost:8080
```

Or copy `public/` to any web server. Site links (tool page, imprint, email signup) point to `https://hmsk.life`;
change `siteBase` in `public/config.js` for your own copy. Open `#example` to load a sample statement.

## Tests

The rules, deadlines, letter and .ics generation live in `public/logic.js` (no DOM) and are tested with Node's
built-in test runner (Node 18+):

```sh
node --test tests/
```

Covered: date arithmetic (month ends, leap years), the statement and objection deadlines including the last day,
period length, every cost category, the allocation key check, floor-area consistency, the Betriebskostenspiegel
threshold, HeizkostenV cuts and the 50 to 70 % rule, every CO2 stage boundary, German/English number parsing, a full
sample statement, both letters and .ics validity.

## Legal basis (as of 19 October 2026)

- [§ 556 BGB](https://www.gesetze-im-internet.de/bgb/__556.html), [§ 556a BGB](https://www.gesetze-im-internet.de/bgb/__556a.html), [§ 259 BGB](https://www.gesetze-im-internet.de/bgb/__259.html)
- [Betriebskostenverordnung § 1, § 2](https://www.gesetze-im-internet.de/betrkv/)
- [Heizkostenverordnung §§ 2, 5 to 8, 12](https://www.gesetze-im-internet.de/heizkostenv/)
- [CO2KostAufG §§ 5 to 7, 11 and Anlage](https://www.gesetze-im-internet.de/co2kostaufg/)
- BGH VIII ZR 159/05 (31.05.2006, Leerstand), VIII ZR 62/19 (18.12.2019, Notdienstpauschale), VIII ZR 118/19 (09.12.2020, Belegeinsicht), VIII ZR 379/20 (11.05.2022, Rauchwarnmelder-Miete)
- [Deutscher Mieterbund, Betriebskostenspiegel, Abrechnungsjahr 2024](https://mieterbund.de/app/uploads/2025/12/20251218-3.pdf)

The objection deadline uses the safe reading (same day 12 months after receipt); some courts read it as the end of
that month.

Not legal advice. For larger amounts or a dispute, ask a Mieterverein or a tenancy lawyer.

## License

MIT, see [LICENSE](LICENSE). Fonts: Martian Mono and Geist (SIL Open Font License).
