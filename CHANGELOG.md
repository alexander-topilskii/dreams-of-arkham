[2025-11-12 09:05][CHANGE] Decoupled GameEngineStore from map/event deck widgets via adapters, deck snapshots, and expanded view model state.<br>
[2025-11-12 07:30][ADD FEATURE] Routed debug map/event actions through GameEngine commands and facade to keep UI decoupled.<br>
[2025-11-12 06:45][ADD FEATURE] Routed victory/defeat progress through the engine with new commands and reactive game loop panel.<br>
[2025-11-12 05:15][CHANGE] Split GameEngine into headless GameEngineStore and pure GameEngineWidget, updated main wiring and documentation.<br>
[2025-11-12 04:37][ADD FEATURE] Added headless GameEngineStore with card events and rewired CardHand to sync via store hand state.<br>
[2025-02-14 12:00][CHANGE] Reworked GameEngine to emit events via commands and updated card hand controller integration.<br>
[2025-11-12 04:05][CHANGE] Перенёс отладочную панель в плавающий контейнер с перетаскиванием на базе draggabilly.<br>
[2025-11-11 20:05][ADD FEATURE] Добавлена кнопка «Закончить ход» в руке карт с обработкой через GameEngine: разыгрываются события по числу игроков, после чего очки действий восстанавливаются.<br>
[2025-11-11 19:40][FIX] Восстановлено отображение карт руки после очистки и повторного заполнения колоды.<br>
[2025-11-11 19:25][CHANGE] Сделал обработчики onChange опциональными в DebugPanel и обновил документацию виджета.<br>
[2025-11-11 19:07][CHANGE] Вынесена логика руки карт в CardHandController, обновлены main и отладочные кнопки для работы через контроллер.<br>
[2025-11-11 19:05][CHANGE] Вынесена панель отладки в класс DebugPanel и обновлён main для использования виджета и новых контролов.<br>
[2025-11-11 18:15][ADD FEATURE] Внедрён drag&drop для карт перемещения: золотая стрелка при перетаскивании, проверки GameEngine по действиям/смежности и журнальные подсказки вместо выбора карт.<br>
[2025-11-11 18:04][FIX] Added a matching top offset and overflow scrolling to the game engine widget for cramped layouts.<br>
[2025-11-11 18:20][FIX] Ensured the event deck widget scrolls internally when its content exceeds the available space.<br>
[2025-11-11 17:39][FIX] Realigned expedition map character tokens to the top-left and matched the text frame to the card bounds.<br>
[2025-11-11 15:20][ADD FEATURE] Replaced expedition map hexes with rectangular cards and portrait-ready tokens.<br>
[2025-11-11 17:45][ADD FEATURE] Added game engine widget with command dispatcher, initial map placement, and dual narrative/system logs.<br>
[2025-11-11 17:05][FIX] Raised expedition map character tokens above territory faces to keep them visible.<br>
[2025-11-11 14:25][ADD FEATURE] Added character tokens to the expedition map with placement API and debug control.<br>
[2025-11-11 14:02][FIX] Centered expedition map text within an invisible frame and synchronized arrows with zoomed hexes.<br>
[2025-11-11 16:15][CHANGE] Switched hand cards to cost/move schema, hid effects in UI, and generated unique instance IDs.<br>
[2025-11-11 14:55][ADD FEATURE] Added wheel zoom with control panel, evenly distributed auto layout, and responsive hex cards on the expedition map.<br>
[2025-11-11 13:31][CHANGE] Enabled automatic expedition map layout so territory positions are optional in data sources.<br>
[2025-11-11 13:45][ADD FEATURE] Persisted workspace panel splitter sizes in cookies to restore layout between visits.<br>
[2025-11-11 13:30][FIX] Normalized character portrait URLs to respect the configured base path so the image renders inside the widget.<br>
[2025-11-11 12:51][ADD FEATURE] Added investigator character card widget to the left panel.<br>
[2025-11-10 15:05][CHANGE] Removed SimpleCardHand widget and debug toggle to focus on the advanced CardHand interface.<br>
[2025-11-10 14:30][CHANGE] Moved debug control panel to the right bottom workspace quadrant for quicker access near event tools.<br>
[2025-11-10 13:55][ADD FEATURE] Introduced event deck widget with data-driven cards and debug controls for drawing and reshuffling.<br>
[2025-11-10 12:30][CHANGE] Relocated expedition map to middle top panel and card hand to middle bottom for revised layout flow.<br>
[2025-11-10 11:45][ADD FEATURE] Replaced CardHand with advanced interactive hand widget, expanded card data, and wired debug shortcut.<br>
[2025-11-10 10:02][ADD FEATURE] Introduced a resizable middle column and vertical split for the right panel to expand layout flexibility.<br>
[2025-11-10 09:12][CHANGE] Made CardHand the default overlay, centering cards on screen without the surrounding frame.<br>
[2025-11-10 08:03][ADD FEATURE] Added debug toggle between SimpleCardHand and CardHand with centered CardHand overlay.<br>
[2025-11-10 07:15][FIX] Normalized expedition map layout to keep connection arrows visible along the left screen edge.<br>
[2025-11-10 06:47][FIX] Corrected expedition map arrow projection so connectors originate and terminate on territory cards.<br>
[2025-11-10 06:23][FIX] Adjusted expedition map connection arrows to align with location card edges.<br>
[2025-11-09 18:45][FIX] Removed placeholder panel titles and aligned hand navigation arrows to integrate with card stack.<br>
[2025-11-09 18:05][FIX] Improved expedition map dragging behaviour and layered connections beneath territories.<br>
[2025-11-09 17:20][ADD FEATURE] Added interactive expedition map widget with draggable territories and debug tools.<br>
[2025-11-09 15:42][ADD FEATURE] Rebuilt SimpleCardHand into draggable bottom panel with paginated cards, images and responsive styling.<br>
[2025-11-09 14:09][CHANGE] Reorganized widgets into dedicated folders with documentation per component.<br>
[2025-02-14 12:00][CHANGE] Reworked GameEngine to emit events via commands and updated card hand controller integration.