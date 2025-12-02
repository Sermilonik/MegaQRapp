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
        await this.waitForAppState(); // <-- ЭТОТ МЕТОД БЫЛ ОТСУТСТВУЕТ
        
        // Оптимизация для APK
        this.optimizeForAPK();
        
        // Проверяем и применяем удаленные контрагенты
        await this.checkAndApplyDeleted();
        
        // Загружаем контрагентов (уже отфильтрованных)
        this.loadContractors();
        
        // Восстанавливаем сессию
        this.checkExistingSession();
        
        // Подключаем обработчики (ВАЖНО: сначала UI, потом обработчики)
        this.updateUI();
        
        // Подключаем обработчики событий
        this.setupEventListeners();
        
        // Проверяем камеру
        await this.checkCameraAvailability();
        
        // Загружаем отчеты
        this.loadReportsList();
        
        // Настраиваем синхронизацию
        this.setupSyncDataListeners();
        this.updateSyncUI();
        
        console.log('✅ ScannerManager инициализирован');
        showSuccess('Складской модуль готов к работе', 2000);
    }
    
    // ДОБАВЛЯЕМ ОТСУТСТВУЮЩИЙ МЕТОД waitForAppState
    async waitForAppState() {
        console.log('⏳ Ожидание инициализации AppState...');
        
        // Если AppState уже доступен, возвращаем его
        if (this.appState) {
            console.log('✅ AppState уже доступен');
            return this.appState;
        }
        
        // Ждем инициализации AppState если он еще не готов
        let attempts = 0;
        const maxAttempts = 20; // Увеличим количество попыток
        
        while (!window.appState && attempts < maxAttempts) {
            console.log(`⏳ Ожидание AppState... (попытка ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 300));
            attempts++;
        }
        
        if (window.appState) {
            this.appState = window.appState;
            console.log('✅ AppState загружен через ' + attempts + ' попыток');
        } else {
            console.warn('⚠️ AppState не загружен после ' + maxAttempts + ' попыток, работаем в автономном режиме');
            // Создаем минимальный AppState для работы
            this.createMinimalAppState();
        }
        
        return this.appState;
    }
    
    // Метод для создания минимального AppState если он не загрузился
    createMinimalAppState() {
        console.log('🛠️ Создание минимального AppState для работы...');
        
        this.appState = {
            contractors: [],
            reports: [],
            deviceId: 'local_device_' + Date.now(),
            
            getAllContractors: function() {
                return this.contractors;
            },
            
            getAllReports: function() {
                return this.reports;
            },
            
            saveContractors: function() {
                try {
                    localStorage.setItem('honest_sign_contractors', JSON.stringify(this.contractors));
                    console.log('💾 Контрагенты сохранены локально');
                } catch (error) {
                    console.error('❌ Ошибка сохранения контрагентов:', error);
                }
            },
            
            saveReports: function() {
                try {
                    localStorage.setItem('honest_sign_reports', JSON.stringify(this.reports));
                    console.log('💾 Отчеты сохранены локально');
                } catch (error) {
                    console.error('❌ Ошибка сохранения отчетов:', error);
                }
            },
            
            getCurrentSession: function() {
                const session = JSON.parse(localStorage.getItem('honest_sign_session') || '{}');
                return {
                    scannedCodes: session.scannedCodes || [],
                    createdAt: session.createdAt || new Date().toISOString()
                };
            },
            
            saveSession: function(session) {
                try {
                    localStorage.setItem('honest_sign_session', JSON.stringify(session));
                } catch (error) {
                    console.error('❌ Ошибка сохранения сессии:', error);
                }
            },
            
            getSyncStatus: function() {
                return {
                    isConnected: false,
                    deviceId: this.deviceId,
                    userId: 'local_user',
                    usersCount: '0',
                    lastSync: localStorage.getItem('honest_sign_last_sync') || 'никогда',
                    basePath: 'local/storage'
                };
            }
        };
        
        console.log('✅ Минимальный AppState создан');
    }

    // Исправленный метод setupEventListeners (упрощенная версия)
    setupEventListeners() {
        console.log('🔧 Настройка обработчиков событий');
        
        // Даем немного времени DOM на полную загрузку
        if (document.readyState !== 'complete') {
            console.log('📄 DOM еще не полностью загружен, откладываем настройку обработчиков');
            setTimeout(() => this.setupEventListeners(), 100);
            return;
        }
        
        // Основные кнопки сканирования
        this.setupButton('startCamera', () => this.startCamera());
        this.setupButton('stopCamera', () => this.stopCamera());
        this.setupButton('showSimulator', () => this.showSimulator());
        this.setupButton('generateReport', () => this.generateReport());
        this.setupButton('clearSession', () => this.clearSession());
        
        // Управление контрагентами - ОСНОВНЫЕ КНОПКИ
        this.setupButton('addManualContractorBtn', () => {
            console.log('📝 Кнопка добавления контрагента нажата');
            this.showAddContractorForm();
        });
        
        this.setupButton('importContractorsBtn', () => {
            console.log('📥 Кнопка импорта контрагентов нажата');
            this.showImportForm();
        });
        
        this.setupButton('showContractorManagerBtn', () => {
            console.log('👥 Кнопка менеджера контрагентов нажата');
            this.showContractorManager();
        });
        
        this.setupButton('clearContractors', () => {
            console.log('🗑️ Кнопка очистки контрагентов нажата');
            this.clearContractors();
        });
        
        // Управление удаленными контрагентами
        this.setupButton('syncDeletedBtn', () => {
            console.log('🔄 Кнопка синхронизации удаленных нажата');
            this.syncDeletedContractors();
        });
        
        this.setupButton('clearDeletedBtn', () => {
            console.log('🧹 Кнопка очистки удаленных нажата');
            this.clearDeletedContractorsList();
        });
        
        this.setupButton('showDeletedBtn', () => {
            console.log('👁️ Кнопка показа удаленных нажата');
            this.showDeletedContractors();
        });
        
        this.setupButton('applyDeletedBtn', () => {
            console.log('⚡ Кнопка применения удаленных нажата');
            this.applyDeletedNow();
        });

        // Кнопки в модальном окне управления контрагентами
        this.setupButton('hideContractorManagerBtn', () => {
            console.log('❌ Кнопка закрытия менеджера контрагентов нажата');
            this.hideContractorManager();
        });
        
        this.setupButton('hideAddContractorFormBtn', () => {
            console.log('❌ Кнопка закрытия формы добавления нажата');
            this.hideAddContractorForm();
        });
        
        // Кнопки в форме добавления контрагента
        this.setupButton('addContractorBtn', () => {
            console.log('✅ Кнопка добавления контрагента в форме нажата');
            this.addContractor();
        });
        
        // Кнопки в форме импорта
        this.setupButton('importContractorsBtn2', () => {
            console.log('📥 Кнопка импорта в форме нажата');
            this.importContractorsFromForm();
        });
        
        this.setupButton('hideImportFormBtn', () => {
            console.log('❌ Кнопка закрытия формы импорта нажата');
            this.hideAddContractorForm();
        });
        
        // Переключение между формами в модальном окне
        this.setupButton('showAddContractorFormBtn', () => {
            console.log('📝 Переключение на форму добавления');
            this.showAddContractorForm();
        });
        
        this.setupButton('showImportFormBtn', () => {
            console.log('📥 Переключение на форму импорта');
            this.showImportForm();
        });
        
        // Кнопки синхронизации данных
        this.setupButton('exportDataBtn', () => this.exportData());
        this.setupButton('importDataBtn', () => this.importData());
        this.setupButton('forceSyncBtn', () => this.forceSync());
        this.setupButton('testSyncBtn', () => this.testSyncConnection());
        this.setupButton('showUsersBtn', () => this.showAllUsers());
        this.setupButton('clearFirebaseIdBtn', () => this.clearFirebaseUserId());
    
        // Тестовые коды
        document.addEventListener('click', (e) => {
            if (e.target.closest('.test-code')) {
                const testCode = e.target.closest('.test-code');
                const code = testCode.getAttribute('data-scan');
                if (code) {
                    e.preventDefault();
                    console.log('🧪 Тестовое сканирование:', code);
                    this.simulateScan(code);
                }
            }
        });
    
        // Закрытие модальных окон по клику вне
        document.addEventListener('click', (e) => {
            const managerModal = document.getElementById('contractorManager');
            if (managerModal && e.target === managerModal) {
                console.log('❌ Клик вне модального окна - закрываем');
                this.hideContractorManager();
            }
        });
    
        // Обработчик удаления кодов
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-code-btn')) {
                e.preventDefault();
                e.stopPropagation();
                
                const code = e.target.getAttribute('data-code');
                console.log('🗑️ Удаление кода из UI:', code?.substring(0, 20));
                this.removeCode(code);
            }
        });
        
        console.log('✅ Все обработчики событий настроены');
    }

    // Улучшенный метод для настройки обработчиков кнопок
    setupButton(elementId, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`✅ Настроен обработчик для кнопки: ${elementId}`);
            
            // Удаляем старые обработчики
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            
            // Добавляем новый обработчик
            newElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🖱️ Кнопка нажата: ${elementId}`);
                handler();
            });
            
            return true;
        } else {
            console.warn(`⚠️ Кнопка не найдена: ${elementId}`);
            return false;
        }
    }

    // ДОПОЛНИТЕЛЬНО: Упрощенная проверка кнопок (для отладки)
    checkAllButtons() {
        console.log('🔍 Проверка всех кнопок...');
        
        const allButtons = [
            'addManualContractorBtn', 'importContractorsBtn', 'showContractorManagerBtn', 'clearContractors',
            'syncDeletedBtn', 'clearDeletedBtn', 'showDeletedBtn', 'applyDeletedBtn',
            'hideContractorManagerBtn', 'hideAddContractorFormBtn', 'addContractorBtn',
            'importContractorsBtn2', 'hideImportFormBtn', 'showAddContractorFormBtn', 'showImportFormBtn',
            'startCamera', 'stopCamera', 'showSimulator', 'generateReport', 'clearSession',
            'exportDataBtn', 'importDataBtn', 'forceSyncBtn', 'testSyncBtn', 'showUsersBtn', 'clearFirebaseIdBtn'
        ];
        
        allButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (!btn) {
                console.error(`❌ Кнопка не найдена в DOM: ${btnId}`);
            }
        });
        
        console.log('✅ Проверка кнопок завершена');
    }
    
    // Остальной код оставляем БЕЗ ИЗМЕНЕНИЙ...
    // ... все остальные методы остаются как были ...
}

