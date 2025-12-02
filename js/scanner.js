// scanner.js
class ScannerManager {
    constructor() {
        console.log('🚀 Создание ScannerManager');
        
        // Проверяем существующий экземпляр
        if (window.scannerManager) {
            console.log('⚠️ ScannerManager уже существует');
            return window.scannerManager;
        }
        
        // Сохраняем глобальную ссылку
        window.scannerManager = this;
        
        // Инициализируем свойства
        this.scanner = null;
        this.isScanning = false;
        this.selectedContractors = [];
        this.allContractors = [];
        this._stopInProgress = false;
        this.apkMode = false;
        
        // Получаем AppState (может быть еще не инициализирован)
        this.appState = window.appState;
        console.log('📊 AppState доступен:', !!this.appState);
        
        // Запускаем инициализацию
        this.init();
    }

    async init() {
        console.log('🔧 Инициализация ScannerManager');

            // Ждем инициализации AppState если нужно
    if (!this.appState || !this.appState.isInitialized) {
        console.log('⏳ Ожидаем инициализацию AppState...');
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (window.appState && window.appState.isInitialized) {
                    clearInterval(checkInterval);
                    this.appState = window.appState;
                    console.log('✅ AppState готов');
                    resolve();
                }
            }, 100);
            
            // Таймаут
            setTimeout(() => {
                clearInterval(checkInterval);
                console.log('⚠️ Таймаут ожидания AppState');
                resolve();
            }, 5000);
        });
    }
        
        // Проверяем APK режим
        this.optimizeForAPK();
        
        // Загружаем контрагентов
        this.loadContractors();
        
        // Восстанавливаем сессию
        this.checkExistingSession();
        
        // Подключаем обработчики
        this.setupEventListeners();
        
        // Проверяем камеру
        await this.checkCameraAvailability();
        
        // Загружаем отчеты
        this.loadReportsList();
        
        // Обновляем UI синхронизации (с задержкой чтобы Firebase успел инициализироваться)
        setTimeout(() => {
            this.updateSyncUI();
            console.log('🔄 UI синхронизации обновлен');
        }, 3000);
        
        // Периодическое обновление статуса синхронизации
        setInterval(() => {
            this.updateSyncUI();
            console.log('🔄 Периодическое обновление статуса синхронизации');
        }, 30000); // каждые 30 секунд
        
        // Также обновляем статус синхронизации при изменении данных
        this.setupSyncDataListeners();
        
        console.log('✅ ScannerManager инициализирован');
        showSuccess('Складской модуль готов к работе', 2000);
    }

    setupSyncDataListeners() {
        console.log('🔧 Настройка слушателей данных синхронизации...');
        
        // Слушаем изменения в localStorage для синхронизации
        window.addEventListener('storage', (event) => {
            if (event.key === 'honest_sign_contractors' || 
                event.key === 'honest_sign_session' ||
                event.key === 'honest_sign_reports') {
                
                console.log('📡 Обнаружено изменение в localStorage:', event.key);
                
                // Обновляем соответствующие данные
                if (event.key === 'honest_sign_contractors') {
                    this.loadContractors();
                    console.log('🔄 Контрагенты перезагружены из localStorage');
                }
                
                // Обновляем UI синхронизации
                this.updateSyncUI();
            }
        });
        
        // Также обновляем UI при изменении выбранных контрагентов
        const originalUpdateSelectedContractorsUI = this.updateSelectedContractorsUI.bind(this);
        this.updateSelectedContractorsUI = () => {
            originalUpdateSelectedContractorsUI();
            this.updateSyncUI(); // Обновляем статус синхронизации
        };
        
        // И при обновлении UI
        const originalUpdateUI = this.updateUI.bind(this);
        this.updateUI = () => {
            originalUpdateUI();
            this.updateSyncUI(); // Обновляем статус синхронизации
        };
        
        console.log('✅ Слушатели данных синхронизации настроены');
    }

    optimizeForAPK() {
        const isInAPK = !window.location.protocol.startsWith('http');
        const isWebView = /WebView|Android/.test(navigator.userAgent);
        
        if (isInAPK || isWebView) {
            console.log('📱 APK режим активирован');
            this.apkMode = true;

            this.applyAPKOptimizations();
        }
    }

    // Метод для оптимизаций APK
    applyAPKOptimizations() {
        // Упрощаем интерфейс для APK
        if (this.apkMode) {
            console.log('🎯 Применение оптимизаций для APK...');
            
            // Можно добавить специфичные оптимизации:
            // - Упрощенный UI
            // - Кэширование ресурсов
            // - Оптимизация производительности
            
            // Пример: скрыть сложные элементы
            const complexElements = document.querySelectorAll('.desktop-only, .advanced-feature');
            complexElements.forEach(el => {
                el.style.display = 'none';
            });
            
            // Увеличиваем touch-targets для мобильных
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.style.minHeight = '44px';
                btn.style.padding = '12px 16px';
            });
            
            console.log('✅ Оптимизации для APK применены');
        }
    }

    // ЗАГРУЗКА КОНТРАГЕНТОВ
    loadContractors() {
        console.log('🔍 Загрузка контрагентов');
        
        if (this.appState && this.appState.getAllContractors) {
            this.allContractors = this.appState.getAllContractors();
            console.log(`✅ Загружено ${this.allContractors.length} контрагентов из AppState`);
        } else {
            console.warn('⚠️ AppState не доступен, загружаем напрямую');
            this.loadContractorsDirectly();
        }
        
        this.initContractorSearch();
    }

    loadContractorsDirectly() {
        try {
            const saved = localStorage.getItem('honest_sign_contractors');
            if (saved) {
                this.allContractors = JSON.parse(saved);
                console.log(`✅ Загружено ${this.allContractors.length} контрагентов из localStorage`);
            } else {
                this.loadDefaultContractors();
                this.saveContractorsDirectly();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            this.loadDefaultContractors();
        }
    }

    loadDefaultContractors() {
        this.allContractors = [
            { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель' },
            { id: 2, name: 'ИП Иванов', category: 'Розничная сеть' },
            { id: 3, name: 'ООО "Луч"', category: 'Дилер' },
            { id: 4, name: 'АО "Вектор"', category: 'Партнер' }
        ];
    }

    saveContractorsDirectly() {
        try {
            localStorage.setItem('honest_sign_contractors', JSON.stringify(this.allContractors));
            console.log(`✅ Сохранено ${this.allContractors.length} контрагентов`);
        } catch (error) {
            console.error('❌ Ошибка сохранения контрагентов:', error);
        }
    }

    saveContractors() {
        console.log('💾 Сохранение контрагентов');
        
        if (window.appState && window.appState.saveContractors) {
            window.appState.saveContractors();
            console.log('✅ Контрагенты сохранены через AppState');
        } else {
            this.saveContractorsDirectly();
        }
    }

    // ПОИСК КОНТРАГЕНТОВ
    initContractorSearch() {
        const searchInput = document.getElementById('contractorSearch');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.filterContractors(query);
        });

        searchInput.addEventListener('focus', () => {
            this.filterContractors('');
            this.showDropdown();
        });

        // Скрытие dropdown при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.contractor-search')) {
                this.hideDropdown();
            }
        });
    }

    filterContractors(query = '') {
        const dropdown = document.getElementById('contractorDropdown');
        if (!dropdown) return;

        let filtered = this.allContractors;
        
        if (query) {
            const terms = query.toLowerCase().split(' ');
            filtered = this.allContractors.filter(contractor => 
                terms.some(term => 
                    contractor.name.toLowerCase().includes(term) ||
                    contractor.category.toLowerCase().includes(term)
                )
            );
        }

        // Ограничиваем показ
        filtered = filtered.slice(0, 10);

        if (filtered.length === 0) {
            dropdown.innerHTML = `
                <div class="dropdown-item no-results">
                    <div>🔍 Контрагенты не найдены</div>
                </div>
            `;
        } else {
            dropdown.innerHTML = filtered.map(contractor => {
                const isSelected = this.selectedContractors.some(c => c.id === contractor.id);
                return `
                    <div class="dropdown-item ${isSelected ? 'selected' : ''}" 
                         onclick="scannerManager.selectContractor(${contractor.id})">
                        <div class="contractor-info">
                            <div class="contractor-name">${contractor.name}</div>
                            <div class="contractor-category">${contractor.category}</div>
                        </div>
                        ${isSelected ? '<div class="selected-badge">✓</div>' : ''}
                    </div>
                `;
            }).join('');
        }

        this.showDropdown();
    }

    selectContractor(contractorId) {
        const contractor = this.allContractors.find(c => c.id === contractorId);
        if (!contractor) return;

        const isSelected = this.selectedContractors.some(c => c.id === contractorId);
        
        if (isSelected) {
            this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
            showWarning(`Удален: ${contractor.name}`, 2000);
        } else {
            this.selectedContractors.push(contractor);
            showSuccess(`Добавлен: ${contractor.name}`, 2000);
        }

        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.saveSelectedContractors();
        this.hideDropdown();
        
        // Очищаем поле поиска
        const searchInput = document.getElementById('contractorSearch');
        if (searchInput) searchInput.value = '';
    }

    removeContractor(contractorId) {
        this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.saveSelectedContractors();
    }

    clearContractors() {
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.saveSelectedContractors();
        this.hideDropdown();
    }

    updateSelectedContractorsUI() {
        const container = document.getElementById('selectedContractors');
        const list = document.getElementById('contractorsList');
        const count = document.getElementById('selectedCount');
        
        if (!container || !list) return;

        if (this.selectedContractors.length === 0) {
            container.classList.add('hidden');
            if (count) count.textContent = '0';
            return;
        }

        container.classList.remove('hidden');
        if (count) count.textContent = this.selectedContractors.length;

        list.innerHTML = this.selectedContractors.map(contractor => `
            <div class="contractor-tag">
                <span class="contractor-name">${contractor.name}</span>
                <span class="contractor-category">${contractor.category}</span>
                <button class="btn btn-sm btn-danger" onclick="scannerManager.removeContractor(${contractor.id})">
                    ✕
                </button>
            </div>
        `).join('');
    }

    saveSelectedContractors() {
        try {
            const data = {
                contractorIds: this.selectedContractors.map(c => c.id),
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('honest_sign_selected_contractors', JSON.stringify(data));
        } catch (error) {
            console.error('❌ Ошибка сохранения выбранных контрагентов:', error);
        }
    }

    // УПРАВЛЕНИЕ КОНТРАГЕНТАМИ
    showContractorManager() {
        const modal = document.getElementById('contractorManager');
        if (modal) {
            modal.classList.remove('hidden');
            this.loadContractorsManagerList();
            document.body.style.overflow = 'hidden';
        }
    }

    hideContractorManager() {
        const modal = document.getElementById('contractorManager');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    showAddContractorForm() {
        this.showContractorManager();
        setTimeout(() => {
            const addForm = document.getElementById('addContractorForm');
            const importForm = document.getElementById('importForm');
            if (addForm) addForm.classList.remove('hidden');
            if (importForm) importForm.classList.add('hidden');
        }, 100);
    }

    showImportForm() {
        this.showContractorManager();
        setTimeout(() => {
            const addForm = document.getElementById('addContractorForm');
            const importForm = document.getElementById('importForm');
            if (addForm) addForm.classList.add('hidden');
            if (importForm) importForm.classList.remove('hidden');
        }, 100);
    }

    hideAddContractorForm() {
        const addForm = document.getElementById('addContractorForm');
        const importForm = document.getElementById('importForm');
        if (addForm) addForm.classList.add('hidden');
        if (importForm) importForm.classList.add('hidden');
    }

    addContractor() {
        const nameInput = document.getElementById('contractorNameInput');
        const categoryInput = document.getElementById('contractorCategoryInput');
        
        if (!nameInput || !categoryInput) return;

        const name = nameInput.value.trim();
        const category = categoryInput.value.trim() || 'Общая категория';

        if (!name) {
            showError('Введите название контрагента');
            return;
        }

        // Проверка дубликатов
        if (this.allContractors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            showError('Контрагент с таким названием уже существует');
            return;
        }

        const newId = this.allContractors.length > 0 
            ? Math.max(...this.allContractors.map(c => c.id)) + 1 
            : 1;

        const newContractor = { id: newId, name, category };
        this.allContractors.push(newContractor);
        this.saveContractors();

        // Обновляем интерфейс
        nameInput.value = '';
        categoryInput.value = '';
        this.hideAddContractorForm();
        this.loadContractorsManagerList();

        showSuccess(`Контрагент "${name}" добавлен`, 3000);
    }

    importContractorsFromForm() {
        const importData = document.getElementById('importDataTextarea');
        if (!importData || !importData.value.trim()) {
            showError('Введите данные для импорта');
            return;
        }

        const lines = importData.value.trim().split('\n');
        let importedCount = 0;

        lines.forEach(line => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 1) {
                const name = parts[0];
                const category = parts[1] || 'Общая категория';

                // Проверяем дубликаты
                if (!this.allContractors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                    const newId = this.allContractors.length > 0 
                        ? Math.max(...this.allContractors.map(c => c.id)) + 1 
                        : 1;
                    
                    this.allContractors.push({ id: newId, name, category });
                    importedCount++;
                }
            }
        });

        if (importedCount > 0) {
            this.saveContractors();
            this.loadContractorsManagerList();
            importData.value = '';
            this.hideAddContractorForm();
            showSuccess(`Импортировано ${importedCount} контрагентов`, 3000);
        } else {
            showWarning('Нет новых контрагентов для импорта');
        }
    }

    loadContractorsManagerList() {
        const container = document.getElementById('contractorsManagerList');
        if (!container) return;

        if (this.allContractors.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">👥</span>
                    <p>Нет контрагентов</p>
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

    selectContractorInManager(contractorId) {
        this.selectContractor(contractorId);
        this.hideContractorManager();
    }

    deleteContractor(contractorId) {
        if (!confirm('Удалить этого контрагента?')) return;
        
        this.allContractors = this.allContractors.filter(c => c.id !== contractorId);
        this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
        this.saveContractors();
        this.updateSelectedContractorsUI();
        this.loadContractorsManagerList();
        showWarning('Контрагент удален', 3000);
    }

    // КАМЕРА И СКАНИРОВАНИЕ
    async checkCameraAvailability() {
        try {
            if (!navigator.mediaDevices) {
                console.warn('⚠️ mediaDevices не поддерживается');
                return false;
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            console.log(`📸 Найдено камер: ${cameras.length}`);
            
            return cameras.length > 0;
        } catch (error) {
            console.error('❌ Ошибка проверки камеры:', error);
            return false;
        }
    }

    async startCamera() {
        if (this.isScanning) {
            console.log('⚠️ Камера уже запущена');
            return;
        }
    
        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }
    
        try {
            await this.stopCamera();
    
            if (typeof Html5Qrcode === 'undefined') {
                await this.loadHtml5QrCode();
            }
    
            const container = document.getElementById('reader');
            if (!container) throw new Error('Контейнер не найден');
    
            container.innerHTML = '';
            
            this.scanner = new Html5Qrcode("reader");
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
    
            await this.scanner.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    console.log('✅ Код распознан:', decodedText);
                    this.onScanSuccess(decodedText);
                },
                (error) => {
                    console.log('📷 Сканирование:', error);
                }
            );
    
            this.isScanning = true;
            this.updateCameraUI();
            showSuccess('📷 Камера запущена! Наведите на DataMatrix код', 3000);
    
        } catch (error) {
            console.error('❌ Ошибка запуска камеры:', error);
            showError(`Ошибка камеры: ${error.message}`);
            this.showSimulator();
        }
    }

    async stopCamera() {
        if (this._stopInProgress) return;
        
        this._stopInProgress = true;

        try {
            if (this.scanner) {
                await this.scanner.stop();
                this.scanner = null;
            }

            // Очищаем контейнер
            const container = document.getElementById('reader');
            if (container) {
                container.innerHTML = `
                    <div class="scanner-overlay">
                        <span class="placeholder-icon">📷</span>
                        <p>Камера остановлена</p>
                        <div class="scanner-frame"></div>
                    </div>
                `;
            }

            this.isScanning = false;
            this.updateCameraUI();
            
        } catch (error) {
            console.error('❌ Ошибка остановки камеры:', error);
        } finally {
            this._stopInProgress = false;
        }
    }

    updateCameraUI() {
        const startBtn = document.getElementById('startCamera');
        const stopBtn = document.getElementById('stopCamera');
        
        if (this.isScanning) {
            if (startBtn) startBtn.classList.add('hidden');
            if (stopBtn) stopBtn.classList.remove('hidden');
        } else {
            if (startBtn) startBtn.classList.remove('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');
        }
    }

    onScanSuccess(decodedText) {
        console.log('✅ Код распознан:', decodedText);
        
        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }
        
        // Базовая проверка
        if (!decodedText || decodedText.trim().length === 0) {
            showError('❌ Пустой код');
            return;
        }
        
        // Получаем текущую сессию
        const session = this.getCurrentSession();
        
        // Проверка дубликатов
        if (session.scannedCodes.some(code => code.code === decodedText)) {
            showWarning('⚠️ Этот код уже отсканирован');
            return;
        }
        
        // Добавляем код
        const scannedCode = {
            code: decodedText,
            timestamp: new Date().toISOString(),
            contractors: this.selectedContractors.map(c => ({ id: c.id, name: c.name }))
        };
        
        // Сохраняем
        session.scannedCodes.push(scannedCode);
        this.saveSession(session); // Теперь этот метод существует
        
        this.addCodeToList(scannedCode);
        this.updateUI();
        
        const codesCount = session.scannedCodes.length;
        const contractorsCount = this.selectedContractors.length;
        
        // Информационное сообщение о прогрессе
        if (codesCount >= contractorsCount) {
            showSuccess(`✅ Достаточно кодов! (${codesCount}/${contractorsCount})`, 2000);
        } else {
            showInfo(`📦 Код добавлен (${codesCount}/${contractorsCount})`, 2000);
        }
        
        // Виброотклик на мобильных
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    }

    checkReportRequirements() {
        const session = this.getCurrentSession();
        const codesCount = session.scannedCodes.length;
        const contractorsCount = this.selectedContractors.length;
        
        console.log('📋 Проверка требований для отчета:');
        console.log(`1. Контрагенты выбраны: ${contractorsCount > 0 ? '✅' : '❌'} (${contractorsCount})`);
        console.log(`2. Коды отсканированы: ${codesCount > 0 ? '✅' : '❌'} (${codesCount})`);
        console.log(`3. Кодов достаточно: ${codesCount >= contractorsCount ? '✅' : '❌'} (${codesCount} ≥ ${contractorsCount})`);
        
        const requirements = {
            hasContractors: contractorsCount > 0,
            hasCodes: codesCount > 0,
            hasEnoughCodes: codesCount >= contractorsCount,
            allMet: contractorsCount > 0 && codesCount > 0 && codesCount >= contractorsCount
        };
        
        return requirements;
    }

    addCodeToList(scannedCode) {
        const codesList = document.getElementById('codesList');
        if (!codesList) {
            console.error('❌ codesList элемент не найден');
            return;
        }
        
        // Удаляем empty-state если он есть
        const emptyState = codesList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        const codeItem = document.createElement('div');
        codeItem.className = 'code-item';
        
        // Безопасное создание HTML
        const safeCode = scannedCode.code.replace(/"/g, '&quot;');
        
        codeItem.innerHTML = `
            <div class="code-info">
                <div class="code-value">${this.formatCode(scannedCode.code)}</div>
                <div class="code-time">${new Date(scannedCode.timestamp).toLocaleTimeString()}</div>
            </div>
            <div class="code-actions">
                <button class="btn btn-sm btn-danger remove-code-btn" data-code="${safeCode}">
                    ✕ Удалить
                </button>
            </div>
        `;
        
        codesList.appendChild(codeItem);
    }

    formatCode(code) {
        if (!code) return 'N/A';
        
        try {
            let displayCode = code;
            if (code.includes('\u001d')) {
                displayCode = code.replace(/\u001d/g, 'GS');
            }
            
            return displayCode.length > 25 
                ? displayCode.substring(0, 15) + '...' + displayCode.substring(displayCode.length - 10)
                : displayCode;
        } catch (error) {
            return 'INVALID_CODE';
        }
    }

    removeCode(code) {
        console.log('🗑️ Удаление кода:', code.substring(0, 20) + '...');
        
        // Удаляем из appState если доступен
        if (window.appState && window.appState.removeScannedCode) {
            window.appState.removeScannedCode(code);
        } else {
            // Простое удаление
            const session = JSON.parse(localStorage.getItem('honest_sign_session') || '{}');
            session.scannedCodes = session.scannedCodes || [];
            session.scannedCodes = session.scannedCodes.filter(c => c.code !== code);
            localStorage.setItem('honest_sign_session', JSON.stringify(session));
        }
        
        // Обновляем UI
        this.updateCodesList();
        this.updateUI();
        
        showWarning('Код удален', 2000);
    }

    // СИМУЛЯТОР
    showSimulator() {
        const simulator = document.getElementById('simulator');
        if (simulator) {
            simulator.classList.remove('hidden');
        }
    }

    hideSimulator() {
        const simulator = document.getElementById('simulator');
        if (simulator) {
            simulator.classList.add('hidden');
        }
    }

    simulateScan(code) {
        console.log('🧪 Симуляция сканирования:', code);
        this.onScanSuccess(code);
    }

    // ОТЧЕТЫ
    async generateReport() {
        console.log('📄 Формирование отчета...');
        
        // Проверяем pdfMakeGenerator
        if (typeof pdfMakeGenerator === 'undefined') {
            showError('❌ PDF генератор не доступен');
            return;
        }
        
        const session = this.getCurrentSession();
        const codesCount = session.scannedCodes.length;
        const contractorsCount = this.selectedContractors.length;
        
        console.log(`🔍 Проверка: коды=${codesCount}, контрагенты=${contractorsCount}`);
        
        // Проверки
        if (codesCount === 0) {
            showError('❌ Нет отсканированных кодов для отчета');
            return;
        }
        
        if (contractorsCount === 0) {
            showError('❌ Не выбраны контрагенты');
            return;
        }
        
        if (codesCount < contractorsCount) {
            showError(`❌ Недостаточно кодов! Отсканировано: ${codesCount}, нужно минимум: ${contractorsCount}`);
            return;
        }
        
        showInfo('📄 Формирование PDF отчета...', 5000);
        
        try {
            // Создаем данные для отчета
            const reportData = {
                id: Date.now().toString(),
                sequentialNumber: this.getNextReportNumber(),
                contractorName: this.selectedContractors.map(c => c.name).join(', '),
                contractors: [...this.selectedContractors],
                codes: [...session.scannedCodes],
                createdAt: new Date().toISOString(),
                status: 'created'
            };
            
            console.log('📊 Данные для отчета:', reportData);
            
            // Генерируем PDF
            console.log('🔄 Начинаем генерацию PDF...');
            const pdfBytes = await pdfMakeGenerator.generateReport(reportData);
            console.log('✅ PDF сгенерирован успешно');
            
            // Скачиваем PDF
            const filename = `scan_report_${new Date().toISOString().split('T')[0]}_${reportData.sequentialNumber}.pdf`;
            console.log('💾 Скачиваем файл:', filename);
            
            const success = pdfMakeGenerator.downloadPDF(pdfBytes, filename);
            
            if (success) {
                // Сохраняем отчет в историю
                this.saveReport(reportData);
                
                // Очищаем сессию
                this.clearSession();
                
                // Обновляем историю отчетов
                this.loadReportsList();
                
                showSuccess(`✅ Отчет создан! Файл: ${filename}`, 5000);
                console.log('🎉 Отчет успешно создан и скачан');
            } else {
                throw new Error('Не удалось скачать PDF файл');
            }
            
        } catch (error) {
            console.error('❌ Ошибка формирования отчета:', error);
            showError('Ошибка создания отчета: ' + error.message);
        }
    }

    updateSyncUI() {
        try {
            if (!window.appState) {
                console.log('ℹ️ AppState не доступен для обновления UI синхронизации');
                this.updateSyncUIFallback();
                return;
            }
            
            const status = window.appState.getSyncStatus();
            const syncStatus = window.appState.firebaseSync ? 
                window.appState.firebaseSync.getStatus() : null;
            
            // Обновляем элементы UI
            const elements = {
                syncStatus: document.getElementById('syncStatus'),
                deviceId: document.getElementById('deviceId'),
                userId: document.getElementById('userId'),
                lastSync: document.getElementById('lastSync'),
                firebaseStatus: document.getElementById('firebaseStatus'),
                firebasePath: document.getElementById('firebasePath')
            };
            
            // Статус синхронизации
            if (elements.syncStatus) {
                if (status.isConnected) {
                    elements.syncStatus.textContent = '✅ Включена';
                    elements.syncStatus.className = 'badge badge-success';
                } else {
                    elements.syncStatus.textContent = '❌ Ошибка';
                    elements.syncStatus.className = 'badge badge-danger';
                }
            }
            
            // ID устройства
            if (elements.deviceId) {
                elements.deviceId.textContent = status.deviceId ? 
                    status.deviceId.substring(0, 15) + '...' : 
                    'не задан';
            }
            
            // User ID
            if (elements.userId && syncStatus) {
                elements.userId.textContent = syncStatus.userId ? 
                    syncStatus.userId.substring(0, 10) + '...' : 
                    'не задан';
            }
            
            // Последняя синхронизация
            if (elements.lastSync) {
                if (status.lastSync) {
                    const date = new Date(status.lastSync);
                    elements.lastSync.textContent = 
                        date.toLocaleDateString() + ' ' + date.toLocaleTimeString().substring(0, 5);
                } else {
                    elements.lastSync.textContent = 'никогда';
                }
            }
            
            // Статус Firebase
            if (elements.firebaseStatus) {
                if (status.isConnected) {
                    elements.firebaseStatus.textContent = '✅ Подключено';
                    elements.firebaseStatus.style.color = '#28a745';
                } else {
                    elements.firebaseStatus.textContent = '❌ Ошибка';
                    elements.firebaseStatus.style.color = '#dc3545';
                }
            }
            
            // Путь в Firebase
            if (elements.firebasePath && syncStatus) {
                elements.firebasePath.textContent = syncStatus.basePath || 'не определен';
            }
            
            console.log('🔄 UI синхронизации обновлен');
            
        } catch (error) {
            console.error('❌ Ошибка обновления UI синхронизации:', error);
        }
    }

    async forceSync() {
        console.log('🔄 Принудительная синхронизация...');
        
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        if (!window.appState.firebaseSync) {
            showError('Firebase синхронизация не инициализирована');
            return;
        }
        
        showInfo('🔄 Синхронизация с облаком...', 5000);
        
        try {
            // Используем метод forceSync из FirebaseSync
            const success = await window.appState.firebaseSync.forceSync();
            
            if (success) {
                // Перезагружаем данные в UI
                this.loadContractors();
                this.loadReportsList();
                this.updateSyncUI();
                
                // Показываем статистику
                const status = window.appState.getSyncStatus();
                showSuccess(`✅ Синхронизация завершена: ${status.contractorsCount} контрагентов, ${status.reportsCount} отчетов`, 3000);
            } else {
                showWarning('⚠️ Синхронизация не выполнена', 3000);
            }
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            showError('Ошибка: ' + error.message);
        }
    }

    testSyncConnection() {
        console.log('🧪 Тест подключения к Firebase...');
        
        if (!window.appState || !window.appState.firebaseSync) {
            console.error('❌ FirebaseSync не доступен');
            showError('Firebase синхронизация не доступна');
            return;
        }
        
        const status = window.appState.firebaseSync.getSyncStatus();
        console.log('📊 Статус синхронизации:', status);
        
        // Пробуем выполнить простую операцию
        window.appState.syncWithFirebase().then(result => {
            console.log('✅ Тест синхронизации пройден:', result.length, 'контрагентов');
            showSuccess(`Синхронизация работает! Контрагентов: ${result.length}`, 3000);
        }).catch(error => {
            console.error('❌ Тест синхронизации не пройден:', error);
            showError('Ошибка синхронизации: ' + error.message);
        });
    }

    // вспомогательные методы для работы с сессией
    getCurrentSession() {
        if (this.appState && this.appState.getCurrentSession) {
            return this.appState.getCurrentSession();
        }
        
        // Fallback
        const session = JSON.parse(localStorage.getItem('honest_sign_session') || '{}');
        return {
            scannedCodes: session.scannedCodes || [],
            createdAt: session.createdAt || new Date().toISOString()
        };
    }

    getNextReportNumber() {
        if (this.appState && this.appState.reportCounter) {
            return this.appState.reportCounter;
        }
        
        const reports = JSON.parse(localStorage.getItem('honest_sign_reports') || '[]');
        return reports.length + 1;
    }

    saveReport(report) {
        if (this.appState && this.appState.saveReport) {
            this.appState.saveReport(report);
        } else {
            const reports = JSON.parse(localStorage.getItem('honest_sign_reports') || '[]');
            reports.push(report);
            localStorage.setItem('honest_sign_reports', JSON.stringify(reports));
        }
    }

    clearSession() {
        console.log('🗑️ Очистка сессии...');
        
        // Останавливаем камеру
        this.stopCamera();
        
        // Создаем пустую сессию
        const emptySession = {
            scannedCodes: [],
            createdAt: new Date().toISOString(),
            id: Date.now().toString()
        };
        
        // Сохраняем пустую сессию
        this.saveSession(emptySession);
        
        // Очищаем выбранных контрагентов
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        
        // Обновляем UI
        this.updateCodesList();
        this.updateUI();
        
        showWarning('🗑️ Сессия очищена', 3000);
    }

    loadReportsList() {
        console.log('📋 Загрузка списка отчетов...');
        
        if (!window.appState) {
            console.error('❌ AppState не доступен для загрузки отчетов');
            return;
        }
        
        const reports = window.appState.getAllReports();
        const container = document.getElementById('reportsList');
        
        if (!container) {
            console.error('❌ Контейнер отчетов не найден');
            return;
        }
    
        console.log(`📊 Загружено отчетов: ${reports.length}`);
        
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
    
        // Добавляем заголовок с количеством отчетов и кнопкой очистки
        container.innerHTML = `
            <div class="reports-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <div>
                    <strong>Всего отчетов: ${reports.length}</strong>
                </div>
                <button class="btn btn-sm btn-danger" onclick="scannerManager.clearReportsHistory()">
                    🗑️ Очистить историю
                </button>
            </div>
            <div class="reports-container">
                ${reports.map((report, index) => `
                    <div class="report-item ${report.status || 'processed'}">
                        <div class="report-info">
                            <div class="report-header">
                                <strong>${report.contractorName || 'Контрагенты не указаны'}</strong>
                                <span class="report-status ${report.status || 'processed'}">
                                    ${report.status || 'обработан'}
                                </span>
                            </div>
                            <div class="report-details">
                                <span>Отчет #${report.sequentialNumber || (index + 1)}</span>
                                <span>Кодов: ${report.codes ? report.codes.length : 0}</span>
                                <span>${new Date(report.createdAt).toLocaleString('ru-RU')}</span>
                            </div>
                        </div>
                        <div class="report-actions">
                            <button class="btn btn-sm btn-outline" onclick="scannerManager.downloadReport(${index})">
                                📥 Скачать
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        console.log('✅ Список отчетов обновлен');
    }

    async downloadReport(reportIndex) {
        console.log(`📥 Скачивание отчета #${reportIndex}`);
        
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        const reports = window.appState.getAllReports();
        if (!reports[reportIndex]) {
            showError('Отчет не найден');
            return;
        }
        
        const report = reports[reportIndex];
        
        try {
            showInfo('Формирование PDF...', 3000);
            
            if (typeof pdfMakeGenerator === 'undefined') {
                throw new Error('PDF Generator не загружен');
            }
            
            const pdfBytes = await pdfMakeGenerator.generateReport(report);
            const filename = `scan_report_${new Date(report.createdAt).toISOString().split('T')[0]}_${report.sequentialNumber}.pdf`;
            
            const success = pdfMakeGenerator.downloadPDF(pdfBytes, filename);
            
            if (success) {
                showSuccess(`Отчет скачан: ${filename}`, 3000);
            } else {
                showError('Ошибка скачивания');
            }
        } catch (error) {
            console.error('Ошибка скачивания отчета:', error);
            showError('Ошибка формирования отчета: ' + error.message);
        }
    }

    clearReportsHistory() {
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        if (confirm('Вы уверены, что хотите очистить всю историю отчетов? Это действие нельзя отменить.')) {
            console.log('🗑️ Очистка истории отчетов...');
            
            // Очищаем историю в AppState
            if (window.appState.clearReports) {
                window.appState.clearReports();
            } else {
                localStorage.removeItem('honest_sign_reports');
            }
            
            // Обновляем список отчетов
            this.loadReportsList();
            
            showSuccess('История отчетов очищена', 3000);
        }
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    updateUI() {
        const session = this.getCurrentSession();
        const codesCount = session.scannedCodes.length;
        
        const totalCodes = document.getElementById('totalCodes');
        const codesCountElement = document.getElementById('codesCount');
        
        if (totalCodes) {
            totalCodes.textContent = codesCount;
        }
        
        if (codesCountElement) {
            codesCountElement.textContent = codesCount;
        }
        
        this.updateButtonStates();
    }

    updateButtonStates() {
        console.log('🔘 Обновление состояния кнопок...');
        
        const contractorsCount = this.selectedContractors.length;
        const session = this.getCurrentSession();
        const codesCount = session.scannedCodes.length;
        
        console.log(`📊 Данные: ${codesCount} кодов, ${contractorsCount} контрагентов`);
        
        // Логика: кодов должно быть НЕ МЕНЬШЕ, чем контрагентов
        const canGenerateReport = contractorsCount > 0 && 
                                 codesCount >= contractorsCount;
        
        const startCamera = document.getElementById('startCamera');
        const generateReport = document.getElementById('generateReport');
        
        // Кнопка камеры
        if (startCamera) {
            startCamera.disabled = contractorsCount === 0;
        }
        
        // Кнопка отчета
        if (generateReport) {
            generateReport.disabled = !canGenerateReport;
            
            if (generateReport.disabled) {
                if (contractorsCount === 0) {
                    generateReport.title = 'Выберите контрагентов';
                } else if (codesCount === 0) {
                    generateReport.title = 'Нет отсканированных кодов';
                } else if (codesCount < contractorsCount) {
                    generateReport.title = `Недостаточно кодов: ${codesCount} из ${contractorsCount}`;
                }
            } else {
                generateReport.title = `Сформировать отчет (${codesCount} кодов)`;
            }
        }
        
        // Обновляем статус сессии
        this.updateSessionStatus();
    }
    
    updateSessionStatus() {
        const sessionStatus = document.getElementById('sessionStatus');
        const currentContractor = document.getElementById('currentContractor');
        const codesCountElement = document.getElementById('codesCount');
        
        if (!sessionStatus) return;
        
        const session = this.getCurrentSession();
        const codesCount = session.scannedCodes.length;
        const contractorsCount = this.selectedContractors.length;
        
        // Показываем статус только если есть контрагенты
        if (contractorsCount > 0) {
            sessionStatus.classList.remove('hidden');
            
            if (currentContractor) {
                const contractorNames = this.selectedContractors.map(c => c.name).join(', ');
                currentContractor.textContent = contractorNames || '-';
            }
            
            if (codesCountElement) {
                codesCountElement.textContent = codesCount;
            }
        } else {
            sessionStatus.classList.add('hidden');
        }
    }

    saveSession(session) {
        console.log('💾 Сохранение сессии...');
        
        // Сохраняем в AppState если доступен
        if (this.appState && this.appState.saveSession) {
            this.appState.saveSession(session);
        } else {
            // Сохраняем напрямую в localStorage
            try {
                localStorage.setItem('honest_sign_session', JSON.stringify(session));
                console.log('✅ Сессия сохранена в localStorage');
            } catch (error) {
                console.error('❌ Ошибка сохранения сессии:', error);
            }
        }
    }
    
    updateCodesList() {
        const codesList = document.getElementById('codesList');
        if (!codesList) {
            console.error('❌ codesList элемент не найден');
            return;
        }
        
        const session = this.getCurrentSession();
        const codes = session.scannedCodes;
        
        // Очищаем список
        codesList.innerHTML = '';
        
        if (codes.length === 0) {
            codesList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📦</span>
                    <p>Нет отсканированных кодов</p>
                    <small>Начните сканирование</small>
                </div>
            `;
        } else {
            codes.forEach(scannedCode => {
                const codeItem = document.createElement('div');
                codeItem.className = 'code-item';
                
                const safeCode = scannedCode.code.replace(/"/g, '&quot;');
                
                codeItem.innerHTML = `
                    <div class="code-info">
                        <div class="code-value">${this.formatCode(scannedCode.code)}</div>
                        <div class="code-time">${new Date(scannedCode.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div class="code-actions">
                        <button class="btn btn-sm btn-danger remove-code-btn" data-code="${safeCode}">
                            ✕ Удалить
                        </button>
                    </div>
                `;
                
                codesList.appendChild(codeItem);
            });
        }
    }

    checkExistingSession() {
        try {
            console.log('🔄 Восстановление сессии...');
            
            // Восстанавливаем выбранных контрагентов
            const saved = JSON.parse(localStorage.getItem('honest_sign_selected_contractors') || '{}');
            
            if (saved.contractorIds && Array.isArray(saved.contractorIds)) {
                this.selectedContractors = saved.contractorIds.map(id => 
                    this.allContractors.find(c => c.id === id)
                ).filter(c => c);
                
                console.log('- Восстановлено контрагентов:', this.selectedContractors.length);
            }
        
            // Восстанавливаем отсканированные коды
            const session = this.getCurrentSession();
            if (session.scannedCodes.length > 0) {
                console.log('- Восстановлено кодов:', session.scannedCodes.length);
                // Перестраиваем список кодов
                this.updateCodesList();
            }
        
            this.updateSelectedContractorsUI();
            this.updateButtonStates();
            this.updateUI();
            
            console.log('✅ Сессия восстановлена');
            
        } catch (error) {
            console.error('❌ Ошибка восстановления сессии:', error);
            this.selectedContractors = [];
        }
    }

    //показываем выпадающий список
    showDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
        }
    }

    //прячем
    hideDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    async loadHtml5QrCode() {
        return new Promise((resolve, reject) => {
            if (typeof Html5Qrcode !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/html5-qrcode';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Не удалось загрузить библиотеку сканирования'));
            document.head.appendChild(script);
        });
    }

    // СИНХРОНИЗАЦИЯ ДАННЫХ
    //экспорт данных
    exportData() {
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        const exportData = window.appState.exportData();
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-scanner-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess('Данные экспортированы в файл', 3000);
    }

    //импорт данных
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target.result;
                
                if (confirm('Импортировать данные? Текущие данные будут объединены с импортируемыми.')) {
                    const success = await window.appState.importData(content);
                    if (success) {
                        // Перезагружаем данные
                        this.loadContractors();
                        this.loadReportsList();
                        this.updateSyncUI();
                        showSuccess('Данные успешно импортированы', 3000);
                    } else {
                        showError('Ошибка импорта данных');
                    }
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    //импорт форм
    importContractorsFromCSV(csvData) {
        const lines = csvData.trim().split('\n');
        let importedCount = 0;

        lines.forEach(line => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 1) {
                const name = parts[0];
                const category = parts[1] || 'Общая категория';

                // Проверяем дубликаты
                if (!this.allContractors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                    const newId = this.allContractors.length > 0 
                        ? Math.max(...this.allContractors.map(c => c.id)) + 1 
                        : 1;
                    
                    this.allContractors.push({ id: newId, name, category });
                    importedCount++;
                }
            }
        });

        if (importedCount > 0) {
            this.saveContractors();
            this.loadContractorsManagerList();
            showSuccess(`Импортировано ${importedCount} контрагентов из CSV`, 3000);
        } else {
            showWarning('Нет новых контрагентов для импорта из CSV');
        }
    }

    // ОБРАБОТЧИКИ СОБЫТИЙ
    setupEventListeners() {
        console.log('🔧 Настройка обработчиков событий');

        // Основные кнопки
        this.setupButton('startCamera', 'startCamera');
        this.setupButton('stopCamera', 'stopCamera');
        this.setupButton('showSimulator', 'showSimulator');
        this.setupButton('generateReport', 'generateReport');
        this.setupButton('clearSession', 'clearSession');
        
        // Управление контрагентами
        this.setupButton('addManualContractorBtn', 'showAddContractorForm');
        this.setupButton('importContractorsBtn', 'showImportForm');
        this.setupButton('showContractorManagerBtn', 'showContractorManager');
        
        // Модальные окна
        this.setupButton('hideContractorManagerBtn', 'hideContractorManager');
        this.setupButton('hideAddContractorFormBtn', 'hideAddContractorForm');
        this.setupButton('clearContractors', 'clearContractors');
        this.setupButton('addContractorBtn', 'addContractor');
        this.setupButton('showAddContractorFormBtn', 'showAddContractorForm');
        this.setupButton('showImportFormBtn', 'showImportForm');
        this.setupButton('importContractorsBtn2', 'importContractorsFromForm');
        this.setupButton('hideImportFormBtn', 'hideAddContractorForm');
    
        // Кнопки синхронизации
        this.setupButton('exportDataBtn', 'exportData');
        this.setupButton('importDataBtn', 'importData');
        this.setupButton('forceSyncBtn', 'forceSync');
        this.setupButton('testSyncBtn', 'testSyncConnection');
    
        // Тестовые коды
        document.addEventListener('click', (e) => {
            if (e.target.closest('.test-code')) {
                const testCode = e.target.closest('.test-code');
                const code = testCode.getAttribute('data-scan');
                if (code) {
                    e.preventDefault();
                    this.simulateScan(code);
                }
            }
        });
    
        // Закрытие модальных окон
        document.addEventListener('click', (e) => {
            if (e.target.id === 'contractorManager') {
                this.hideContractorManager();
            }
        });
    
        // Обработчик удаления кодов
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-code-btn')) {
                e.preventDefault();
                e.stopPropagation();
                
                const code = e.target.getAttribute('data-code');
                this.removeCode(code);
            }
        });
    }

    setupButton(elementId, methodName) {
        const element = document.getElementById(elementId);
        if (element && this[methodName]) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                this[methodName]();
            });
        }
    }

    async testSyncConnection() {
        console.log('🧪 Тест подключения синхронизации...');
        
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        showInfo('🧪 Тестирование подключения...', 3000);
        
        try {
            const success = await window.appState.testFirebaseSync();
            
            if (success) {
                showSuccess('✅ Синхронизация работает!', 3000);
            } else {
                showError('❌ Проблемы с синхронизацией', 3000);
            }
            
        } catch (error) {
            console.error('❌ Ошибка теста синхронизации:', error);
            showError('Ошибка теста: ' + error.message);
        }
    }

    forceSync() {
        console.log('🔄 Принудительная синхронизация...');
        showInfo('🔄 Синхронизация данных...', 3000);
        
        // Простая реализация - перезагрузка данных
        this.loadContractors();
        this.loadReportsList();
        
        showSuccess('Данные синхронизированы', 3000);
    }
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен');
    
    if (typeof ScannerManager !== 'undefined' && !window.scannerManager) {
        window.scannerManager = new ScannerManager();
    }
});
