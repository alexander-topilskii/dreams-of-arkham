[2025-11-14 18:55][FIX] Урезал внешний отступ панели руки: уменьшил паддинги оверлея, панели и шапки.<br>
[2025-11-14 14:45][CHANGE] Уменьшил виджет карты руки: снизил ширину карточек, высоту вьюпорта и внутренние отступы.<br>
[2025-11-14 17:05][FIX] Убрал внешние отступы у карт руки и оставил единый зазор 4dp между элементами.<br>
[2025-11-14 16:45][CHANGE] Сделал setup-модули приложения принимать зависимости и проверять наличие DOM-панелей.<br>
[2025-11-14 10:05][CHANGE] Разделил CardHand на слои состояния, представления и DnD, сохранив публичный API виджета.<br>
[2025-11-14 09:40][CHANGE] Вынес инициализацию лэйаута, движка и debug панели в отдельные setup-модули.<br>
[2025-11-14 07:31][FIX] Карты атаки и уворота теперь срабатывают при сбросе на эффект культиста в той же локации, нанося урон нужному врагу.<br>
[2025-11-14 07:26][ADD FEATURE] Карточка персонажа подсвечивает активные эффекты врагов, сортирует их выше остальных и опускает индикатор урона вниз при потере здоровья.<br>
[2025-11-14 07:07][FIX] Карта врага показывает статус «Сражается с …» и аватар следопыта под строкой локации.<br>
[2025-11-14 07:01][ADD FEATURE] Карточка персонажа реагирует на потерю/восстановление здоровья тряской, вспышками и числовыми всплывающими индикаторами.<br>
[2025-11-14 06:46][ADD FEATURE] Карты лечения и боя реагируют на сброс на профиль персонажа и эффекты врагов, применяя эффект к соответствующей цели.<br>
[2025-11-13 21:10][CHANGE] Упростил оформление карт руки: минималистичный макет без иллюстраций и максимум места под текст.<br>
[2025-11-13 21:05][ADD FEATURE] Добавил карту «Атака», здоровье и урон культистам и награду уликой за их поражение.<br>
[2025-11-13 20:32][CHANGE] Переработан дизайн карт руки: стеклянный стиль, руна стоимости и акцент на тексте.<br>
[2025-11-13 18:30][CHANGE] Добавил мобильную раскладку панелей в один столбец для телефонов.<br>
[2025-11-13 17:47][FIX] Уточнил название активного эффекта боя, чтобы отображалось «Сражается с х врагами».<br>
[2025-11-13 17:38][ADD FEATURE] Добавлены столкновения с врагами, карты побега и лечения, а также урон за незавершённый бой.<br>
[2025-11-13 17:14][FIX] Территории карты открываются только после посещения игроком, отключено ручное переворачивание кликом.<br>
[2025-11-12 17:05][CHANGE] Сделал руку вертикальной в верхнем левом блоке, перенёс карту персонажа в middle-bottom и выровнял эффекты в правой колонке.<br>
[2025-11-12 16:30][CHANGE] Расширил карты руки, сделал панель адаптивной по высоте и уменьшил отступы и разделители для плотного UI.<br>
[2025-11-12 15:45][FIX] Увеличил высоту карточек в руке до фактического контента, чтобы описание эффекта и жетон стоимости снова были видны.<br>
[2025-11-12 15:10][CHANGE] Переработал отображение карт в руке: добавил 3D-стиль с артом, чипом стоимости и исправил битые ссылки на иллюстрации.<br>
[2025-11-12 13:36][CHANGE] Упростил виджет колоды событий: оставил только список активных карт, вынес счётчики в чипы и включил автоматический возврат сброса в стопку.<br>
[2025-11-12 13:30][ADD FEATURE] Колода событий поддерживает врагов: культист появляется в случайной локации, карта остаётся «в игре», пока жетон на карте, и сброс использует уникальные instanceId.<br>
[2025-11-12 12:53][FIX] Подвинул отображение персонажей на экспедиционной карте внутрь карточек территорий, чтобы иконки не обрезались краями.<br>
[2025-11-12 12:09][ADD FEATURE] Added deck/discard flow to CardHand with automatic refills and counters.<br>
[2025-11-12 12:45][CHANGE] Спрятал debug панель по умолчанию и добавил кнопку слева вверху для её показа и скрытия.<br>
[2025-11-12 11:30][FIX] Обеспечена автоматическая подгонка масштаба экспедиционной карты под маленькие экраны, чтобы области оставались видимыми.<br>
[2025-11-12 10:55][CHANGE] Вынес создание стартового состояния колоды в helper движка и обновил примеры на его использование.<br>
[2025-11-12 06:28][CHANGE] Перенастроена колода событий: UI публикует намерения, GameEngine обрабатывает команды и синхронизирует снапшоты.<br>
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
