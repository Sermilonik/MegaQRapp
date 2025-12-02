// app-state.js
class AppState {
    constructor() {
        console.log('🚀 Создание AppState');
        
        // Проверяем, не создан ли уже экземпляр
        if (window.appState) {
            console.log('⚠️ AppState уже существует, возвращаем существующий');
            return window.appState;
        }
        
        // Инициализируем свойства
        this.contractors = [];
        this.reports = [];
        this.currentSession = null;
        this.firebaseSync = null;
        this.isInitialized = false;
        this.deviceId = null;
        
        // Сохраняем глобальную ссылку
        window.appState = this;
        
        // Начинаем инициализацию
        this.init();
    }
    
    async init() {
        console.log('🔧 Инициализация AppState...');
        
        try {
            // 1. Генерируем/получаем ID устройства
            this.deviceId = this.getOrCreateDeviceId();
            console.log('📱 ID устройства:', this.deviceId);
            
            // 2. Загружаем данные из localStorage
            this.loadAllData();
            
            // 3. Инициализируем Firebase
            await this.initFirebase();
            
            // 4. Отмечаем как инициализированный
            this.isInitialized = true;
            
            console.log('✅ AppState инициализирован');
            console.log(`📊 Данные: ${this.contractors.length} контрагентов, ${this.reports.length} отчетов`);
            
        } catch (error) {
            console.error('❌ Ошибка инициализации AppState:', error);
            this.isInitialized = false;
        }
    }
    
    getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('honest_sign_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('honest_sign_device_id', deviceId);
        }
        return deviceId;
    }
    
    loadAllData() {
        console.log('📂 Загрузка всех данных...');
        
        // Загружаем контрагентов
        try {
            const savedContractors = localStorage.getItem('honest_sign_contractors');
            if (savedContractors) {
                this.contractors = JSON.parse(savedContractors);
                console.log(`✅ Загружено ${this.contractors.length} контрагентов`);
            } else {
                this.loadDefaultContractors();
                console.log('📝 Созданы контрагенты по умолчанию');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            this.loadDefaultContractors();
        }
        
        // Загружаем сессию
        try {
            const savedSession = localStorage.getItem('honest_sign_session');
            if (savedSession) {
                this.currentSession = JSON.parse(savedSession);
                console.log('✅ Сессия загружена');
            } else {
                this.currentSession = this.createNewSession();
                console.log('🆕 Создана новая сессия');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки сессии:', error);
            this.currentSession = this.createNewSession();
        }
        
        // Загружаем отчеты
        try {
            const savedReports = localStorage.getItem('honest_sign_reports');
            if (savedReports) {
                this.reports = JSON.parse(savedReports);
                console.log(`✅ Загружено ${this.reports.length} отчетов`);
            } else {
                this.reports = [];
                console.log('ℹ️ Нет сохраненных отчетов');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки отчетов:', error);
            this.reports = [];
        }
    }
    
    createNewSession() {
        return {
            id: 'session_' + Date.now(),
            scannedCodes: [],
            selectedContractors: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
    
    loadDefaultContractors() {
        this.contractors = [
            { 
                id: 1, 
                name: 'ООО "Ромашка"', 
                category: 'Оптовый покупатель',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deviceId: this.deviceId
            },
            { 
                id: 2, 
                name: 'ИП Иванов', 
                category: 'Розничная сеть',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deviceId: this.deviceId
            },
            { 
                id: 3, 
                name: 'ООО "Луч"', 
                category: 'Дилер',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deviceId: this.deviceId
            },
            { 
                id: 4, 
                name: 'АО "Вектор"', 
                category: 'Партнер',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deviceId: this.deviceId
            }
        ];
        this.saveContractors();
    }
    
    async initFirebase() {
        try {
            console.log('🔥 Инициализация Firebase...');
            
            if (typeof firebase === 'undefined') {
                console.log('ℹ️ Firebase не загружен');
                return;
            }
            
            // Уже инициализирован в firebase-config.js
            if (!firebase.apps.length) {
                console.log('⚠️ Firebase не инициализирован');
                return;
            }
            
            console.log('✅ Firebase уже инициализирован');
            
            // Инициализируем FirebaseSync если доступен
            if (typeof FirebaseSync !== 'undefined') {
                this.firebaseSync = new FirebaseSync(this);
                const success = await this.firebaseSync.init();
                
                if (success) {
                    console.log('✅ FirebaseSync инициализирован');
                    
                    // Синхронизируем данные
                    setTimeout(() => {
                        this.syncWithFirebase();
                    }, 1000);
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка инициализации Firebase:', error);
        }
    }
    
    async syncWithFirebase() {
        if (!this.firebaseSync) {
            console.log('ℹ️ FirebaseSync не доступен');
            return;
        }
        
        try {
            console.log('🔄 Синхронизация с Firebase...');
            
            // Синхронизируем контрагентов
            if (this.firebaseSync.syncContractors) {
                const syncedContractors = await this.firebaseSync.syncContractors(this.contractors);
                if (syncedContractors && syncedContractors.length > 0) {
                    this.contractors = syncedContractors;
                    this.saveContractors();
                    console.log(`✅ Контрагенты синхронизированы: ${this.contractors.length}`);
                }
            }
            
            // Обновляем время последней синхронизации
            localStorage.setItem('honest_sign_last_sync', new Date().toISOString());
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
        }
    }
    
    // ========== ОСНОВНЫЕ МЕТОДЫ ==========
    
    // Контрагенты
    getAllContractors() {
        return this.contractors;
    }
    
    saveContractors() {
        try {
            localStorage.setItem('honest_sign_contractors', JSON.stringify(this.contractors));
            console.log(`✅ Сохранено ${this.contractors.length} контрагентов`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения контрагентов:', error);
            return false;
        }
    }
    
    // Сессия
    getCurrentSession() {
        if (!this.currentSession) {
            this.currentSession = this.createNewSession();
        }
        return this.currentSession;
    }
    
    saveSession(session = null) {
        try {
            if (session) {
                this.currentSession = session;
            }
            this.currentSession.updatedAt = new Date().toISOString();
            localStorage.setItem('honest_sign_session', JSON.stringify(this.currentSession));
            console.log('✅ Сессия сохранена');
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения сессии:', error);
            return false;
        }
    }
    
    // Отчеты
    getAllReports() {
        return this.reports;
    }
    
    saveReport(report) {
        try {
            this.reports.unshift(report);
            if (this.reports.length > 50) {
                this.reports = this.reports.slice(0, 50);
            }
            localStorage.setItem('honest_sign_reports', JSON.stringify(this.reports));
            console.log(`✅ Отчет сохранен, всего: ${this.reports.length}`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения отчета:', error);
            return false;
        }
    }
    
    clearReports() {
        this.reports = [];
        localStorage.removeItem('honest_sign_reports');
        console.log('✅ Отчеты очищены');
    }
    
    // Синхронизация
    getSyncStatus() {
        const lastSync = localStorage.getItem('honest_sign_last_sync');
        const syncEnabled = localStorage.getItem('honest_sign_sync_enabled') !== 'false';
        
        return {
            isConnected: this.firebaseSync ? this.firebaseSync.isConnected : false,
            syncEnabled: syncEnabled,
            deviceId: this.deviceId,
            lastSync: lastSync,
            contractorsCount: this.contractors.length,
            reportsCount: this.reports.length
        };
    }
    
    toggleSync() {
        const current = localStorage.getItem('honest_sign_sync_enabled') !== 'false';
        const newValue = !current;
        localStorage.setItem('honest_sign_sync_enabled', newValue.toString());
        
        if (newValue && this.firebaseSync) {
            this.syncWithFirebase();
        }
        
        return newValue;
    }
    
    // Экспорт/Импорт
    exportData() {
        const data = {
            contractors: this.contractors,
            reports: this.reports,
            currentSession: this.currentSession,
            deviceId: this.deviceId,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        return JSON.stringify(data, null, 2);
    }
    
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            let imported = 0;
            
            // Импортируем контрагентов
            if (data.contractors && Array.isArray(data.contractors)) {
                data.contractors.forEach(contractor => {
                    const exists = this.contractors.some(c => c.id === contractor.id);
                    if (!exists) {
                        this.contractors.push(contractor);
                        imported++;
                    }
                });
            }
            
            // Сохраняем
            this.saveContractors();
            
            showSuccess(`Импортировано ${imported} контрагентов`, 3000);
            return imported > 0;
            
        } catch (error) {
            console.error('❌ Ошибка импорта:', error);
            showError('Ошибка импорта данных: ' + error.message);
            return false;
        }
    }
    
    // Объединение контрагентов (для синхронизации)
    mergeContractors(newContractors) {
        console.log('🔄 Объединение контрагентов...');
        
        const merged = [...this.contractors];
        
        newContractors.forEach(newContractor => {
            const existingIndex = merged.findIndex(c => c.id === newContractor.id);
            
            if (existingIndex !== -1) {
                // Обновляем существующего - берем более новую версию
                const existing = merged[existingIndex];
                const existingDate = new Date(existing.updatedAt || existing.createdAt);
                const newDate = new Date(newContractor.updatedAt || newContractor.createdAt);
                
                if (newDate > existingDate) {
                    merged[existingIndex] = newContractor;
                }
            } else {
                // Добавляем нового
                merged.push(newContractor);
            }
        });
        
        this.contractors = merged;
    }
    
    // Объединение отчетов
    mergeReports(newReports) {
        const merged = [...this.reports];
        
        newReports.forEach(newReport => {
            const existingIndex = merged.findIndex(r => r.id === newReport.id);
            
            if (existingIndex === -1) {
                merged.push(newReport);
            }
        });
        
        this.reports = merged;
    }
}

// Создаем экземпляр при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Запуск инициализации AppState...');
    if (!window.appState) {
        new AppState();
    }
});
