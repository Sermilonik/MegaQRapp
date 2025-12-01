// firebase-sync.js - исправленная версия
class FirebaseSync {
    constructor() {
        this.db = null;
        this.auth = null;
        this.user = null;
        this.deviceId = this.getDeviceId();
        this.syncEnabled = true;
        this.lastSync = null;
        
        console.log('🔧 FirebaseSync создан для устройства:', this.deviceId);
    }
    
    async init() {
        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase не загружен');
            }
            
            // Получаем ссылки
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            // Анонимная аутентификация
            await this.auth.signInAnonymously();
            this.user = this.auth.currentUser;
            
            console.log('✅ FirebaseSync инициализирован');
            console.log('👤 Пользователь:', this.user.uid);
            
            // Начинаем слушать изменения
            this.startListening();
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации FirebaseSync:', error);
            return false;
        }
    }
    
    getDeviceId() {
        // Генерируем уникальный ID устройства
        let deviceId = localStorage.getItem('honest_sign_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('honest_sign_device_id', deviceId);
        }
        return deviceId;
    }
    
    async startListening() {
        try {
            // Слушаем изменения контрагентов
            this.db.collection('contractors')
                .where('devices', 'array-contains', this.deviceId)
                .onSnapshot((snapshot) => {
                    console.log('📡 Получены обновления контрагентов:', snapshot.size);
                    
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added' || change.type === 'modified') {
                            this.onContractorUpdate(change.doc.data());
                        }
                    });
                });
                
            console.log('✅ Начато прослушивание изменений');
            
        } catch (error) {
            console.error('❌ Ошибка прослушивания:', error);
        }
    }
    
    onContractorUpdate(contractorData) {
        // Уведомляем AppState об обновлении
        if (window.appState && window.appState.updateContractorFromSync) {
            window.appState.updateContractorFromSync(contractorData);
        }
        
        // Обновляем UI если ScannerManager активен
        if (window.scannerManager) {
            window.scannerManager.loadContractors();
        }
    }
    
    async uploadContractors(contractors) {
        if (!this.db || !this.syncEnabled) return;
        
        try {
            console.log('☁️ Загрузка контрагентов в Firebase...');
            
            const batch = this.db.batch();
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            contractors.forEach((contractor) => {
                const docRef = this.db.collection('contractors').doc(contractor.id.toString());
                
                const contractorData = {
                    ...contractor,
                    devices: firebase.firestore.FieldValue.arrayUnion(this.deviceId),
                    updatedAt: timestamp,
                    updatedBy: this.deviceId
                };
                
                batch.set(docRef, contractorData, { merge: true });
            });
            
            await batch.commit();
            this.lastSync = new Date().toISOString();
            
            console.log(`✅ Загружено ${contractors.length} контрагентов`);
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            return false;
        }
    }
    
    async downloadContractors() {
        if (!this.db) return [];
        
        try {
            console.log('📥 Загрузка контрагентов из Firebase...');
            
            const snapshot = await this.db.collection('contractors')
                .where('devices', 'array-contains', this.deviceId)
                .orderBy('updatedAt', 'desc')
                .get();
            
            const contractors = [];
            snapshot.forEach(doc => {
                contractors.push(doc.data());
            });
            
            console.log(`✅ Загружено ${contractors.length} контрагентов`);
            this.lastSync = new Date().toISOString();
            
            return contractors;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            return [];
        }
    }
    
    async syncContractors(localContractors) {
        if (!this.syncEnabled) return localContractors;
        
        try {
            // 1. Загружаем облачные данные
            const cloudContractors = await this.downloadContractors();
            
            // 2. Объединяем (облачные данные имеют приоритет)
            const merged = this.mergeContractors(localContractors, cloudContractors);
            
            // 3. Загружаем обратно в облако
            await this.uploadContractors(merged);
            
            return merged;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            return localContractors;
        }
    }
    
    mergeContractors(local, cloud) {
        const merged = [...cloud];
        const cloudIds = new Set(cloud.map(c => c.id));
        
        // Добавляем локальные, которых нет в облаке
        local.forEach(localContractor => {
            if (!cloudIds.has(localContractor.id)) {
                merged.push(localContractor);
            }
        });
        
        // Убираем дубликаты по имени
        const uniqueByName = {};
        merged.forEach(contractor => {
            if (!uniqueByName[contractor.name]) {
                uniqueByName[contractor.name] = contractor;
            }
        });
        
        return Object.values(uniqueByName);
    }
    
    setSyncEnabled(enabled) {
        this.syncEnabled = enabled;
        localStorage.setItem('honest_sign_sync_enabled', enabled.toString());
        console.log(`⚡ Автосинхронизация: ${enabled ? 'ВКЛ' : 'ВЫКЛ'}`);
    }
    
    getSyncStatus() {
        return {
            isConnected: !!this.db,
            syncEnabled: this.syncEnabled,
            deviceId: this.deviceId,
            userId: this.user?.uid,
            lastSync: this.lastSync
        };
    }
}

// Экспортируем класс
window.FirebaseSync = FirebaseSync;
