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
        console.log('🔍 Загрузка контрагентов');
        
        try {
            const saved = localStorage.getItem('honest_sign_contractors');
            
            if (saved) {
                this.allContractors = JSON.parse(saved);
                console.log(`✅ Загружено ${this.allContractors.length} контрагентов`);
            } else {
                this.loadDefaultContractors();
                this.saveContractors();
                console.log('✅ Загружены контрагенты по умолчанию');
            }
            
            this._contractorsLoaded = true;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            this.loadDefaultContractors();
        }
        
        this.initContractorSearch();
    }

    loadDefaultContractors() {
        this.allContractors = [
            { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель' },
            { id: 2, name: 'ИП Иванов', category: 'Розничная сеть' },
            { id: 3, name: 'ООО "Луч"', category: 'Дилер' },
            { id: 4, name: 'АО "Вектор"', category: 'Партнер' }
        ];
    }

    saveContractors() {
        try {
            localStorage.setItem('honest_sign_contractors', JSON.stringify(this.allContractors));
            console.log(`💾 Сохранено ${this.allContractors.length} контрагентов`);
        } catch (error) {
            console.error('❌ Ошибка сохранения контрагентов:', error);
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
            // Останавливаем предыдущую камеру
            await this.stopCamera();

            // Проверяем библиотеку
            if (typeof Html5Qrcode === 'undefined') {
                await this.loadHtml5QrCode();
            }

            const container = document.getElementById('reader');
            if (!container) throw new Error('Контейнер не найден');

            // Очищаем контейнер
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
                    console.log('✅ QR-код распознан:', decodedText);
                    this.onScanSuccess(decodedText);
                },
                (error) => {
                    // Игнорируем ошибки сканирования
                    if (!error.includes('NotFoundException')) {
                        console.log('📷 Ошибка сканирования:', error);
                    }
                }
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
        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }

        // Проверяем дубликаты через appState
        if (appState && appState.hasCodeBeenScanned(decodedText)) {
            showWarning('⚠️ Этот код уже отсканирован');
            return;
        }

        const scannedCode = {
            code: decodedText,
            timestamp: new Date().toISOString(),
            contractors: this.selectedContractors.map(c => ({ id: c.id, name: c.name }))
        };
        
        // Сохраняем через appState
        if (appState) {
            appState.addScannedCode(decodedText);
        }
        
        this.addCodeToList(scannedCode);
        this.updateUI();
        
        showSuccess(`✅ Код добавлен`, 2000);
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
            // Восстанавливаем выбранных контрагентов
            const saved = JSON.parse(localStorage.getItem('honest_sign_selected_contractors') || '{}');
            
            if (saved.contractorIds && Array.isArray(saved.contractorIds)) {
                this.selectedContractors = saved.contractorIds.map(id => 
                    this.allContractors.find(c => c.id === id)
                ).filter(c => c);
            }

            // Восстанавливаем отсканированные коды через appState
            if (appState) {
                const session = appState.getCurrentSession();
                if (session.scannedCodes.length > 0) {
                    session.scannedCodes.forEach(code => this.addCodeToList(code));
                }
            }

            this.updateSelectedContractorsUI();
            this.updateButtonStates();
            this.updateUI();
            
        } catch (error) {
            console.error('❌ Ошибка восстановления сессии:', error);
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
        
        // Модальные окна
        this.setupButton('hideContractorManager', 'hideContractorManager');
        this.setupButton('hideAddContractorForm', 'hideAddContractorForm');
        this.setupButton('clearContractors', 'clearContractors');
        this.setupButton('addContractor', 'addContractor');

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

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен');
    
    if (typeof ScannerManager !== 'undefined' && !window.scannerManager) {
        window.scannerManager = new ScannerManager();
    }
});
