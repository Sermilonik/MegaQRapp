class ScannerManager {
    constructor() {

        if (typeof AppState === 'undefined') {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: AppState не загружен!');
            showError('Ошибка инициализации: AppState не найден');
            return;
        }
        
        if (typeof appState === 'undefined') {
            console.log('🔄 Создаем новый экземпляр AppState...');
            window.appState = new AppState();
        }
        
        console.log('✅ AppState статус:', window.appState ? '✅ Загружен' : '❌ Не загружен');
        
        this.scanner = null;
        this.isScanning = false;
        this.selectedContractors = [];
        this.allContractors = [];
        this.pdfGenerator = null;
        this.notificationManager = new NotificationManager();
        this.cleaningUp = false;
        this.apkMode = false;
        this._stopInProgress = false;
        this._cleanupTimeout = null;
        
        // Сохраняем глобальную ссылку
        window.scannerManager = this;
        
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация ScannerManager');

        // ПРОВЕРЯЕМ APK РЕЖИМ В САМОМ НАЧАЛЕ
        this.optimizeForAPK();

        // Проверяем совместимость браузера
        const compatibility = this.checkBrowserCompatibility();
        
        if (!compatibility.compatible) {
            this.showBrowserCompatibilityWarning(compatibility);
        }
        
        this.loadContractors();
        this.attachEventListeners();
        this.checkExistingSession();
        
        // Только если браузер совместим - проверяем камеру
        if (compatibility.compatible) {
            setTimeout(async () => {
                const cameraAvailable = await this.restoreCameraState();
                if (!cameraAvailable) {
                    showWarning('📷 Камера требует перезагрузки страницы для работы', 5000);
                }
            }, 500);
        }
        
        showSuccess('Складской модуль готов к работе', 3000);
    }

    // ЗАГРУЗКА КОНТРАГЕНТОВ
    loadContractors() {
        console.log('🔍 Загрузка контрагентов...');
        
        try {
            // Пробуем загрузить из localStorage
            const savedContractors = localStorage.getItem('honest_sign_contractors');
            console.log('- Данные в localStorage:', savedContractors);
            
            if (savedContractors) {
                const parsed = JSON.parse(savedContractors);
                
                // ПРОВЕРЯЕМ ЧТО ЭТО МАССИВ И НЕ ПУСТОЙ
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.allContractors = parsed;
                    console.log('✅ Загружено контрагентов из хранилища:', this.allContractors.length);
                } else {
                    // Если данные есть, но они некорректные - загружаем стандартные
                    console.warn('⚠️ Данные в хранилище некорректные, загружаем стандартные');
                    this.loadDefaultContractors();
                    this.saveContractors();
                }
                
            } else {
                // Если в хранилище нет данных, загружаем стандартные
                console.warn('⚠️ Нет сохраненных контрагентов, загружаем стандартные');
                this.loadDefaultContractors();
                // Сохраняем стандартные в хранилище
                this.saveContractors();
            }
            
            console.log('- Итоговое количество контрагентов:', this.allContractors.length);
            this.initContractorSearch();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            // При любой ошибке загружаем стандартных и сохраняем
            this.loadDefaultContractors();
            this.saveContractors();
        }
    }

    // УПРАВЛЕНИЕ КОНТРАГЕНТАМИ
    showAddContractorForm() {
        console.log('➕ Показываем форму добавления контрагента');
        this.showContractorManager();
        
        setTimeout(() => {
            const addForm = document.getElementById('addContractorForm');
            const importForm = document.getElementById('importForm');
            
            if (addForm) {
                addForm.classList.remove('hidden');
                document.getElementById('contractorName').value = '';
                document.getElementById('contractorCategory').value = '';
                document.getElementById('contractorName').focus();
            }
            if (importForm) importForm.classList.add('hidden');
        }, 100);
    }

    // Показываем форму импорта
    showImportForm() {
        console.log('📥 Показываем форму импорта');
        this.showContractorManager();
        
        setTimeout(() => {
            const addForm = document.getElementById('addContractorForm');
            const importForm = document.getElementById('importForm');
            
            if (addForm) addForm.classList.add('hidden');
            if (importForm) {
                importForm.classList.remove('hidden');
                document.getElementById('importData').focus();
            }
        }, 100);
    }

    // управление модальными окнами
    showContractorManager() {
        console.log('👥 Показываем менеджер контрагентов');
        const modal = document.getElementById('contractorManager');
        if (modal) {
            modal.classList.remove('hidden');
            this.loadContractorsManagerList();
            // Блокируем прокрутку фона
            document.body.style.overflow = 'hidden';
        }
    }

    // прячем
    hideContractorManager() {
        const modal = document.getElementById('contractorManager');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
    
    // lдобавление контрагентов
    addContractor() {
        console.log('🎯 НАЧАЛО: Добавление нового контрагента');
        
        // ЗАЩИТА ОТ ОШИБОК appState
        if (typeof appState === 'undefined') {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: appState не определен');
            showError('Ошибка системы. Перезагрузите приложение.');
            return;
        }
    
        const nameInput = document.getElementById('contractorName');
        const categoryInput = document.getElementById('contractorCategory');
        
        console.log('- Поле имени:', nameInput);
        console.log('- Поле категории:', categoryInput);
        
        if (!nameInput || !categoryInput) {
            console.error('❌ Поля ввода не найдены в DOM');
            showError('Ошибка: поля ввода не найдены');
            return;
        }
        
        const name = nameInput.value.trim();
        const category = categoryInput.value.trim() || 'Общая категория';
        
        console.log('- Введенные данные:', { name, category });
        console.log('- Текущие контрагенты до добавления:', this.allContractors.length);
        
        if (!name) {
            showError('❌ Введите название контрагента');
            nameInput.focus();
            return;
        }
        
        // Проверяем дубликаты
        const exists = this.allContractors.some(c => 
            c.name.toLowerCase() === name.toLowerCase()
        );
        
        if (exists) {
            showError('❌ Контрагент с таким названием уже существует');
            nameInput.focus();
            return;
        }
        
        try {
            // Создаем нового контрагента
            const newId = this.allContractors.length > 0 
                ? Math.max(...this.allContractors.map(c => c.id)) + 1 
                : 1;
                
            const newContractor = {
                id: newId,
                name: name,
                category: category
            };
            
            console.log('- Создаем контрагента:', newContractor);
            
            // Добавляем в массив
            this.allContractors.push(newContractor);
            console.log('- Контрагентов после добавления:', this.allContractors.length);
            
            // Сохраняем в хранилище
            console.log('💾 Сохраняем контрагентов...');
            this.saveContractors();
            
            // Обновляем интерфейс
            console.log('🔄 Обновляем интерфейс...');
            this.hideAddContractorForm();
            this.loadContractorsManagerList();
            
            // Очищаем поля
            nameInput.value = '';
            categoryInput.value = '';
            
            showSuccess(`✅ Контрагент "${name}" успешно добавлен!`, 3000);
            console.log('🎉 КОНТРАГЕНТ УСПЕШНО ДОБАВЛЕН И СОХРАНЕН');
            
        } catch (error) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА при добавлении контрагента:', error);
            showError('Ошибка при добавлении контрагента: ' + error.message);
        }
    }

    importContractors() {
        console.log('📥 Импортируем контрагентов');
        
        const importData = document.getElementById('importData');
        const data = importData?.value.trim();
        
        if (!data) {
            showError('❌ Введите данные для импорта');
            return;
        }
        
        try {
            const lines = data.split('\n').filter(line => line.trim());
            let importedCount = 0;
            let errorCount = 0;
            
            lines.forEach((line, index) => {
                const parts = line.split(',').map(part => part.trim());
                
                if (parts.length >= 1 && parts[0]) {
                    const name = parts[0];
                    const category = parts[1] || 'Импортированные';
                    
                    // Проверяем дубликаты
                    const exists = this.allContractors.some(c => 
                        c.name.toLowerCase() === name.toLowerCase()
                    );
                    
                    if (!exists) {
                        const newId = Math.max(...this.allContractors.map(c => c.id), 0) + 1;
                        this.allContractors.push({
                            id: newId,
                            name: name,
                            category: category
                        });
                        importedCount++;
                    } else {
                        errorCount++;
                        console.log(`⚠️ Дубликат: ${name}`);
                    }
                } else {
                    errorCount++;
                }
            });
            
            if (importedCount > 0) {
                this.saveContractors();
                this.loadContractorsManagerList();
            }
            
            let message = `✅ Импортировано: ${importedCount} контрагентов`;
            if (errorCount > 0) {
                message += `, пропущено: ${errorCount}`;
            }
            
            showSuccess(message, 5000);
            this.hideImportForm();
            
        } catch (error) {
            console.error('❌ Ошибка импорта:', error);
            showError('Ошибка при импорте данных');
        }
    }

    // ФИЛЬТРАЦИЯ КОНТРАГЕНТОВ В МЕНЕДЖЕРЕ
    filterContractorsList() {
        const searchInput = document.getElementById('managerSearch');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        const container = document.getElementById('contractorsManagerList');
        if (!container) return;
        
        let filteredContractors = this.allContractors;
        
        if (query) {
            filteredContractors = this.allContractors.filter(contractor => 
                contractor.name.toLowerCase().includes(query) ||
                contractor.category.toLowerCase().includes(query)
            );
        }
        
        if (filteredContractors.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>Контрагенты не найдены</p>
                    <small>Попробуйте изменить запрос</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredContractors.map(contractor => `
            <div class="contractor-manager-item">
                <div class="contractor-info">
                    <div class="contractor-name">${contractor.name}</div>
                    <div class="contractor-category">${contractor.category}</div>
                </div>
                <div class="contractor-actions">
                    <button class="btn btn-sm btn-outline" data-action="selectContractorInManager" data-contractor-id="${contractor.id}">
                        ✅ Выбрать
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="deleteContractor" data-contractor-id="${contractor.id}">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }

    // СОЗДАНИЕ ТЕСТОВЫХ КОНТРАГЕНТОВ
    createTestContractors() {
        console.log('🧪 Создаем тестовых контрагентов...');
        
        // Очищаем существующих
        this.allContractors = [];
        
        // Создаем тестовых контрагентов
        const testContractors = [
            { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель' },
            { id: 2, name: 'ИП Иванов', category: 'Розничная сеть' },
            { id: 3, name: 'ООО "Луч"', category: 'Дилер' },
            { id: 4, name: 'АО "Вектор"', category: 'Партнер' }
        ];
        
        this.allContractors = testContractors;
        this.saveContractors();
        
        showSuccess('✅ Создано 4 тестовых контрагента', 3000);
        this.loadContractorsManagerList();
    }

    // ОБРАБОТЧИКИ УВЕДОМЛЕНИЙ
    showNotifications() {
        console.log('🔔 Показываем уведомления');
        const panel = document.getElementById('warehouseNotifications');
        if (panel) {
            panel.classList.remove('hidden');
        }
    }

    hideNotifications() {
        console.log('🔔 Скрываем уведомления');
        const panel = document.getElementById('warehouseNotifications');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    // ИСПРАВЛЕНИЕ ДУБЛИРУЮЩИХСЯ ID
    fixDuplicateIds() {
        let maxId = Math.max(...this.allContractors.map(c => c.id || 0), 0);
        
        this.allContractors.forEach((contractor, index) => {
            // Проверяем дубликаты ID
            const duplicateIndex = this.allContractors.findIndex((c, i) => 
                i !== index && c.id === contractor.id
            );
            
            if (duplicateIndex !== -1) {
                maxId++;
                contractor.id = maxId;
                console.log(`🔄 Исправлен дублирующийся ID: ${contractor.name} -> ${contractor.id}`);
            }
        });
        
        this.saveContractors();
    }

    loadDefaultContractors() {
        const defaultContractors = [
            { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель' },
            { id: 2, name: 'ИП Иванов', category: 'Розничная сеть' },
            { id: 3, name: 'ООО "Луч"', category: 'Дилер' },
            { id: 4, name: 'АО "Вектор"', category: 'Партнер' },
            { id: 5, name: 'ООО "Луч Саяны"', category: 'Дилер' }
        ];
        
        this.allContractors = defaultContractors;
        console.log('✅ Загружены стандартные контрагенты');
    }

    // ЗАГРУЗКА СПИСКА ДЛЯ МЕНЕДЖЕРА
    loadContractorsManagerList() {
        const container = document.getElementById('contractorsManagerList');
        if (!container) return;
        
        if (this.allContractors.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">👥</span>
                    <p>Нет контрагентов</p>
                    <small>Добавьте контрагентов вручную или импортируйте из CSV</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.allContractors.map(contractor => `
            <div class="contractor-manager-item">
                <div class="contractor-info">
                    <div class="contractor-name">${contractor.name}</div>
                    <div class="contractor-category">${contractor.category}</div>
                </div>
                <div class="contractor-actions">
                    <button class="btn btn-sm btn-outline" onclick="scannerManager.selectContractorInManager(${contractor.id})">
                        ✅ Выбрать
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="scannerManager.deleteContractor(${contractor.id})">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    hideAddContractorForm() {
        const addForm = document.getElementById('addContractorForm');
        if (addForm) addForm.classList.add('hidden');
    }

    hideImportForm() {
        const importForm = document.getElementById('importForm');
        if (importForm) importForm.classList.add('hidden');
    }

    selectContractorInManager(contractorId) {
        this.toggleContractor(contractorId);
        this.hideContractorManager();
    }

    deleteContractor(contractorId) {
        if (confirm('Удалить этого контрагента?')) {
            this.allContractors = this.allContractors.filter(c => c.id !== contractorId);
            this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
            this.saveContractors();
            this.updateSelectedContractorsUI();
            this.loadContractorsManagerList();
            showWarning('🗑️ Контрагент удален', 3000);
        }
    }

    // ЭКСПОРТ КОНТРАГЕНТОВ
    exportContractors() {
        const csvContent = this.allContractors.map(c => 
            `"${c.name}","${c.category}"`
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'контрагенты.csv';
        a.click();
        URL.revokeObjectURL(url);
        
        showSuccess('📤 Контрагенты экспортированы в CSV', 3000);
    }

    // ИНИЦИАЛИЗАЦИЯ ПОИСКА КОНТРАГЕНТОВ
    initContractorSearch() {
        const searchInput = document.getElementById('contractorSearch');
        const dropdown = document.getElementById('contractorDropdown');
        
        if (!searchInput || !dropdown) {
            console.error('❌ Элементы поиска не найдены');
            return;
        }

        console.log('🔍 Инициализация поиска контрагентов');

        // ПОИСК ПРИ ВВОДЕ
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.trim();
                console.log('🔍 Поиск:', query);
                this.filterContractors(query);
            }, 300);
        });

        // ПОКАЗ СПИСКА ПРИ ФОКУСЕ
        searchInput.addEventListener('focus', () => {
            console.log('📱 Поле ввода получило фокус');
            const query = searchInput.value.trim();
            this.filterContractors(query || '');
            this.showDropdown();
        });

        // СКРЫТИЕ ПРИ КЛИКЕ ВНЕ
        document.addEventListener('click', (e) => {
            const isSearchInput = e.target === searchInput;
            const isInDropdown = dropdown.contains(e.target);
            const isDropdownItem = e.target.closest('.dropdown-item');
            
            if (!isSearchInput && !isInDropdown && !isDropdownItem) {
                this.hideDropdown();
            }
        });

        // СКРЫТИЕ ПРИ SCROLL
        window.addEventListener('scroll', () => {
            if (!dropdown.classList.contains('hidden')) {
                this.hideDropdown();
            }
        });

        console.log('✅ Поиск контрагентов инициализирован');
    }

    // ФИЛЬТРАЦИЯ КОНТРАГЕНТОВ
    filterContractors(query = '') {
        const dropdown = document.getElementById('contractorDropdown');
        if (!dropdown) return;

        console.log('🔍 Фильтрация контрагентов по запросу:', query);

        let filteredContractors = this.allContractors;
        
        if (query) {
            const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
            filteredContractors = this.allContractors.filter(contractor => {
                const searchText = (contractor.name + ' ' + contractor.category).toLowerCase();
                return searchTerms.some(term => searchText.includes(term));
            });
        }

        console.log('📊 Найдено контрагентов:', filteredContractors.length);

        // ОГРАНИЧИВАЕМ ДЛЯ УДОБСТВА
        filteredContractors = filteredContractors.slice(0, 10);

        // ОТОБРАЖАЕМ РЕЗУЛЬТАТЫ
        if (filteredContractors.length === 0) {
            dropdown.innerHTML = `
                <div class="dropdown-item no-results">
                    <div>🔍 Контрагенты не найдены</div>
                    <small>Попробуйте изменить запрос</small>
                </div>
            `;
        } else {
            dropdown.innerHTML = filteredContractors.map(contractor => {
                const isSelected = this.selectedContractors.some(c => c.id === contractor.id);
                
                return `
                    <div class="dropdown-item ${isSelected ? 'selected' : ''}" 
                        data-contractor-id="${contractor.id}"
                        onclick="window.scannerManager.handleContractorSelection(${contractor.id})">
                        <div class="contractor-info">
                            <div class="contractor-name">${contractor.name}</div>
                            <div class="contractor-category">${contractor.category}</div>
                        </div>
                        ${isSelected ? '<div class="selected-badge">✓ Выбран</div>' : ''}
                    </div>
                `;
            }).join('');
        }
        
        // ПОКАЗЫВАЕМ СПИСОК ЕСЛИ ЕСТЬ РЕЗУЛЬТАТЫ
        if (filteredContractors.length > 0) {
            this.showDropdown();
        }
    }

    // ОБРАБОТКА ВЫБОРА КОНТРАГЕНТА
    handleContractorSelection(contractorId) {
        console.log('🎯 Выбран контрагент ID:', contractorId);
        
        this.toggleContractor(contractorId);
        
        // ОЧИЩАЕМ ПОИСК И СКРЫВАЕМ СПИСОК
        const searchInput = document.getElementById('contractorSearch');
        if (searchInput) searchInput.value = '';
        this.hideDropdown();
    }

    // ДОБАВЛЕНИЕ/УДАЛЕНИЕ КОНТРАГЕНТА
    toggleContractor(contractorId) {
        console.log('🔄 Переключение контрагента:', contractorId);
    
        const contractor = this.allContractors.find(c => c.id === contractorId);
        if (!contractor) {
            console.error('❌ Контрагент не найден:', contractorId);
            showError('Контрагент не найден');
            return;
        }
    
        const isSelected = this.selectedContractors.some(c => c.id === contractorId);
        
        if (isSelected) {
            // УДАЛЯЕМ
            this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
            console.log('🗑️ Удален контрагент:', contractor.name);
            showWarning(`Удален: ${contractor.name}`, 2000);
        } else {
            // ДОБАВЛЯЕМ
            this.selectedContractors.push(contractor);
            console.log('✅ Добавлен контрагент:', contractor.name);
            showSuccess(`Добавлен: ${contractor.name}`, 2000);
        }
    
        console.log('📋 Новый список выбранных:', this.selectedContractors.map(c => c.name));
        
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.updateSessionStatus();
        
        // СОХРАНЯЕМ В ХРАНИЛИЩЕ
        this.saveSelectedContractors();
    }

    // УДАЛЕНИЕ КОНКРЕТНОГО КОНТРАГЕНТА
    removeContractor(contractorId) {
        console.log('🗑️ Удаление контрагента:', contractorId);
        this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.updateSessionStatus();
        this.saveSelectedContractors();
    }

    // ОЧИСТКА ВСЕХ КОНТРАГЕНТОВ
    clearContractors() {
        console.log('🧹 Очистка всех контрагентов');
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.updateSessionStatus();
        this.saveSelectedContractors();
        this.hideDropdown();
    }

    // СОХРАНЕНИЕ ВЫБРАННЫХ КОНТРАГЕНТОВ
    saveSelectedContractors() {
        try {
            const data = {
                contractorIds: this.selectedContractors.map(c => c.id),
                timestamp: new Date().toISOString(),
                contractorNames: this.selectedContractors.map(c => c.name) // для отладки
            };
            
            console.log('💾 Сохранение выбранных контрагентов:', data);
            localStorage.setItem('honest_sign_selected_contractors', JSON.stringify(data));
            
            // ОБНОВЛЯЕМ СЕССИЮ
            if (this.selectedContractors.length > 0) {
                appState.startNewSession(this.selectedContractors.map(c => c.id));
            }
            
        } catch (error) {
            console.error('❌ Ошибка сохранения выбранных контрагентов:', error);
        }
    }

    // ПОКАЗ/СКРЫТИЕ ВЫПАДАЮЩЕГО СПИСКА
    showDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
        }
    }

    hideDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    debugContractors() {
        console.log('🐛 ОТЛАДКА КОНТРАГЕНТОВ:');
        console.log('- allContractors:', this.allContractors);
        console.log('- selectedContractors:', this.selectedContractors);
        console.log('- localStorage contractors:', localStorage.getItem('honest_sign_contractors'));
        console.log('- localStorage selected:', localStorage.getItem('honest_sign_selected_contractors'));
        
        // Показываем информацию в интерфейсе
        showInfo(`
            Всего контрагентов: ${this.allContractors.length}
            Выбрано: ${this.selectedContractors.length}
            В хранилище: ${localStorage.getItem('honest_sign_contractors') ? 'есть' : 'нет'}
        `, 5000);
    }

    // ОБНОВЛЕНИЕ СТАТУСА СЕССИИ
    updateSessionStatus() {
        const session = appState.getCurrentSession();
        const statusCard = document.getElementById('sessionStatus');
        
        if (this.selectedContractors.length === 0) {
            statusCard.classList.add('hidden');
            return;
        }
        
        statusCard.classList.remove('hidden');
        document.getElementById('currentContractor').textContent = 
            this.selectedContractors.map(c => c.name).join(', ');
        document.getElementById('codesCount').textContent = session.scannedCodes.length;
        document.getElementById('sessionId').textContent = session.id;
    }

    // ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПОК
    updateButtonStates() {
        const hasContractors = this.selectedContractors.length > 0;
        const hasCodes = appState.getCurrentSession().scannedCodes.length > 0;
        
        document.getElementById('startCamera').disabled = !hasContractors;
        document.getElementById('generateReport').disabled = !hasContractors || !hasCodes;
        
        console.log('🔄 Состояние кнопок обновлено:', { hasContractors, hasCodes });
    }

    // УЛУЧШЕННЫЙ ЗАПУСК КАМЕРЫ ДЛЯ CHROME ANDROID
    async startCamera() {
        console.log('📷 Запускаем улучшенную камеру...');
        
        if (this.isScanning) {
            console.log('⚠️ Камера уже запущена');
            return;
        }
    
        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }
    
        try {
            // ПРОВЕРЯЕМ БРАУЗЕР
            const isChromeAndroid = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent);
            console.log('🌐 Браузер:', navigator.userAgent);
            console.log('📱 Chrome на Android:', isChromeAndroid);
    
            // ПРОВЕРЯЕМ ДОСТУПНОСТЬ БИБЛИОТЕКИ
            if (typeof Html5Qrcode === 'undefined') {
                await loadHtml5QrCode();
            }
    
            // Останавливаем предыдущую камеру
            await this.stopCamera();
    
            const container = document.getElementById('reader');
            if (!container) {
                throw new Error('Контейнер для камеры не найден');
            }
    
            // ОЧИЩАЕМ КОНТЕЙНЕР
            container.innerHTML = '';
            
            this.scanner = new Html5Qrcode("reader");
            
            // УЛУЧШЕННАЯ КОНФИГУРАЦИЯ ДЛЯ ЛУЧШЕГО СКАНИРОВАНИЯ
            const config = {
                fps: 15, // Увеличили FPS для плавности
                qrbox: { width: 300, height: 300 }, // Увеличили область сканирования
                aspectRatio: 1.0,
                supportedScanTypes: [
                    Html5QrcodeScanType.SCAN_TYPE_QR_CODE,
                    Html5QrcodeScanType.SCAN_TYPE_DATAMATRIX // Добавили поддержку DataMatrix
                ],
                // УЛУЧШЕННЫЕ НАСТРОЙКИ ВИДЕО
                videoConstraints: {
                    width: { ideal: 1920, min: 1280 }, // Высокое разрешение для четкости
                    height: { ideal: 1080, min: 720 },
                    facingMode: "environment",
                    frameRate: { ideal: 30, min: 15 } // Плавный фреймрейт
                }
            };
    
            console.log('🎯 Начинаем запуск улучшенной камеры...');
    
            let cameraStarted = false;
            let lastError = null;
    
            // РАСШИРЕННЫЙ СПИСОК СТРАТЕГИЙ ДЛЯ ЛУЧШЕГО СКАНИРОВАНИЯ
            const cameraConfigs = [
                // Основные стратегии
                { facingMode: "environment", description: "Задняя камера (основная)" },
                { facingMode: "user", description: "Передняя камера" },
                
                // С разными настройками качества
                { 
                    facingMode: "environment", 
                    description: "Задняя камера (высокое качество)",
                    advanced: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    }
                },
                { 
                    facingMode: "environment",
                    description: "Задняя камера (баланс)",
                    advanced: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }, 
                        frameRate: { ideal: 25 }
                    }
                }
            ];
    
            // ДОБАВЛЯЕМ КОНКРЕТНЫЕ КАМЕРЫ ИЗ УСТРОЙСТВА
            if (isChromeAndroid) {
                try {
                    const devices = await Html5Qrcode.getCameras();
                    console.log('📸 Доступные камеры:', devices);
                    
                    devices.forEach(device => {
                        cameraConfigs.push({
                            deviceId: device.id,
                            description: `Камера: ${device.label || device.id}`
                        });
                    });
                } catch (error) {
                    console.log('⚠️ Не удалось получить список камер:', error);
                }
            }
    
            // ПРОБУЕМ ВСЕ ВАРИАНТЫ С УЛУЧШЕННОЙ ОБРАБОТКОЙ
            for (let i = 0; i < cameraConfigs.length; i++) {
                const cameraConfig = cameraConfigs[i];
                console.log(`🔄 Попытка ${i + 1}: ${cameraConfig.description}`);
                
                try {
                    let scanConfig = { ...config };
                    
                    // Добавляем расширенные настройки если есть
                    if (cameraConfig.advanced) {
                        scanConfig.videoConstraints = { 
                            ...scanConfig.videoConstraints,
                            ...cameraConfig.advanced
                        };
                    }
    
                    // УЛУЧШЕННЫЙ ОБРАБОТЧИК СКАНИРОВАНИЯ
                    const onScanSuccess = (decodedText, decodedResult) => {
                        console.log('✅ QR-код распознан:', decodedText);
                        console.log('📊 Детали сканирования:', decodedResult);
                        
                        // ДОБАВЛЯЕМ ПРОВЕРКУ КАЧЕСТВА СКАНИРОВАНИЯ
                        if (this.isValidQRCode(decodedText)) {
                            this.onScanSuccess(decodedText);
                        } else {
                            console.log('⚠️ Сомнительный QR-код, пропускаем...');
                        }
                    };
    
                    const onScanFailure = (error) => {
                        // УМЕНЬШАЕМ ЛОГИРОВАНИЕ ОШИБОК СКАНИРОВАНИЯ
                        if (!error.includes('NotFoundException')) {
                            console.log('📷 Ошибка сканирования:', error);
                        }
                    };
    
                    if (cameraConfig.deviceId) {
                        await this.scanner.start(
                            cameraConfig.deviceId,
                            scanConfig,
                            onScanSuccess,
                            onScanFailure
                        );
                    } else {
                        await this.scanner.start(
                            { facingMode: cameraConfig.facingMode },
                            scanConfig, 
                            onScanSuccess,
                            onScanFailure
                        );
                    }
                    
                    cameraStarted = true;
                    console.log(`✅ Успех: ${cameraConfig.description}`);
                    
                    // ПОКАЗЫВАЕМ ПОДСКАЗКИ ДЛЯ ЛУЧШЕГО СКАНИРОВАНИЯ
                    this.showScanningTips();
                    break;
                    
                } catch (error) {
                    lastError = error;
                    console.log(`❌ Не удалось: ${cameraConfig.description}`, error.message);
                    
                    // ОСТАНАВЛИВАЕМ ПРЕДЫДУЩУЮ ПОПЫТКУ
                    if (this.scanner) {
                        try {
                            await this.scanner.stop();
                        } catch (e) {
                            // Игнорируем ошибки остановки
                        }
                    }
                    
                    // УВЕЛИЧИВАЕМ ПАУЗУ МЕЖДУ ПОПЫТКАМИ
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
    
            if (cameraStarted) {
                this.isScanning = true;
                
                // ОБНОВЛЯЕМ ИНТЕРФЕЙС
                document.getElementById('startCamera').classList.add('hidden');
                document.getElementById('stopCamera').classList.remove('hidden');
                
                // СКРЫВАЕМ ПЛЕЙСХОЛДЕР
                this.hideScannerPlaceholder();
                
                console.log('🎉 Улучшенная камера успешно запущена!');
                showSuccess('📷 Камера запущена! Наведите на QR-код при хорошем освещении', 4000);
                
            } else {
                throw lastError || new Error('Не удалось запустить ни одну камеру');
            }
    
        } catch (error) {
            console.error('❌ Финальная ошибка запуска камеры:', error);
            
            let message = this.getCameraErrorMessage(error);
            showError(message);
            
            this.showSimulator();
        }
    }

    // ОПТИМИЗАЦИЯ ДЛЯ APK
    optimizeForAPK() {
        console.log('📱 Оптимизация для APK приложения');
        
        // Определяем, что мы в APK
        const isInAPK = !window.location.protocol.startsWith('http');
        const isWebView = /WebView|Android/.test(navigator.userAgent);
        
        if (isInAPK || isWebView) {
            console.log('🎯 Запущено в APK/WebView, применяем оптимизации');
            
            // Улучшаем стабильность камеры
            this.apkMode = true;
            
            // Добавляем APK-специфичные улучшения
            this.addAPKEnhancements();
        }
    }

    addAPKEnhancements() {
        // Улучшенный обработчик для APK
        document.addEventListener('pause', () => {
            console.log('📱 APK: Приложение ушло в фон');
            this.stopCamera();
        });

        // APK-СПЕЦИФИЧНЫЕ УЛУЧШЕНИЯ
        document.addEventListener('deviceready', function() {
            console.log('📱 Cordova/APK устройство готово');
            if (window.scannerManager) {
                scannerManager.apkMode = true;
                showSuccess('📱 APK режим активирован', 3000);
            }
        }, false);

        // Обнаружение APK окружения
        if (window.cordova || window.Capacitor) {
            console.log('🎯 Обнаружена APK платформа');
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(() => {
                    if (window.scannerManager) {
                        scannerManager.apkMode = true;
                        scannerManager.addAPKEnhancements();
                    }
                }, 1000);
            });
        }
        
        document.addEventListener('resume', () => {
            console.log('📱 APK: Приложение вернулось');
            setTimeout(() => {
                if (this.selectedContractors.length > 0) {
                    this.startCamera();
                }
            }, 1000);
        });
        
        // Улучшаем обработку касаний для WebView
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    // УЛУЧШЕННЫЙ ЗАПУСК КАМЕРЫ ДЛЯ APK
    async startCameraAPK() {
        console.log('📱 Запуск камеры в APK режиме');
        
        try {
            // Останавливаем предыдущую камеру
            await this.stopCamera();
            
            // Даем время на очистку
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const config = {
                fps: 15,
                qrbox: { width: 280, height: 280 },
                aspectRatio: 1.0,
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_QR_CODE],
                videoConstraints: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "environment",
                    frameRate: { ideal: 30 }
                }
            };
            
            this.scanner = new Html5Qrcode("reader");
            
            // Пробуем разные стратегии запуска для APK
            const cameraStrategies = [
                { facingMode: "environment" },
                { facingMode: "user" },
                { exact: "environment" }
            ];
            
            for (let strategy of cameraStrategies) {
                try {
                    console.log(`🔄 APK: Пробуем стратегию ${JSON.stringify(strategy)}`);
                    
                    await this.scanner.start(
                        strategy,
                        config,
                        (decodedText) => {
                            console.log('✅ APK: QR-код распознан:', decodedText);
                            this.onScanSuccess(decodedText);
                        },
                        (error) => {
                            // Игнорируем ошибки сканирования, но логируем
                            if (!error.includes('No QR code found')) {
                                console.log('📱 APK: Ошибка сканирования:', error);
                            }
                        }
                    );
                    
                    // Если дошли сюда - камера запущена
                    this.isScanning = true;
                    this.showCameraUI();
                    console.log('🎉 APK: Камера успешно запущена!');
                    showSuccess('📷 Камера запущена в APK режиме', 2000);
                    return;
                    
                } catch (error) {
                    console.log(`❌ APK: Стратегия не сработала:`, error.message);
                    if (this.scanner) {
                        await this.scanner.stop();
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            throw new Error('Все стратегии запуска не сработали');
            
        } catch (error) {
            console.error('❌ APK: Критическая ошибка камеры:', error);
            this.showAPKCameraError(error);
        }
    }

    showCameraUI() {
        document.getElementById('startCamera').classList.add('hidden');
        document.getElementById('stopCamera').classList.remove('hidden');
        this.hideScannerPlaceholder();
    }

    showAPKCameraError(error) {
        let message = '📷 Ошибка камеры в APK\n\n';
        
        if (error.message.includes('NotAllowedError')) {
            message += 'Разрешите доступ к камере в настройках Android:\n';
            message += 'Настройки → Приложения → Ваше приложение → Разрешения → Камера';
        } else if (error.message.includes('NotFoundError')) {
            message += 'Камера не найдена. Убедитесь, что устройство имеет камеру';
        } else {
            message += `Ошибка: ${error.message}`;
        }
        
        showError(message, 6000);
        this.showSimulator();
    }

    // СКРЫТИЕ ПЛЕЙСХОЛДЕРА
    hideScannerPlaceholder() {
        const overlay = document.querySelector('.scanner-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // ПОКАЗ ПЛЕЙСХОЛДЕРА
    showScannerPlaceholder() {
        const overlay = document.querySelector('.scanner-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    // ПОЛУЧЕНИЕ ЧЕЛОВЕКО-ЧИТАЕМОГО СООБЩЕНИЯ ОБ ОШИБКЕ
    getCameraErrorMessage(error) {
        if (error.message.includes('NotAllowedError')) {
            return `📷 Доступ к камере запрещен

Для разрешения доступа:
1. Нажмите на значок 🔒 в адресной строке
2. Выберите "Разрешить доступ к камере" 
3. Перезагрузите страницу

Или в настройках Chrome:
• Настройки → Конфиденциальность → Настройки сайта → Камера
• Разрешите доступ для этого сайта`;
                        
        } else if (error.message.includes('NotFoundError')) {
            return '📷 Камера не найдена на устройстве';
            
        } else if (error.message.includes('NotSupportedError')) {
            return '📷 Ваш браузер не поддерживает сканирование QR-кодов';
            
        } else if (error.message.includes('NotReadableError')) {
            return `📷 Камера занята другим приложением

Закройте другие приложения, использующие камеру:
• Другие браузеры
• Приложения камеры
• Видео-приложения`;
                        
        } else if (error.message.includes('OverconstrainedError')) {
            return '📷 Запрошенные настройки камеры не поддерживаются';
            
        } else {
            return `📷 Ошибка камеры: ${error.message}`;
        }
    }

    async stopCamera() {
        if (this._stopInProgress) {
            console.log('⚠️ Остановка камеры уже выполняется...');
            return;
        }
        
        if (this._cleanupTimeout) {
            clearTimeout(this._cleanupTimeout);
            this._cleanupTimeout = null;
        }

        console.log('🧹 Начинаем полную очистку камеры...');
        
        // ФЛАГ ОЧИСТКИ
        this.cleaningUp = true;
        this._stopInProgress = true;

        try {
            // 1. ОСТАНАВЛИВАЕМ СКАНЕР
            if (this.scanner) {
                console.log('🛑 Останавливаем сканер...');
                try {
                    await this.scanner.stop();
                } catch (error) {
                    console.log('⚠️ Мягкая остановка не сработала:', error.message);
                }
                
                // ОЧИЩАЕМ ССЫЛКУ
                this.scanner = null;
            }
            
            // 2. ОСТАНАВЛИВАЕМ ВСЕ ВИДЕО ПОТОКИ
            console.log('🎥 Останавливаем все видео потоки...');
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                try {
                    video.pause();
                    video.srcObject = null;
                    video.load();
                } catch (e) {
                    console.log('⚠️ Ошибка остановки видео:', e);
                }
            });
            
            // 3. ОЧИЩАЕМ КОНТЕЙНЕР
            console.log('🗑️ Очищаем контейнер...');
            const container = document.getElementById('reader');
            if (container) {
                const overlay = container.querySelector('.scanner-overlay');
                container.innerHTML = '';
                
                if (overlay) {
                    container.appendChild(overlay);
                    overlay.style.display = 'flex';
                } else {
                    container.innerHTML = `
                        <div class="scanner-overlay">
                            <span class="placeholder-icon">📷</span>
                            <p>Камера остановлена. Нажмите "Включить камеру"</p>
                            <div class="scanner-frame"></div>
                        </div>
                    `;
                }
            }
            
            // 4. СБРАСЫВАЕМ СОСТОЯНИЕ
            this.isScanning = false;
            this.scanner = null;
            
            // 5. ОБНОВЛЯЕМ ИНТЕРФЕЙС
            document.getElementById('startCamera').classList.remove('hidden');
            document.getElementById('stopCamera').classList.add('hidden');
            
            console.log('✅ Камера полностью очищена');
            
        } catch (error) {
            console.error('❌ Критическая ошибка при очистке камеры:', error);
        } finally {
            this.cleaningUp = false;
            this._stopInProgress = false;
        }
    }

    // ПРОВЕРКА ВАЛИДНОСТИ QR-КОДА
    isValidQRCode(decodedText) {
        if (!decodedText || decodedText.length < 10) {
            console.log('⚠️ Слишком короткий код');
            return false;
        }
        
        // Проверяем формат кодов "Честного знака"
        if (decodedText.startsWith('01') && decodedText.length >= 20) {
            return true;
        }
        
        // Проверяем тестовые коды
        if (decodedText.includes('TEST')) {
            return true;
        }
        
        // Допускаем другие форматы (может быть простой текст)
        console.log('📝 Распознан код:', decodedText.substring(0, 50) + '...');
        return true;
    }

    // ПОКАЗ ПОДСКАЗОК ДЛЯ ЛУЧШЕГО СКАНИРОВАНИЯ
    showScanningTips() {
        const tipsHtml = `
            <div class="scanning-tips">
                <h4>💡 Советы для лучшего сканирования:</h4>
                <ul>
                    <li>🔆 Хорошее освещение</li>
                    <li>📏 Код должен быть в рамке</li>
                    <li>⚡ Избегайте бликов</li>
                    <li>📱 Держите телефон steady</li>
                </ul>
            </div>
        `;
        
        const scannerContainer = document.getElementById('scannerContainer');
        if (scannerContainer && !document.querySelector('.scanning-tips')) {
            const tipsElement = document.createElement('div');
            tipsElement.className = 'scanning-tips';
            tipsElement.innerHTML = tipsHtml;
            scannerContainer.appendChild(tipsElement);
        }
    }

    // ОБРАБОТКА УСПЕШНОГО СКАНИРОВАНИЯ
    onScanSuccess(decodedText) {
        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }
    
        if (appState.hasCodeBeenScanned(decodedText)) {
            showWarning('⚠️ Этот код уже отсканирован');
            return;
        }
    
        const scannedCode = {
            code: decodedText,
            timestamp: new Date().toISOString(),
            contractors: this.selectedContractors.map(c => ({ id: c.id, name: c.name }))
        };
        
        appState.addScannedCode(decodedText);
        this.addCodeToList(scannedCode);
        this.updateUI();
        
        // ВИБРАЦИЯ ПРИ УСПЕШНОМ СКАНИРОВАНИИ (если доступно)
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
        
        showSuccess(`✅ Код добавлен для ${this.selectedContractors.length} контрагентов`, 2000);
        
        // АВТОФОКУС НА СЛЕДУЮЩИЙ КОД (если нужно сканировать несколько)
        setTimeout(() => {
            if (this.isScanning) {
                console.log('🔍 Готов к сканированию следующего кода...');
            }
        }, 500);
    }

    // ДОБАВЛЕНИЕ КОДА В СПИСОК
    addCodeToList(scannedCode) {
        const codesList = document.getElementById('codesList');
        const emptyState = codesList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        const codeItem = document.createElement('div');
        codeItem.className = 'code-item';
        codeItem.innerHTML = `
            <div class="code-info">
                <div class="code-value">${this.formatCode(scannedCode.code)}</div>
                <div class="code-time">${new Date(scannedCode.timestamp).toLocaleTimeString()}</div>
            </div>
            <div class="code-actions">
                <button class="btn btn-sm btn-danger" onclick="scannerManager.removeCode('${scannedCode.code}')">
                    ✕ Удалить
                </button>
            </div>
        `;
        
        codesList.appendChild(codeItem);
    }

    formatCode(code) {
        if (code.length > 25) {
            return code.substring(0, 15) + '...' + code.substring(code.length - 10);
        }
        return code;
    }

    // УДАЛЕНИЕ КОДА
    removeCode(code) {
        appState.removeScannedCode(code);
        this.updateUI();
        showWarning('Код удален', 2000);
    }

    // ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
    updateUI() {
        const codesCount = appState.getCurrentSession().scannedCodes.length;
        document.getElementById('totalCodes').textContent = codesCount;
        document.getElementById('codesCount').textContent = codesCount;
        
        this.updateButtonStates();
        this.updateSessionStatus();
        this.updateCodesList();
    }

    updateCodesList() {
        const codesList = document.getElementById('codesList');
        const codes = appState.getCurrentSession().scannedCodes;
        
        if (codes.length === 0) {
            codesList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📦</span>
                    <p>Нет отсканированных кодов</p>
                    <small>Начните сканирование или используйте симулятор</small>
                </div>
            `;
        }
    }

    // ПОДКЛЮЧЕНИЕ ОБРАБОТЧИКОВ СОБЫТИЙ
    attachEventListeners() {
        console.log('🔧 Подключаем обработчики событий для APK (index.html)');
        
        // Используем делегирование событий для надежности в APK
        document.addEventListener('click', (e) => {
            const target = e.target;
            console.log('🖱️ Клик по:', target.id || target.className);
            
            // Обработка кнопок через делегирование
            if (target.id === 'startCamera' || target.closest('#startCamera')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('📷 Запуск камеры');
                this.startCamera();
            }
            else if (target.id === 'stopCamera' || target.closest('#stopCamera')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🛑 Остановка камеры');
                this.stopCamera();
            }
            else if (target.id === 'showSimulator' || target.closest('#showSimulator')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🧪 Показать симулятор');
                this.showSimulator();
            }
            else if (target.id === 'generateReport' || target.closest('#generateReport')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('📄 Генерация отчета');
                this.generateReport();
            }
            else if (target.id === 'clearSession' || target.closest('#clearSession')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗑️ Очистка сессии');
                this.clearSession();
            }
            else if (target.id === 'addManualContractorBtn' || target.closest('#addManualContractorBtn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('➕ Добавление контрагента вручную');
                this.showAddContractorForm();
            }
            else if (target.id === 'importContractorsBtn' || target.closest('#importContractorsBtn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('📥 Импорт контрагентов');
                this.showImportForm();
            }
            // Обработка кнопок в модальном окне управления контрагентами
            else if (target.id === 'refreshReports' || target.closest('#refreshReports')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔄 Обновление отчетов');
                this.loadReportsList();
            }
            else if (target.id === 'deleteAllPending' || target.closest('#deleteAllPending')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗑️ Удаление всех отчетов');
                this.deleteAllPendingReports();
            }
        });
    
        // Дополнительные обработчики для надежности
        this.setupRobustEventHandlers();
        
        console.log('✅ Обработчики событий подключены для index.html');
    }

    // ЗАГРУЗКА СПИСКА ОТЧЕТОВ
    loadReportsList() {
        console.log('📊 Загружаем список отчетов');
        const reports = appState.getAllReports();
        const container = document.getElementById('reportsList');
        
        if (!container) {
            console.error('❌ Контейнер отчетов не найден');
            return;
        }
        
        if (reports.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📄</span>
                    <p>Нет отправленных отчетов</p>
                    <small>Созданные отчеты появятся здесь</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = reports.map(report => `
            <div class="report-item">
                <div class="report-info">
                    <div class="report-header">
                        <strong>${report.contractorName}</strong>
                        <span class="report-status ${report.status}">${this.getStatusText(report.status)}</span>
                    </div>
                    <div class="report-details">
                        <span>Кодов: ${report.codes.length}</span>
                        <span>${new Date(report.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                </div>
                <div class="report-actions">
                    <button class="btn btn-sm btn-outline" onclick="scannerManager.downloadReport(${report.id})">
                        📥 Скачать
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="scannerManager.deleteReport(${report.id})">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'pending': '⏳ Ожидает',
            'processed': '✅ Обработан', 
            'error': '❌ Ошибка'
        };
        return statusMap[status] || status;
    }

    // УДАЛЕНИЕ ВСЕХ ОТЧЕТОВ
    deleteAllPendingReports() {
        if (confirm('Удалить все необработанные отчеты?')) {
            appState.deleteAllReports();
            this.loadReportsList();
            showSuccess('🗑️ Все отчеты удалены', 3000);
        }
    }

    // СКАЧИВАНИЕ ОТЧЕТА
    downloadReport(reportId) {
        const report = appState.getReport(reportId);
        if (report) {
            // Здесь будет логика генерации PDF
            showInfo('📥 Функция скачивания в разработке', 3000);
        }
    }

    // УДАЛЕНИЕ ОТЧЕТА
    deleteReport(reportId) {
        if (confirm('Удалить этот отчет?')) {
            appState.deleteReport(reportId);
            this.loadReportsList();
            showWarning('🗑️ Отчет удален', 3000);
        }
    }
    
    // ДОБАВЬТЕ этот метод для надежных обработчиков
    setupRobustEventHandlers() {
        // Дублируем основные обработчики для APK
        const buttons = [
            { id: 'startCamera', method: 'startCamera' },
            { id: 'stopCamera', method: 'stopCamera' },
            { id: 'showSimulator', method: 'showSimulator' },
            { id: 'generateReport', method: 'generateReport' },
            { id: 'clearSession', method: 'clearSession' },
            { id: 'addManualContractorBtn', method: 'showAddContractorForm' },
            { id: 'importContractorsBtn', method: 'showImportForm' }
        ];
        
        buttons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                // Удаляем старые обработчики
                element.replaceWith(element.cloneNode(true));
                const newElement = document.getElementById(btn.id);
                
                // Добавляем новые
                newElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`🎯 Кнопка ${btn.id} нажата`);
                    this[btn.method]();
                });
            }
        });
    }

    // ВОССТАНОВЛЕНИЕ СЕССИИ
    checkExistingSession() {
        try {
            console.log('🔄 Восстановление сессии...');
            
            // ВОССТАНАВЛИВАЕМ ВЫБРАННЫХ КОНТРАГЕНТОВ
            const saved = JSON.parse(localStorage.getItem('honest_sign_selected_contractors') || '{}');
            console.log('- Сохраненные выбранные контрагенты:', saved);
            
            if (saved.contractorIds && Array.isArray(saved.contractorIds)) {
                this.selectedContractors = saved.contractorIds.map(id => 
                    this.allContractors.find(c => c.id === id)
                ).filter(c => c); // убираем undefined
                
                console.log('- Восстановлено контрагентов:', this.selectedContractors.length);
            }
    
            // ВОССТАНАВЛИВАЕМ ОТСКАНИРОВАННЫЕ КОДЫ
            const session = appState.getCurrentSession();
            if (session.scannedCodes.length > 0) {
                session.scannedCodes.forEach(code => this.addCodeToList(code));
                this.updateUI();
            }
            
            this.updateSelectedContractorsUI();
            this.updateButtonStates();
            this.updateSessionStatus();
            
            console.log('✅ Сессия восстановлена');
            
        } catch (error) {
            console.error('❌ Ошибка восстановления сессии:', error);
            // Сбрасываем при ошибке
            this.selectedContractors = [];
            this.updateSelectedContractorsUI();
        }
    }

    // СОЗДАНИЕ ОТЧЕТА
    async generateReport() {
        const session = appState.getCurrentSession();
        
        if (session.scannedCodes.length === 0) {
            showError('❌ Нет кодов для отчета');
            return;
        }

        if (this.selectedContractors.length === 0) {
            showError('❌ Нет выбранных контрагентов');
            return;
        }

        try {
            const report = {
                id: Date.now(),
                contractorName: this.selectedContractors.map(c => c.name).join(', '),
                contractors: [...this.selectedContractors],
                codes: [...session.scannedCodes],
                createdAt: new Date().toISOString(),
                status: 'pending',
                sessionId: session.id // 
            };

            // СОХРАНЯЕМ ОТЧЕТ
            appState.saveReport(report);
            
            showSuccess(`✅ Отчет создан! Кодов: ${session.scannedCodes.length}`, 5000);
            this.clearSession();

            // ОБНОВЛЯЕМ СПИСОК ОТЧЕТОВ
            this.loadReportsList();

            console.log('📊 Отчет создан, сессия остается активной для возможного дополнения');
            
        } catch (error) {
            console.error('❌ Ошибка создания отчета:', error);
            showError('Ошибка создания отчета');
        }
    }

    // ОЧИСТКА СЕССИИ
    clearSession() {
        this.stopCamera();
        appState.clearCurrentSession();
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        this.updateUI();
        showWarning('🗑️ Сессия очищена', 3000);
    }

    // СОХРАНЕНИЕ КОНТРАГЕНТОВ В ХРАНИЛИЩЕ
    saveContractors() {
        console.log('💾 СОХРАНЕНИЕ КОНТРАГЕНТОВ В ХРАНИЛИЩЕ');
        
        try {
            // Проверяем что есть что сохранять
            if (!this.allContractors || this.allContractors.length === 0) {
                console.warn('⚠️ Нет контрагентов для сохранения');
                return;
            }
            
            console.log('- Сохраняем контрагентов:', this.allContractors.length);
            console.log('- Данные для сохранения:', this.allContractors);
            
            // Преобразуем в чистый JSON
            const contractorsToSave = JSON.stringify(this.allContractors);
            console.log('- JSON для сохранения:', contractorsToSave);
            
            // Сохраняем в localStorage
            localStorage.setItem('honest_sign_contractors', contractorsToSave);
            
            // ПРОВЕРЯЕМ СОХРАНЕНИЕ
            const saved = localStorage.getItem('honest_sign_contractors');
            console.log('- Проверка сохранения:', saved ? '✅ Успешно' : '❌ Ошибка');
            
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('- Проверка данных:', parsed.length === this.allContractors.length ? '✅ Данные совпадают' : '❌ Данные не совпадают');
                console.log('- Сохранено контрагентов:', parsed.length);
            } else {
                console.error('❌ Данные не сохранились в localStorage');
            }
            
        } catch (error) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА СОХРАНЕНИЯ:', error);
            
            // Пробуем сохранить хотя бы основные данные
            try {
                const basicContractors = this.allContractors.map(c => ({
                    id: c.id,
                    name: c.name,
                    category: c.category
                }));
                localStorage.setItem('honest_sign_contractors', JSON.stringify(basicContractors));
                console.log('🔄 Сохранены базовые данные');
            } catch (e) {
                console.error('❌ Не удалось сохранить даже базовые данные:', e);
            }
        }
    }

    enableTestMode() {
        console.log('🧪 Включаем тестовый режим...');
        
        // Автоматически выбираем первого контрагента для теста
        if (this.allContractors.length > 0) {
            const testContractor = this.allContractors[0];
            this.toggleContractor(testContractor.id);
            console.log('✅ Автовыбор контрагента для теста:', testContractor.name);
            showSuccess(`Автовыбран: ${testContractor.name} для тестирования`, 3000);
        } else {
            // Если контрагентов нет - создаем тестового
            const testContractor = { id: 1, name: 'Тестовый клиент', category: 'Для теста' };
            this.allContractors.push(testContractor);
            this.toggleContractor(testContractor.id);
            this.saveContractors();
            console.log('✅ Создан тестовый контрагент');
            showSuccess('Создан тестовый клиент для проверки камеры', 3000);
        }
        
        // Включаем камеру через 1 секунду
        setTimeout(() => {
            if (this.selectedContractors.length > 0) {
                this.startCamera();
            }
        }, 1000);
    }

    // ДОБАВЬТЕ в класс ScannerManager
    checkBrowserCompatibility() {
        console.log('🌐 Проверка совместимости браузера...');
        
        const compatibility = {
            mediaDevices: !!navigator.mediaDevices,
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            enumerateDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
            html5Qrcode: typeof Html5Qrcode !== 'undefined',
            userAgent: navigator.userAgent
        };
        
        console.log('📊 Совместимость:', compatibility);
        
        // Определяем браузер
        let browser = 'Unknown';
        let version = 'Unknown';
        
        if (/OPR\//.test(navigator.userAgent)) {
            browser = 'Opera';
            version = navigator.userAgent.match(/OPR\/(\d+)/)[1];
        } else if (/Chrome\//.test(navigator.userAgent)) {
            browser = 'Chrome';
            version = navigator.userAgent.match(/Chrome\/(\d+)/)[1];
        } else if (/Firefox\//.test(navigator.userAgent)) {
            browser = 'Firefox';
            version = navigator.userAgent.match(/Firefox\/(\d+)/)[1];
        } else if (/Safari\//.test(navigator.userAgent)) {
            browser = 'Safari';
            version = navigator.userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        }
        
        const result = {
            browser,
            version,
            compatible: compatibility.mediaDevices && compatibility.getUserMedia,
            details: compatibility
        };
        
        console.log('🔍 Результат проверки:', result);
        return result;
    }

    // метод показа предупреждения о совместимости
    showBrowserCompatibilityWarning(compatibility) {
        console.warn('⚠️ Браузер не совместим с камерой:', compatibility);
        
        const warningHtml = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 15px 0;">
            <h4 style="color: #856404; margin-top: 0;">⚠️ Внимание: Проблема совместимости</h4>
            <p style="color: #856404; margin-bottom: 10px;">
                Ваш браузер <strong>${compatibility.browser} ${compatibility.version}</strong> 
                не поддерживает доступ к камере.
            </p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                <strong>Рекомендуемые браузеры:</strong>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>Chrome 60+</li>
                    <li>Firefox 55+</li>
                    <li>Safari 11+</li>
                    <li>Opera 47+</li>
                </ul>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="scannerManager.downloadRecommendedBrowser()" 
                        class="btn btn-primary btn-sm">
                    📲 Скачать Chrome
                </button>
                <button onclick="scannerManager.showManualInputMode()" 
                        class="btn btn-success btn-sm">
                    ✍️ Ручной ввод кодов
                </button>
                <button onclick="scannerManager.useSimulatorMode()" 
                        class="btn btn-info btn-sm">
                    🧪 Режим симулятора
                </button>
            </div>
        </div>
        `;
        
        // Добавляем предупреждение в начало контейнера
        const container = document.querySelector('.container');
        if (container) {
            const warningDiv = document.createElement('div');
            warningDiv.innerHTML = warningHtml;
            container.insertBefore(warningDiv, container.firstChild);
        }
        
        // Показываем симулятор по умолчанию
        this.showSimulator();
    }

    // метод для ручного ввода
    showManualInputMode() {
        console.log('✍️ Активируем режим ручного ввода...');
        
        // Скрываем элементы камеры
        document.getElementById('startCamera').style.display = 'none';
        document.getElementById('stopCamera').style.display = 'none';
        
        // Показываем ручной ввод
        const manualInputHtml = `
        <div class="card" style="background: #e7f3ff; border: 2px dashed #007bff;">
            <h3>✍️ Ручной ввод QR-кодов</h3>
            <div class="form-group">
                <label>Введите QR-код вручную:</label>
                <input type="text" id="manualCodeInput" class="form-select" 
                    placeholder="0104604063405720219NQNfSwVmcTEST001"
                    style="font-family: monospace; font-size: 14px;">
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="scannerManager.addManualCode()" class="btn btn-success">
                    ✅ Добавить код
                </button>
                <button onclick="scannerManager.batchInputMode()" class="btn btn-info">
                    📝 Пакетный ввод
                </button>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                <strong>Формат кода:</strong> 01... (21 символ DataMatrix)
            </div>
        </div>
        `;
        
        const scannerCard = document.querySelector('.card:nth-child(3)'); // Карточка сканирования
        if (scannerCard) {
            scannerCard.innerHTML = manualInputHtml + scannerCard.innerHTML;
        }
        
        showSuccess('Режим ручного ввода активирован', 3000);
    }

    // метод добавления кода вручную
    addManualCode() {
        const input = document.getElementById('manualCodeInput');
        const code = input.value.trim();
        
        if (!code) {
            showError('❌ Введите QR-код');
            return;
        }
        
        if (code.length < 10) {
            showError('❌ Код слишком короткий');
            return;
        }
        
        this.simulateScan(code);
        input.value = '';
        input.focus();
    }

    // метод пакетного ввода
    batchInputMode() {
        const batchHtml = `
        <div class="card" style="background: #fff3cd; border: 2px dashed #ffc107;">
            <h3>📝 Пакетный ввод кодов</h3>
            <div class="form-group">
                <label>Введите коды (по одному в строке):</label>
                <textarea id="batchCodesInput" class="form-select" 
                        rows="6" 
                        placeholder="0104604063405720219NQNfSwVmcTEST001&#10;0104604063405720219NQNfSwVmdTEST002&#10;0104604063405720219NQNfSwVmeTEST003"
                        style="font-family: monospace; font-size: 12px;"></textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="scannerManager.addBatchCodes()" class="btn btn-success">
                    ✅ Добавить все коды
                </button>
                <button onclick="scannerManager.closeBatchInput()" class="btn btn-secondary">
                    ✕ Закрыть
                </button>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                Каждая строка - отдельный QR-код
            </div>
        </div>
        `;
        
        const scannerCard = document.querySelector('.card:nth-child(3)');
        if (scannerCard) {
            scannerCard.innerHTML = batchHtml;
        }
    }

    addBatchCodes() {
        const textarea = document.getElementById('batchCodesInput');
        const codesText = textarea.value.trim();
        
        if (!codesText) {
            showError('❌ Введите коды');
            return;
        }
        
        const codes = codesText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (codes.length === 0) {
            showError('❌ Не найдено валидных кодов');
            return;
        }
        
        let addedCount = 0;
        let duplicateCount = 0;
        
        codes.forEach(code => {
            if (code.length >= 10 && !appState.hasCodeBeenScanned(code)) {
                this.simulateScan(code);
                addedCount++;
            } else {
                duplicateCount++;
            }
        });
        
        let message = `✅ Добавлено ${addedCount} кодов`;
        if (duplicateCount > 0) {
            message += `, пропущено ${duplicateCount} дубликатов`;
        }
        
        showSuccess(message, 5000);
        this.closeBatchInput();
    }

    closeBatchInput() {
        this.showManualInputMode();
    }

    useSimulatorMode() {
        console.log('🧪 Активируем режим симулятора...');
        this.showSimulator();
        showSuccess('Режим симулятора активирован', 3000);
    }

    downloadRecommendedBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        let storeUrl = '';
        if (/android/.test(userAgent)) {
            storeUrl = 'https://play.google.com/store/apps/details?id=com.android.chrome';
        } else if (/iphone|ipad/.test(userAgent)) {
            storeUrl = 'https://apps.apple.com/app/chrome-web-browser/id535886823';
        } else {
            storeUrl = 'https://www.google.com/chrome/';
        }
        
        window.open(storeUrl, '_blank');
        showInfo('Открыта страница загрузки Chrome', 3000);
    }

    // ВОССТАНОВЛЕНИЕ КАМЕРЫ ПРИ ПОВТОРНОМ ЗАХОДЕ
    async restoreCameraState() {
        console.log('🔁 Проверяем состояние камеры...');
        
        try {
            // Проверяем поддержку mediaDevices
            if (!navigator.mediaDevices) {
                console.warn('⚠️ mediaDevices не поддерживается в этом браузере');
                addToConsole('❌ mediaDevices не поддерживается - используйте современный браузер');
                return false;
            }
            
            if (!navigator.mediaDevices.enumerateDevices) {
                console.warn('⚠️ enumerateDevices не поддерживается');
                addToConsole('❌ enumerateDevices не поддерживается');
                return false;
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('📸 Доступные видеоустройства:', videoDevices.length);
            addToConsole(`📸 Найдено камер: ${videoDevices.length}`);
            
            if (videoDevices.length === 0) {
                console.warn('⚠️ Видеоустройства не найдены');
                addToConsole('❌ Камеры не найдены - проверьте разрешения');
                return false;
            }
            
            // Пробуем получить доступ к камере
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
                
                // Останавливаем тестовый поток
                stream.getTracks().forEach(track => track.stop());
                
                console.log('✅ Камера доступна для запуска');
                addToConsole('✅ Камера доступна!');
                return true;
                
            } catch (error) {
                console.warn('⚠️ Нет разрешения на камеру:', error.message);
                addToConsole(`❌ Нет разрешения: ${error.message}`);
                
                // Показываем инструкции для мобильных
                if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                    this.showMobileCameraInstructions();
                }
                
                return false;
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки камеры:', error);
            addToConsole(`❌ Ошибка проверки: ${error.message}`);
            return false;
        }
    }
    
    // Добавьте метод для мобильных инструкций
    showMobileCameraInstructions() {
        const instructions = `
    <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4 style="color: #155724; margin-top: 0;">📱 Как разрешить камеру на мобильном:</h4>
        <ol style="color: #155724; margin-bottom: 0;">
            <li>Нажмите на значок <strong>🔒</strong> в адресной строке</li>
            <li>Выберите <strong>"Разрешить"</strong> для доступа к камере</li>
            <li>Или в настройках браузера → Сайты → Камера</li>
            <li>Найдите этот сайт и разрешите доступ</li>
            <li><strong>Перезагрузите страницу</strong></li>
        </ol>
    </div>
        `;
        
        const scanControls = document.querySelector('.scan-controls');
        if (scanControls && !document.getElementById('mobileCameraInstructions')) {
            const instructionsDiv = document.createElement('div');
            instructionsDiv.id = 'mobileCameraInstructions';
            instructionsDiv.innerHTML = instructions;
            scanControls.parentNode.insertBefore(instructionsDiv, scanControls.nextSibling);
        }
    }

    // ИНСТРУКЦИИ ДЛЯ CHROME ANDROID
    showChromeAndroidInstructions() {
        const instructions = `
    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4 style="color: #856404; margin-top: 0;">📱 Инструкция для Chrome на Android</h4>
        <ol style="color: #856404; margin-bottom: 0;">
            <li>Откройте <strong>Настройки Chrome</strong></li>
            <li>Перейдите в <strong>Настройки сайта</strong></li>
            <li>Выберите <strong>Камера</strong></li>
            <li>Разрешите доступ для этого сайта</li>
            <li>Перезагрузите страницу</li>
        </ol>
    </div>
            `;
            
            // Добавляем инструкции под кнопками сканирования
            const scanControls = document.querySelector('.scan-controls');
            if (scanControls && !document.getElementById('chromeInstructions')) {
                const instructionsDiv = document.createElement('div');
                instructionsDiv.id = 'chromeInstructions';
                instructionsDiv.innerHTML = instructions;
                scanControls.parentNode.insertBefore(instructionsDiv, scanControls.nextSibling);
            }
        }

    // ОБНОВЛЕНИЕ ВЫБРАННЫХ КОНТРАГЕНТОВ В ИНТЕРФЕЙСЕ
    updateSelectedContractorsUI() {
        const container = document.getElementById('selectedContractors');
        const contractorsList = document.getElementById('contractorsList');
        const selectedCount = document.getElementById('selectedCount');
        
        if (!container || !contractorsList) {
            console.error('❌ Элементы интерфейса контрагентов не найдены');
            return;
        }
        
        if (this.selectedContractors.length === 0) {
            container.classList.add('hidden');
            if (selectedCount) selectedCount.textContent = '0';
            return;
        }
        
        container.classList.remove('hidden');
        if (selectedCount) selectedCount.textContent = this.selectedContractors.length;
        
        // Используем существующие классы из CSS
        contractorsList.innerHTML = this.selectedContractors.map(contractor => 
            `<div class="contractor-tag">
                <span class="contractor-name">${contractor.name}</span>
                <span class="contractor-category">${contractor.category}</span>
                <button class="btn btn-sm btn-danger" onclick="scannerManager.removeContractor(${contractor.id})">
                    ✕
                </button>
            </div>`
        ).join('');
    }

    // ПОКАЗ СИМУЛЯТОРА
    showSimulator() {
        console.log('🧪 Показываем симулятор сканирования');
        const simulator = document.getElementById('simulator');
        if (simulator) {
            simulator.classList.remove('hidden');
        }
        showInfo('Режим симулятора активирован', 3000);
    }

    // СИМУЛЯЦИЯ СКАНИРОВАНИЯ
    simulateScan(code) {
        console.log('🧪 Симуляция сканирования кода:', code);
        this.onScanSuccess(code);
    }
}

// ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML
window.handleContractorSelection = function(contractorId) {
    if (window.scannerManager) {
        window.scannerManager.handleContractorSelection(contractorId);
    }
};

// ИНИЦИАЛИЗАЦИЯ
let scannerManager;

// Единый обработчик инициализации
function initializeScannerManager() {
    if (!window.scannerManager) {
        window.scannerManager = new ScannerManager();
        console.log('✅ ScannerManager полностью инициализирован');
    }
}

// Обработчик загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScannerManager);
} else {
    // DOM уже загружен
    setTimeout(initializeScannerManager, 100);
}
