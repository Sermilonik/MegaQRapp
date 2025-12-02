// app-state.js - ОДИН класс
class AppState {
    constructor() {
        this.contractors = [];
        this.currentSession = null;
        this.reports = [];
        this.reportCounter = 1;
        this.firebaseSync = null;
        this.syncEnabled = true;
        this.deviceId = this.generateDeviceId();
        
        // Инициализируем
        this.init();
    }
    
    async init() {
        console.log('🚀 Инициализация AppState');
        
        // Загружаем данные
        this.loadContractors();
        this.loadSession();
        this.loadReports();
        this.loadSettings();
        
        // Генерируем ID устройства если нет
        if (!this.deviceId) {
            this.deviceId = this.generateDeviceId();
            localStorage.setItem('honest_sign_device_id', this.deviceId);
        }
        
        // Инициализируем Firebase
        await this.initFirebase();
        
        console.log('✅ AppState инициализирован');
        console.log(`📊 Данные: ${this.contractors.length} контрагентов, ${this.reports.length} отчетов`);
    }
    
    // Генерация ID устройства
    generateDeviceId() {
        let deviceId = localStorage.getItem('honest_sign_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('honest_sign_device_id', deviceId);
        }
        return deviceId;
    }
    
    // Загрузка контрагентов
    loadContractors() {
        try {
            const saved = localStorage.getItem('honest_sign_contractors');
            if (saved) {
                this.contractors = JSON.parse(saved);
                console.log(`✅ Загружено ${this.contractors.length} контрагентов`);
            } else {
                this.loadDefaultContractors();
                console.log('ℹ️ Созданы контрагенты по умолчанию');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            this.loadDefaultContractors();
        }
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
    
    // Загрузка сессии
    loadSession() {
        try {
            const saved = localStorage.getItem('honest_sign_session');
            if (saved) {
                this.currentSession = JSON.parse(saved);
            } else {
                this.currentSession = {
                    id: Date.now().toString(),
                    scannedCodes: [],
                    selectedContractors: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки сессии:', error);
            this.currentSession = {
                id: Date.now().toString(),
                scannedCodes: [],
                selectedContractors: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
    }
    
    // Загрузка отчетов
    loadReports() {
        try {
            const saved = localStorage.getItem('honest_sign_reports');
            if (saved) {
                this.reports = JSON.parse(saved);
            } else {
                this.reports = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки отчетов:', error);
            this.reports = [];
        }
    }
    
    // Загрузка настроек
    loadSettings() {
        try {
            const syncEnabled = localStorage.getItem('honest_sign_sync_enabled');
            if (syncEnabled !== null) {
                this.syncEnabled = syncEnabled === 'true';
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
        }
    }
    
    // Сохранение контрагентов
    saveContractors() {
        try {
            localStorage.setItem('honest_sign_contractors', JSON.stringify(this.contractors));
        } catch (error) {
            console.error('❌ Ошибка сохранения контрагентов:', error);
        }
    }
    
    // Сохранение сессии
    saveSession(session = null) {
        try {
            if (session) {
                this.currentSession = session;
            }
            localStorage.setItem('honest_sign_session', JSON.stringify(this.currentSession));
        } catch (error) {
            console.error('❌ Ошибка сохранения сессии:', error);
        }
    }
    
    // Сохранение отчетов
    saveReports() {
        try {
            localStorage.setItem('honest_sign_reports', JSON.stringify(this.reports));
        } catch (error) {
            console.error('❌ Ошибка сохранения отчетов:', error);
        }
    }
    
    // Сохранение настроек
    saveSettings() {
        try {
            localStorage.setItem('honest_sign_sync_enabled', this.syncEnabled.toString());
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек:', error);
        }
    }
    
    // Инициализация Firebase
    async initFirebase() {
        try {
            if (typeof FirebaseSync !== 'undefined') {
                this.firebaseSync = new FirebaseSync(this);
                const success = await this.firebaseSync.init();
                
                if (success) {
                    console.log('✅ Firebase инициализирован');
                    
                    // Включаем синхронизацию если настроено
                    if (this.syncEnabled) {
                        await this.syncWithFirebase();
                    }
                }
            } else {
                console.log('ℹ️ FirebaseSync не загружен');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации Firebase:', error);
        }
    }
    
    // Синхронизация с Firebase
    async syncWithFirebase() {
        if (!this.firebaseSync || !this.syncEnabled) {
            console.log('ℹ️ Синхронизация отключена');
            return;
        }
        
        try {
            console.log('🔄 Синхронизация с Firebase...');
            
            // Синхронизируем контрагентов
            if (this.firebaseSync.syncContractors) {
                const result = await this.firebaseSync.syncContractors(this.contractors);
                if (result && result.length > 0) {
                    this.contractors = result;
                    this.saveContractors();
                    console.log(`✅ Контрагенты синхронизированы: ${result.length}`);
                }
            }
            
            // Синхронизируем отчеты
            if (this.firebaseSync.syncReports) {
                const reportsResult = await this.firebaseSync.syncReports(this.reports);
                if (reportsResult && reportsResult.length > 0) {
                    this.reports = reportsResult;
                    this.saveReports();
                    console.log(`✅ Отчеты синхронизированы: ${reportsResult.length}`);
                }
            }
            
            // Обновляем время последней синхронизации
            localStorage.setItem('honest_sign_last_sync', new Date().toISOString());
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
        }
    }
    
    // Переключение синхронизации
    toggleSync() {
        this.syncEnabled = !this.syncEnabled;
        this.saveSettings();
        
        if (this.syncEnabled && this.firebaseSync) {
            this.syncWithFirebase();
        }
        
        return this.syncEnabled;
    }
    
    // Получение статуса синхронизации
    getSyncStatus() {
        const lastSync = localStorage.getItem('honest_sign_last_sync');
        
        return {
            isConnected: this.firebaseSync ? this.firebaseSync.isConnected() : false,
            syncEnabled: this.syncEnabled,
            deviceId: this.deviceId,
            lastSync: lastSync,
            contractorsCount: this.contractors.length,
            reportsCount: this.reports.length
        };
    }
    
    // Получение всех контрагентов
    getAllContractors() {
        return this.contractors;
    }
    
    // Получение текущей сессии
    getCurrentSession() {
        return this.currentSession;
    }
    
    // Получение всех отчетов
    getAllReports() {
        return this.reports;
    }
    
    // Добавление контрагента
    addContractor(name, category = 'Общая категория') {
        const newId = this.contractors.length > 0 ? 
            Math.max(...this.contractors.map(c => c.id)) + 1 : 1;
        
        const contractor = {
            id: newId,
            name: name,
            category: category,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deviceId: this.deviceId
        };
        
        this.contractors.push(contractor);
        this.saveContractors();
        
        // Синхронизируем если включено
        if (this.syncEnabled && this.firebaseSync) {
            this.firebaseSync.addContractor(contractor);
        }
        
        return contractor;
    }
    
    // Удаление контрагента
    deleteContractor(id) {
        const index = this.contractors.findIndex(c => c.id === id);
        if (index !== -1) {
            this.contractors.splice(index, 1);
            this.saveContractors();
            
            // Синхронизируем если включено
            if (this.syncEnabled && this.firebaseSync) {
                this.firebaseSync.deleteContractor(id);
            }
            
            return true;
        }
        return false;
    }
    
    // Добавление отчета
    addReport(report) {
        this.reports.unshift(report);
        if (this.reports.length > 100) {
            this.reports = this.reports.slice(0, 100);
        }
        this.saveReports();
        
        // Синхронизируем если включено
        if (this.syncEnabled && this.firebaseSync) {
            this.firebaseSync.addReport(report);
        }
        
        return report;
    }
    
    // Очистка отчетов
    clearReports() {
        this.reports = [];
        this.saveReports();
        
        // Синхронизируем если включено
        if (this.syncEnabled && this.firebaseSync) {
            this.firebaseSync.clearReports();
        }
    }
    
    // Экспорт данных
    exportData() {
        const data = {
            contractors: this.contractors,
            reports: this.reports,
            currentSession: this.currentSession,
            exportDate: new Date().toISOString(),
            deviceId: this.deviceId,
            version: '1.0'
        };
        
        return JSON.stringify(data, null, 2);
    }
    
    // Импорт данных
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Объединяем контрагентов
            if (data.contractors && Array.isArray(data.contractors)) {
                this.mergeContractors(data.contractors);
            }
            
            // Объединяем отчеты
            if (data.reports && Array.isArray(data.reports)) {
                this.mergeReports(data.reports);
            }
            
            // Сохраняем
            this.saveContractors();
            this.saveReports();
            
            console.log(`✅ Данные импортированы: ${this.contractors.length} контрагентов, ${this.reports.length} отчетов`);
            
            // Синхронизируем если включено
            if (this.syncEnabled && this.firebaseSync) {
                this.syncWithFirebase();
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка импорта данных:', error);
            return false;
        }
    }
    
    // Объединение контрагентов
    mergeContractors(newContractors) {
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

// Создаем глобальный экземпляр
window.appState = new AppState();
