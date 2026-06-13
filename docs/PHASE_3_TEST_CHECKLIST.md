# BauZeit Pro – Phase 3 Test-Checkliste

## Anleitung
- Jeden Test in **PWA-Modus** (Browser) und **Android App** (Emulator/Gerät) durchführen
- ✅ = bestanden, ❌ = fehlgeschlagen, ⏭️ = übersprungen (nicht anwendbar)

---

## 1. App starten

| # | Test | PWA | Android |
|---|---|---|---|
| 1.1 | App lädt ohne Fehler | ☐ | ☐ |
| 1.2 | Login-Seite wird angezeigt | ☐ | ☐ |
| 1.3 | Keine Console-Errors beim Start | ☐ | ☐ |

## 2. Login

| # | Test | PWA | Android |
|---|---|---|---|
| 2.1 | Login mit gültigen Daten erfolgreich | ☐ | ☐ |
| 2.2 | Fehler bei falschen Daten | ☐ | ☐ |
| 2.3 | Employee wird auf Dashboard geleitet | ☐ | ☐ |
| 2.4 | Admin wird auf Admin-Dashboard geleitet | ☐ | ☐ |

## 3. Zeiterfassung

| # | Test | PWA | Android |
|---|---|---|---|
| 3.1 | Arbeit starten funktioniert | ☐ | ☐ |
| 3.2 | Timer läuft nach Start | ☐ | ☐ |
| 3.3 | Pause starten funktioniert | ☐ | ☐ |
| 3.4 | Pause beenden funktioniert | ☐ | ☐ |
| 3.5 | Arbeit beenden funktioniert | ☐ | ☐ |
| 3.6 | Bestätigungsdialog vor Arbeit beenden | ☐ | ☐ |

## 4. GPS

| # | Test | PWA | Android |
|---|---|---|---|
| 4.1 | GPS-Status wird im Dashboard angezeigt | ☐ | ☐ |
| 4.2 | GPS-Test in Einstellungen funktioniert | ☐ | ☐ |
| 4.3 | GPS abgelehnt → App funktioniert weiterhin | ☐ | ☐ |
| 4.4 | Geofence-Warnung erscheint (außerhalb Baustelle) | ☐ | ☐ |
| 4.5 | Arbeit startet trotz GPS-Warnung | ☐ | ☐ |

## 5. Benachrichtigungen

| # | Test | PWA | Android |
|---|---|---|---|
| 5.1 | Notification Permission wird abgefragt | ☐ | ☐ |
| 5.2 | Test-Notification in Einstellungen | ☐ | ☐ |
| 5.3 | Erinnerung erscheint nach Überstunden-Limit | ☐ | ☐ |
| 5.4 | Erinnerung wird wiederholt (15-Min-Intervall) | ☐ | ☐ |
| 5.5 | Erinnerungen stoppen nach Ausstempeln | ☐ | ☐ |

## 6. Vibration

| # | Test | PWA | Android |
|---|---|---|---|
| 6.1 | Vibration bei Arbeit starten | ☐ | ☐ |
| 6.2 | Vibration bei Pause | ☐ | ☐ |
| 6.3 | Vibrations-Test in Einstellungen | ☐ | ☐ |
| 6.4 | Keine Vibration wenn deaktiviert | ☐ | ☐ |

## 7. Offline

| # | Test | PWA | Android |
|---|---|---|---|
| 7.1 | Offline-Banner wird angezeigt (kein Internet) | ☐ | ☐ |
| 7.2 | Arbeit starten funktioniert offline | ☐ | ☐ |
| 7.3 | Arbeit beenden funktioniert offline | ☐ | ☐ |
| 7.4 | Sync startet automatisch bei Internetrückkehr | ☐ | ☐ |

## 8. Admin / Manager

| # | Test | PWA | Android |
|---|---|---|---|
| 8.1 | Admin sieht alle Einträge | ☐ | ☐ |
| 8.2 | Manager sieht nur eigene Baustellen | ☐ | ☐ |
| 8.3 | Genehmigen funktioniert | ☐ | ☐ |
| 8.4 | Ablehnen mit Pflicht-Kommentar | ☐ | ☐ |
| 8.5 | Korrektur mit Audit-Log | ☐ | ☐ |

## 9. Export

| # | Test | PWA | Android |
|---|---|---|---|
| 9.1 | PDF Export | ☐ | ☐ |
| 9.2 | CSV Export | ☐ | ☐ |
| 9.3 | Detailliertes PDF (Phase 2) | ☐ | ☐ |

## 10. Einstellungen / Diagnose

| # | Test | PWA | Android |
|---|---|---|---|
| 10.1 | App-Modus wird korrekt angezeigt | ☐ | ☐ |
| 10.2 | Feature-Support-Liste ist korrekt | ☐ | ☐ |
| 10.3 | GPS-Test zeigt Koordinaten | ☐ | ☐ |
| 10.4 | Notification-Test sendet Nachricht | ☐ | ☐ |
| 10.5 | Vibrations-Test vibriert | ☐ | ☐ |
| 10.6 | Berechtigungen anfragen funktioniert | ☐ | ☐ |

---

## Ergebnis

| Kategorie | Bestanden | Fehlgeschlagen | Übersprungen |
|---|---|---|---|
| App starten | / 3 | / 3 | / 3 |
| Login | / 4 | / 4 | / 4 |
| Zeiterfassung | / 6 | / 6 | / 6 |
| GPS | / 5 | / 5 | / 5 |
| Benachrichtigungen | / 5 | / 5 | / 5 |
| Vibration | / 4 | / 4 | / 4 |
| Offline | / 4 | / 4 | / 4 |
| Admin | / 5 | / 5 | / 5 |
| Export | / 3 | / 3 | / 3 |
| Einstellungen | / 6 | / 6 | / 6 |
| **GESAMT** | **/45** | **/45** | **/45** |

Getestet von: ________________  
Datum: ________________  
App-Version: v2.0.0 (Phase 3)
