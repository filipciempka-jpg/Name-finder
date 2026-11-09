NAME FINDER — wersja startowa PWA na iPhone

CO DZIAŁA
- Ciemny interfejs mobilny.
- Wybór Discord/Minecraft.
- Długość Discord: 2–16; Minecraft: 3–16.
- Generator nazw: litery albo litery + cyfry.
- Limit sprawdzeń (10–5000).
- Kolejka: najpierw historia dla wybranej platformy i długości, potem nowe nazwy.
- Liczniki na żywo: postęp, wolne, zajęte, niewiadomo, historia i nowe nazwy.
- Pauza, wznowienie i zakończenie.
- Historia, ulubione, filtry, kopiowanie i eksport CSV.
- Kopia danych JSON i zapis lokalny.
- PWA/offline shell.

WAŻNE O SPRAWDZANIU DOSTĘPNOŚCI
Ta wersja NIE zawiera jeszcze podłączonego, zweryfikowanego dostawcy sprawdzania nazw.
Bez skonfigurowanego endpointu każda próba otrzyma status „Niewiadomo”. To celowe:
nie pokazujemy fikcyjnych statusów jako prawdziwych.
W ustawieniach można podać własny, zaufany endpoint HTTPS obsługujący CORS.

Kontrakt endpointu:
POST /check
Content-Type: application/json
Body: {"username":"abc","platform":"discord"}

Odpowiedź pozytywna: {"available": true}
Odpowiedź negatywna: {"available": false}
Każda inna odpowiedź, timeout, błąd HTTP lub limit = Niewiadomo.

Nie należy używać endpointów, które obchodzą logowanie, CAPTCHA, limity lub zabezpieczenia serwisów.
Przed integracją konkretnego dostawcy sprawdź jego regulamin, aktualność danych i zasady rate limit.
Dostępność na zewnętrznej stronie może różnić się od możliwości faktycznego założenia konta.

URUCHOMIENIE
PWA wymaga HTTPS (albo localhost). Najprościej opublikować zawartość folderu na hostingu statycznym
obsługującym HTTPS, np. własnym hostingu lub repozytorium Pages.

INSTALACJA NA IPHONE
1. Otwórz opublikowany adres w Safari.
2. Wybierz Udostępnij.
3. Wybierz „Dodaj do ekranu początkowego”.
4. Zatwierdź. Aplikacja będzie dostępna z ikony.

UWAGI
- Dane są lokalne dla tej przeglądarki/urządzenia. Nie synchronizują się automatycznie.
- Przy bardzo dużych skanach Safari może wstrzymać działanie strony w tle.
- Historia i ulubione mogą zostać utracone po wyczyszczeniu danych witryny; używaj kopii JSON.
- Dla realnego statusu potrzebny jest dostawca dla każdej platformy. Nie ma jednego uniwersalnego publicznego API dla Discord i Minecraft.
