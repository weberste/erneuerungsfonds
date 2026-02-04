
# Goal

Erstellen einer Visualisierung, wie sich der Erneuerungsfonds einer Schweizer Stockwerkeigentümergemeinschaft über die Jahre entwickelt. Dabei sollen die regelmässigen Einzahlungen, die grossen zu erwartenden Auszahlungen visuell dargestellt werden, um allfällige Deckungslücken einfach erkennen zu können.

Die Applikation ist eine reine Client-seitige Web-App (HTML/CSS/JS, kein Backend).

# Basisdaten

Folgende Fakten und Annahmen liegen den Berechnungen zu Grunde.

## Fakten

- Aktuelles Alter des Gebäudes (in Jahren)
- Aktueller Stand des Erneuerungsfonds (in CHF)

## Annahmen

Grundlage für die Berechnungen sind eine Reihe von Parametern:

- Gebäudeversicherungsschatzung der Liegenschaft (in CHF)
- Jährliche Einzahlungen in den Erneuerungsfonds (in % der Gebäudeversicherungsschatzung) aller Eigentümer
- Maximaler Betrag des Erneuerungsfonds (Plafonierung, in % der Gebäudeversicherungsschatzung)
- Bis zu 5 grosse, einmalige Ausgabenposten mit:
  - Name (z.B. "Dachsanierung")
  - Fälligkeit als Gebäudealter in Jahren (z.B. "nach 30 Jahren", basierend auf Lebensdauertabellen)
  - Erwartete Kosten, wahlweise in CHF oder in % der Gebäudeversicherungsschatzung
- Durchschnittliche Wertquote einer Wohnung (in Tausendstel, z.B. 243 von 10'000 = 2.43%)

## Vereinfachungen

- Keine Inflation / Teuerung: Alle Beträge sind nominal. Die Annahme ist, dass sich Teuerung und Zinserträge im aktuellen Tiefzinsumfeld in etwa aufheben.
- Keine Verzinsung des Fondsguthabens.
- Alle Ausgaben sind einmalig (keine wiederkehrenden Posten).

# Berechnungen

Die Simulation läuft jahresweise, beginnend beim aktuellen Gebäudealter, bis alle definierten Ausgaben abgewickelt sind.

## Jährliche Logik

Für jedes Simulationsjahr gilt:

1. **Jährliche Einzahlungen**: Die jährlichen Einzahlungen der Eigentümer werden dem Fonds gutgeschrieben, sofern der Fonds die Plafonierung noch nicht erreicht hat. Wird die Plafonierung innerhalb des Jahres erreicht, wird nur bis zum Plafond einbezahlt. Nach einer Ausgabe wird wieder regulär einbezahlt.

2. **Ausgaben**: Fällt in diesem Jahr eine Ausgabe an (Gebäudealter entspricht der definierten Fälligkeit), wird der Betrag dem Fonds belastet. Es können auch mehrere Ausgaben im selben Jahr anfallen.

3. **Deckungslücke / Ausserordentliche Einzahlung**: Der Fonds kann nicht negativ werden. Übersteigt die Summe der Ausgaben eines Jahres den Fondsstand, muss der Fehlbetrag von den Eigentümern als ausserordentliche Einzahlung zusätzlich zu den regulären Jahresbeiträgen getragen werden. Der Fonds steht danach auf CHF 0.

4. **Anteil pro Eigentümer**: Die ausserordentliche Einzahlung pro Eigentümer wird anhand der durchschnittlichen Wertquote berechnet (Fehlbetrag × Wertquote / 10'000).

# Visualisierung

Die Web-App zeigt zwei Darstellungen:

1. **Fondsstand über die Zeit** (Linienchart): Entwicklung des Fondsguthabens pro Jahr, mit gestrichelter Linie für die Plafonierung.
2. **Einzahlungen und Ausgaben pro Jahr** (Balkenchart): Jährliche Einzahlungen (grün, positiv), Ausgaben (rot, negativ) und ausserordentliche Einzahlungen (orange, positiv) als gestapelte Balken.

Bei Deckungslücken wird zusätzlich eine Tabelle **Ausserordentliche Einzahlungen** angezeigt mit Fehlbetrag und Anteil pro Eigentümer (basierend auf der durchschnittlichen Wertquote), inkl. Totalzeile.

# Bedienung

- Bei Eingabefeldern in % der GVS wird der berechnete CHF-Betrag live angezeigt.
- CHF-Beträge werden mit Tausendertrennzeichen (') formatiert. Die Kürzel k (Tausend) und m (Million) werden unterstützt.
- Die Simulation aktualisiert sich automatisch 2 Sekunden nach der letzten Parameteränderung.
