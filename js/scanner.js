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
        this.cleaningUp = false;
        this._stopInProgress = false;
        this._contractorsLoaded = false;
        this.apkMode = false;

        // Запускаем инициализацию
        this.init();
    }

    async init() {
        console.log('🔧 Инициализация ScannerManager');
        
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
        
        // Обновляем UI синхронизации
        setTimeout(() => {
            this.updateSyncUI();
        }, 3000);
        
        console.log('✅ ScannerManager инициализирован');
        showSuccess('Складской модуль готов к работе', 2000);
    }

    // ОПТИМИЗАЦИЯ ДЛЯ APK
    optimizeForAPK() {
        const isInAPK = !window.location.protocol.startsWith('http');
        const isWebView = /WebView|Android/.test(navigator.userAgent);
        
        if (isInAPK || isWebView) {
            console.log('📱 APK режим активирован');
            this.apkMode = true;
        }
    }

    // ЗАГРУЗКА КОНТРАГЕНТОВ
    loadContractors() {
        console.log('🔍 ScannerManager: Загрузка контрагентов');
        
        // Ждем инициализации AppState
        if (window.appState && window.appState.getAllContractors) {
            this.allContractors = window.appState.getAllContractors();
            console.log(`✅ ScannerManager: Загружено ${this.allContractors.length} контрагентов из AppState`);
        } else {
            console.warn('⚠️ ScannerManager: AppState не доступен, загружаем напрямую из localStorage');
            
            // Пробуем инициализировать AppState если он есть
            if (typeof AppState !== 'undefined' && !window.appState) {
                console.log('🔄 ScannerManager: Пробуем создать AppState...');
                window.appState = new AppState();
                this.allContractors = window.appState.getAllContractors();
                console.log(`✅ ScannerManager: Создан AppState, загружено ${this.allContractors.length} контрагентов`);
            } else {
                // Резервный метод
                this.loadContractorsDirectly();
            }
        }
        
        this._contractorsLoaded = true;
        this.initContractorSearch();
    }

    // Резервный метод загрузки напрямую из localStorage
    loadContractorsDirectly() {
        try {
            const saved = localStorage.getItem('honest_sign_contractors');
            if (saved) {
                this.allContractors = JSON.parse(saved);
                console.log(`✅ ScannerManager: Загружено ${this.allContractors.length} контрагентов напрямую из localStorage`);
            } else {
                this.loadDefaultContractors();
                this.saveContractorsDirectly();
            }
        } catch (error) {
            console.error('❌ ScannerManager: Ошибка прямой загрузки контрагентов:', error);
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

    // Резервный метод сохранения напрямую в localStorage
    saveContractorsDirectly() {
        try {
            localStorage.setItem('honest_sign_contractors', JSON.stringify(this.allContractors));
            console.log(`✅ ScannerManager: Сохранено ${this.allContractors.length} контрагентов напрямую в localStorage`);
        } catch (error) {
            console.error('❌ ScannerManager: Ошибка прямого сохранения контрагентов:', error);
        }
    }

    saveContractors() {
        console.log('💾 ScannerManager: Сохранение контрагентов');
        
        if (window.appState && window.appState.saveContractors) {
            // Обновляем данные в appState перед сохранением
            if (window.appState.contractors) {
                window.appState.contractors = this.allContractors;
            }
            window.appState.saveContractors();
            console.log('✅ ScannerManager: Контрагенты сохранены через AppState');
        } else {
            console.warn('⚠️ ScannerManager: AppState не доступен, сохраняем напрямую');
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

    // Импорт контрагентов из формы
    importContractorsFromForm() {
        const importData = document.getElementById('importData');
        if (!importData || !importData.value.trim()) {
            showError('Введите данные для импорта');
            return;
        }

        if (window.appState && window.appState.importContractorsFromCSV) {
            try {
                const importedCount = window.appState.importContractorsFromCSV(importData.value);
                if (importedCount > 0) {
                    this.loadContractors(); // Перезагружаем контрагентов
                    this.loadContractorsManagerList(); // Обновляем список в менеджере
                    importData.value = ''; // Очищаем поле
                    this.hideAddContractorForm();
                }
            } catch (error) {
                showError(`Ошибка импорта: ${error.message}`);
            }
        } else {
            showError('AppState не доступен для импорта');
        }
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
        const nameInput = document.getElementById('contractorName');
        const categoryInput = document.getElementById('contractorCategory');
        
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
                fps: 5, // Меньше FPS = меньше ошибок
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
    
            // Улучшенный обработчик ошибок
            const verbose = false; // Убираем лишние логи
            
            await this.scanner.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    console.log('✅ Код распознан:', decodedText);
                    this.onScanSuccess(decodedText);
                },
                (error) => {
                    // Фильтруем только важные ошибки
                    if (!error.includes('NotFoundException') && 
                        !error.includes('No barcode') &&
                        !error.includes('No MultiFormat')) {
                        console.log('📷 Ошибка сканирования:', error);
                    }
                },
                verbose // Отключаем подробное логирование
            );
    
            this.isScanning = true;
            this.updateCameraUI();
            showSuccess('📷 Камера запущена!', 3000);
    
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
        console.log('🔍 Обработка сканированного кода:', decodedText);
        
        if (!this.isValidCodeFormat(decodedText)) {
            showError('❌ Неподдерживаемый формат кода');
            return;
        }
        
        // Сначала проверяем, это ли данные синхронизации
        if (this.handleSyncQRCode(decodedText)) {
            return;
        }
        
        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }
    
        // Детальная проверка дубликатов
        if (window.appState && window.appState.hasCodeBeenScanned) {
            const isDuplicate = window.appState.hasCodeBeenScanned(decodedText);
            console.log(`🔍 Проверка дубликата: ${decodedText} - ${isDuplicate ? 'ДУБЛИКАТ' : 'НОВЫЙ'}`);
            
            if (isDuplicate) {
                showWarning('⚠️ Этот код уже отсканирован');
                return;
            }
        }
    
        const scannedCode = {
            code: decodedText,
            timestamp: new Date().toISOString(),
            contractors: this.selectedContractors.map(c => ({ id: c.id, name: c.name }))
        };
        
        console.log('💾 Добавление кода в AppState:', scannedCode);
        
        if (window.appState) {
            window.appState.addScannedCode(decodedText);
        }
        
        this.addCodeToList(scannedCode);
        this.updateUI();
        
        showSuccess(`✅ Код добавлен: ${this.formatCode(decodedText)}`, 2000);
        
        // Виброотклик на мобильных (если поддерживается)
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    }

    // метод проверки форматов
    isValidCodeFormat(code) {
        // Проверяем, что код не пустой и имеет минимальную длину
        if (!code || code.length < 5) {
            console.log('❌ Слишком короткий код:', code);
            return false;
        }
        
        // Проверяем на базовые форматы
        const patterns = [
            /^[0-9A-Za-z]{10,}$/, // Обычные QR/DataMatrix
            /^01\d{14}21[A-Za-z0-9]{13,}$/, // GS1 DataMatrix
            /^[A-Za-z0-9+/=]{20,}$/, // Base64-like коды
        ];
        
        const isValid = patterns.some(pattern => pattern.test(code));
        
        if (!isValid) {
            console.log('❌ Неподдерживаемый формат кода:', code);
        }
        
        return isValid;
    }

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
        return code.length > 25 
            ? code.substring(0, 15) + '...' + code.substring(code.length - 10)
            : code;
    }

    removeCode(code) {
        if (appState) {
            appState.removeScannedCode(code);
        }
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
    generateReport() {
        if (!appState) {
            showError('❌ AppState не доступен');
            return;
        }

        const session = appState.getCurrentSession();
        
        if (session.scannedCodes.length === 0) {
            showError('❌ Нет кодов для отчета');
            return;
        }

        if (this.selectedContractors.length === 0) {
            showError('❌ Нет выбранных контрагентов');
            return;
        }

        const report = {
            id: Date.now(),
            contractorName: this.selectedContractors.map(c => c.name).join(', '),
            contractors: [...this.selectedContractors],
            codes: [...session.scannedCodes],
            createdAt: new Date().toISOString(),
            status: 'pending'
        };

        appState.saveReport(report);
        showSuccess(`✅ Отчет создан! Кодов: ${session.scannedCodes.length}`, 5000);
        
        // Очищаем сессию
        this.clearSession();
        
        // Обновляем список отчетов
        this.loadReportsList();
    }

    clearSession() {
        this.stopCamera();
        if (appState) {
            appState.clearCurrentSession();
        }
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        this.updateUI();
        showWarning('🗑️ Сессия очищена', 3000);
    }

    loadReportsList() {
        if (!appState) return;
        
        const reports = appState.getAllReports();
        const container = document.getElementById('reportsList');
        
        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📄</span>
                    <p>Нет отчетов</p>
                </div>
            `;
            return;
        }

        container.innerHTML = reports.map(report => `
            <div class="report-item">
                <div class="report-info">
                    <div class="report-header">
                        <strong>${report.contractorName}</strong>
                        <span class="report-status ${report.status}">${report.status}</span>
                    </div>
                    <div class="report-details">
                        <span>Кодов: ${report.codes.length}</span>
                        <span>${new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    updateUI() {
        if (!appState) return;
        
        const session = appState.getCurrentSession();
        const codesCount = session.scannedCodes.length;
        
        const totalCodes = document.getElementById('totalCodes');
        const codesCountElement = document.getElementById('codesCount');
        
        if (totalCodes) totalCodes.textContent = codesCount;
        if (codesCountElement) codesCountElement.textContent = codesCount;
        
        this.updateButtonStates();
        this.updateCodesList();
    }

    updateButtonStates() {
        const hasContractors = this.selectedContractors.length > 0;
        const hasCodes = appState && appState.getCurrentSession().scannedCodes.length > 0;
        
        const startCamera = document.getElementById('startCamera');
        const generateReport = document.getElementById('generateReport');
        
        if (startCamera) startCamera.disabled = !hasContractors;
        if (generateReport) generateReport.disabled = !hasContractors || !hasCodes;
    }

    updateCodesList() {
        if (!appState) return;
        
        const codesList = document.getElementById('codesList');
        const codes = appState.getCurrentSession().scannedCodes;
        
        if (codes.length === 0) {
            codesList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📦</span>
                    <p>Нет отсканированных кодов</p>
                </div>
            `;
        }
    }

    checkExistingSession() {
        try {
            console.log('🔄 ScannerManager: Восстановление сессии...');
            
            // Восстанавливаем выбранных контрагентов
            const saved = JSON.parse(localStorage.getItem('honest_sign_selected_contractors') || '{}');
            console.log('- Сохраненные выбранные контрагенты:', saved);
            
            if (saved.contractorIds && Array.isArray(saved.contractorIds)) {
                this.selectedContractors = saved.contractorIds.map(id => 
                    this.allContractors.find(c => c.id === id)
                ).filter(c => c);
                
                console.log('- Восстановлено контрагентов:', this.selectedContractors.length);
            }
    
            // Восстанавливаем отсканированные коды через appState если доступен
            if (window.appState && window.appState.getCurrentSession) {
                const session = window.appState.getCurrentSession();
                if (session.scannedCodes.length > 0) {
                    session.scannedCodes.forEach(code => this.addCodeToList(code));
                    this.updateUI();
                }
            }
    
            this.updateSelectedContractorsUI();
            this.updateButtonStates();
            this.updateUI();
            
            console.log('✅ ScannerManager: Сессия восстановлена');
            
        } catch (error) {
            console.error('❌ ScannerManager: Ошибка восстановления сессии:', error);
            this.selectedContractors = [];
        }
    }

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
    exportData() {
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        const exportData = window.appState.exportForSync();
        
        // Создаем файл для скачивания
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contractors-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showSuccess('Данные экспортированы в файл', 3000);
    }

    // СИНХРОНИЗАЦИЯ ДАННЫХ
    async forceSync() {
        console.log('🔄 Принудительная синхронизация...');
        
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        showInfo('🔄 Синхронизация с облаком...', 3000);
        
        try {
            const syncedContractors = await window.appState.syncWithFirebase();
            
            if (syncedContractors) {
                // Обновляем локальные данные
                this.allContractors = syncedContractors;
                this.loadContractorsManagerList();
                this.updateSelectedContractorsUI();
                
                showSuccess(`✅ Синхронизировано ${syncedContractors.length} контрагентов`, 5000);
                this.updateSyncUI();
            }
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            showError('Ошибка синхронизации: ' + error.message);
        }
    }

    toggleSync() {
        if (!window.appState || !window.appState.firebaseSync) {
            showError('Firebase синхронизация не доступна');
            return;
        }
        
        const currentStatus = window.appState.firebaseSync.syncEnabled;
        window.appState.firebaseSync.setSyncEnabled(!currentStatus);
        
        showSuccess(`Автосинхронизация ${!currentStatus ? 'включена' : 'выключена'}`, 3000);
        this.updateSyncUI();
    }

    updateSyncUI() {
        if (!window.appState || !window.appState.firebaseSync) return;
        
        const status = window.appState.firebaseSync.getSyncStatus();
        const syncStatus = document.getElementById('syncStatus');
        const firebaseStatus = document.getElementById('firebaseStatus');
        const deviceId = document.getElementById('deviceId');
        const toggleBtn = document.getElementById('toggleSyncBtn');
        const forceSyncBtn = document.getElementById('forceSyncBtn');
        
        if (syncStatus) {
            if (status.isConnected && status.syncEnabled) {
                syncStatus.textContent = '✅ Включена';
                syncStatus.className = 'badge badge-success';
            } else if (status.isConnected) {
                syncStatus.textContent = '⏸️ Выключена';
                syncStatus.className = 'badge badge-warning';
            } else {
                syncStatus.textContent = '❌ Ошибка';
                syncStatus.className = 'badge badge-danger';
            }
        }
        
        if (firebaseStatus) {
            firebaseStatus.textContent = status.isConnected ? '✅ Подключено' : '❌ Ошибка';
            firebaseStatus.style.color = status.isConnected ? '#28a745' : '#dc3545';
        }
        
        if (deviceId) {
            deviceId.textContent = status.userId ? status.userId.substring(0, 10) + '...' : '-';
        }
        
        if (toggleBtn) {
            toggleBtn.textContent = status.syncEnabled ? '⏸️ Выключить синхронизацию' : '⚡ Включить синхронизацию';
        }
        
        if (forceSyncBtn) {
            forceSyncBtn.disabled = !status.isConnected;
        }
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                
                if (file.name.endsWith('.json')) {
                    // Импорт JSON
                    if (window.appState && window.appState.manualImport) {
                        window.appState.manualImport(content);
                    }
                } else if (file.name.endsWith('.csv')) {
                    // Импорт CSV
                    if (window.appState && window.appState.importContractorsFromCSV) {
                        window.appState.importContractorsFromCSV(content);
                    }
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    showQRCode() {
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        window.appState.syncWithQRCode();
    }

    scanQRCode() {
        showInfo('Для сканирования QR-кода используйте основную камеру сканирования', 5000);
        this.startCamera();
    }

    // Обработка сканированных QR-кодов синхронизации
    handleSyncQRCode(decodedText) {
        try {
            // Проверяем, это ли данные синхронизации
            const data = JSON.parse(decodedText);
            
            if (data.contractors && data.timestamp) {
                if (confirm(`Импортировать ${data.contractors.length} контрагентов?`)) {
                    if (window.appState && window.appState.importFromQRCode) {
                        window.appState.importFromQRCode(decodedText);
                        this.loadContractors(); // Перезагружаем контрагентов
                        this.loadContractorsManagerList(); // Обновляем список
                    }
                }
                return true;
            }
        } catch (error) {
            // Не JSON данные, значит обычный QR-код
            console.log('Обычный QR-код, не данные синхронизации');
            return false;
        }
        
        return false;
    }

    // Принудительное выравнивание данных с облаком
    forceDataAlignment() {
        console.log('🔄 Принудительное выравнивание данных...');
        
        if (!window.appState) {
            showError('AppState не доступен');
            return;
        }
        
        showInfo('🔄 Выравнивание данных с облаком...', 5000);
        
        try {
            // 1. Очищаем локальные данные
            localStorage.removeItem('honest_sign_contractors');
            console.log('✅ Локальные данные очищены');
            
            // 2. Перезагружаем AppState
            window.appState.loadContractors();
            console.log('✅ AppState перезагружен');
            
            // 3. Синхронизируем с Firebase
            window.appState.syncWithFirebase().then((result) => {
                // 4. Обновляем ScannerManager
                this.allContractors = result;
                this.loadContractorsManagerList();
                this.updateSelectedContractorsUI();
                
                showSuccess(`✅ Данные выровнены с облаком: ${result.length} контрагентов`, 5000);
                console.log('✅ Выравнивание завершено');
            });
            
        } catch (error) {
            console.error('❌ Ошибка выравнивания данных:', error);
            showError('Ошибка выравнивания: ' + error.message);
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
        this.setupButton('hideContractorManager', 'hideContractorManager');
        this.setupButton('hideAddContractorForm', 'hideAddContractorForm');
        this.setupButton('clearContractors', 'clearContractors');
        this.setupButton('addContractor', 'addContractor');
        this.setupButton('showAddContractorFormBtn', 'showAddContractorForm');
        this.setupButton('showImportFormBtn', 'showImportForm');
        this.setupButton('importContractors', 'importContractorsFromForm');
        this.setupButton('hideImportForm', 'hideAddContractorForm');
    
        // ДОБАВЬТЕ ЭТИ СТРОКИ для кнопок синхронизации
        this.setupSyncButton('exportData');
        this.setupSyncButton('importData'); 
        this.setupSyncButton('showQRCode');
        this.setupSyncButton('scanQRCode');
    
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
    }
    
    // ВЫНЕСИТЕ ЭТОТ МЕТОД ОТДЕЛЬНО - он должен быть на том же уровне, что и setupEventListeners
    setupSyncButton(methodName) {
        // Ищем кнопки с onclick атрибутом
        const buttons = document.querySelectorAll(`[onclick*="${methodName}"]`);
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                if (this[methodName]) {
                    this[methodName]();
                }
            });
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
}

// Глобальная функция для тестирования синхронизации
function testSync() {
    if (window.appState && window.appState.firebaseSync) {
        console.log('🧪 Тест синхронизации...');
        window.appState.syncWithFirebase().then(result => {
            console.log('✅ Результат синхронизации:', result);
        });
    } else {
        console.error('❌ AppState или FirebaseSync не доступны');
    }
}

// Сделать функцию глобально доступной
window.testSync = testSync;

function forceDataAlignment() {
    if (window.scannerManager) {
        window.scannerManager.forceDataAlignment();
    } else {
        console.error('❌ ScannerManager не доступен');
    }
}

// Сделать функцию глобально доступной
window.forceDataAlignment = forceDataAlignment;

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен');
    
    if (typeof ScannerManager !== 'undefined' && !window.scannerManager) {
        window.scannerManager = new ScannerManager();
    }
});