// Улучшенная инициализация с обработкой ошибок
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен, начинаем инициализацию ScannerManager');
    
    // Небольшая задержка для гарантии полной загрузки всех скриптов
    setTimeout(function() {
        try {
            if (typeof ScannerManager !== 'undefined') {
                console.log('🚀 Создаем новый экземпляр ScannerManager');
                window.scannerManager = new ScannerManager();
            } else {
                console.error('❌ ScannerManager не определен');
                // Пробуем загрузить еще раз
                setTimeout(function() {
                    if (typeof ScannerManager !== 'undefined') {
                        window.scannerManager = new ScannerManager();
                    } else {
                        console.error('❌ ScannerManager все еще не определен');
                        showError('Не удалось загрузить ScannerManager');
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('❌ Критическая ошибка при инициализации ScannerManager:', error);
            showError('Ошибка загрузки приложения: ' + error.message);
        }
    }, 1500); // Увеличиваем задержку
});

// Дополнительная инициализация при полной загрузке страницы
window.addEventListener('load', function() {
    console.log('🔄 Страница полностью загружена');
    
    // Если ScannerManager еще не создан, создаем
    if (!window.scannerManager && typeof ScannerManager !== 'undefined') {
        console.log('🚀 Создаем ScannerManager после полной загрузки');
        try {
            window.scannerManager = new ScannerManager();
        } catch (error) {
            console.error('❌ Ошибка при создании ScannerManager:', error);
        }
    }
});

// Глобальный метод для ручной инициализации
window.initScannerManager = function() {
    console.log('🔧 Ручная инициализация ScannerManager');
    if (typeof ScannerManager !== 'undefined') {
        try {
            window.scannerManager = new ScannerManager();
            return window.scannerManager;
        } catch (error) {
            console.error('❌ Ошибка ручной инициализации:', error);
            return null;
        }
    } else {
        console.error('❌ ScannerManager не определен');
        return null;
    }
};

// Проверка доступности кнопок через 3 секунды после загрузки
setTimeout(function() {
    if (window.scannerManager && window.scannerManager.checkAllButtons) {
        window.scannerManager.checkAllButtons();
    }
}, 3000);
