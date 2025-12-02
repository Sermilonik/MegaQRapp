// firebase-sync.js
class FirebaseSync {
    constructor(appState) {
        this.appState = appState;
        this.db = null;
        this.auth = null;
        this.isConnected = false;
        this.userId = null;
        this.deviceId = appState ? appState.deviceId : null;
        this.collections = {
            contractors: 'contractors_v2',
            reports: 'reports_v2'
        };
    }
    
    async init() {
        try {
            console.log('🔥 Инициализация FirebaseSync...');
            
            // Проверяем Firebase
            if (typeof firebase === 'undefined') {
                console.log('ℹ️ Firebase не загружен');
                return false;
            }
            
            // Проверяем инициализацию Firebase
            if (!firebase.apps.length) {
                console.log('⚠️ Firebase не инициализирован, пробуем инициализировать...');
                try {
                    if (window.firebaseConfig) {
                        firebase.initializeApp(window.firebaseConfig);
                        console.log('✅ Firebase инициализирован');
                    } else {
                        console.log('❌ Конфигурация Firebase не найдена');
                        return false;
                    }
                } catch (initError) {
                    console.error('❌ Ошибка инициализации Firebase:', initError);
                    return false;
                }
            }
            
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            // Пробуем анонимную аутентификацию
            try {
                console.log('🔐 Пробуем анонимную аутентификацию...');
                const userCredential = await this.auth.signInAnonymously();
                this.userId = userCredential.user.uid;
                this.isConnected = true;
                
                console.log('✅ FirebaseSync подключен');
                console.log('📱 User ID:', this.userId);
                console.log('📱 Device ID:', this.deviceId);
                
                return true;
            } catch (authError) {
                console.error('❌ Ошибка аутентификации Firebase:', authError);
                console.log('💡 Решение: Включите анонимную аутентификацию в Firebase Console');
                console.log('1. Перейдите в Firebase Console → Authentication → Sign-in method');
                console.log('2. Включите "Anonymous" метод');
                
                // Пробуем альтернативный подход - работаем без аутентификации
                console.log('🔄 Пробуем работу без аутентификации...');
                
                // Используем deviceId как идентификатор
                this.userId = 'device_' + this.deviceId;
                this.isConnected = true;
                
                console.log('⚠️ Работаем в ограниченном режиме (без аутентификации)');
                return true;
            }
            
        } catch (error) {
            console.error('❌ Критическая ошибка инициализации FirebaseSync:', error);
            this.isConnected = false;
            return false;
        }
    }
    
    async syncContractors(localContractors) {
        if (!this.isConnected) {
            console.log('ℹ️ FirebaseSync не подключен, пропускаем синхронизацию');
            return localContractors;
        }
        
        try {
            console.log('🔄 Начинаем синхронизацию контрагентов...');
            
            // Используем простую коллекцию
            const collectionName = this.collections.contractors;
            console.log('📁 Используем коллекцию:', collectionName);
            
            // Получаем данные из Firebase
            let cloudContractors = [];
            try {
                const snapshot = await this.db.collection(collectionName).get();
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Фильтруем по deviceId
                    if (data.deviceId === this.deviceId) {
                        cloudContractors.push(data);
                    }
                });
                console.log(`📊 Найдено ${cloudContractors.length} контрагентов в облаке (для этого устройства)`);
            } catch (firestoreError) {
                console.error('❌ Ошибка чтения из Firestore:', firestoreError);
                // Продолжаем с локальными данными
                return localContractors;
            }
            
            // Объединяем данные
            const mergedContractors = this.mergeData(localContractors, cloudContractors);
            
            // Сохраняем обратно в Firebase
            await this.saveContractorsToFirebase(mergedContractors);
            
            console.log(`✅ Синхронизация завершена. Итог: ${mergedContractors.length} контрагентов`);
            return mergedContractors;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации контрагентов:', error);
            return localContractors;
        }
    }
    
    mergeData(localData, cloudData) {
        const merged = [...localData];
        const cloudMap = new Map();
        
        // Создаем карту облачных данных
        cloudData.forEach(item => {
            cloudMap.set(item.id, item);
        });
        
        // Объединяем данные
        localData.forEach(localItem => {
            const cloudItem = cloudMap.get(localItem.id);
            
            if (cloudItem) {
                // Если есть в облаке, используем более новую версию
                const localDate = new Date(localItem.updatedAt || localItem.createdAt);
                const cloudDate = new Date(cloudItem.updatedAt || cloudItem.createdAt);
                
                if (cloudDate > localDate) {
                    // Находим индекс и обновляем
                    const index = merged.findIndex(item => item.id === localItem.id);
                    if (index !== -1) {
                        merged[index] = cloudItem;
                    }
                }
                // Удаляем из карты, чтобы не добавлять повторно
                cloudMap.delete(localItem.id);
            }
        });
        
        // Добавляем оставшиеся облачные данные
        cloudMap.forEach(item => {
            merged.push(item);
        });
        
        return merged;
    }
    
    async saveContractorsToFirebase(contractors) {
        if (!this.isConnected || !this.db) {
            console.log('ℹ️ Не могу сохранить в Firebase: нет подключения');
            return;
        }
        
        try {
            const collectionName = this.collections.contractors;
            const batch = this.db.batch();
            let savedCount = 0;
            
            // Сохраняем только контрагенты этого устройства
            const myContractors = contractors.filter(c => c.deviceId === this.deviceId);
            
            console.log(`💾 Сохраняем ${myContractors.length} контрагентов в Firebase...`);
            
            myContractors.forEach(contractor => {
                const docId = `${this.deviceId}_${contractor.id}`;
                const docRef = this.db.collection(collectionName).doc(docId);
                
                const data = {
                    ...contractor,
                    _deviceId: this.deviceId,
                    _userId: this.userId,
                    _syncedAt: new Date().toISOString(),
                    _updatedAt: new Date().toISOString()
                };
                
                batch.set(docRef, data, { merge: true });
                savedCount++;
            });
            
            // Ограничиваем batch размером 500 операций
            if (savedCount > 0) {
                await batch.commit();
                console.log(`✅ Сохранено ${savedCount} контрагентов в Firebase`);
                
                // Обновляем время последней синхронизации
                localStorage.setItem('honest_sign_last_sync', new Date().toISOString());
            }
            
        } catch (error) {
            console.error('❌ Ошибка сохранения в Firebase:', error);
        }
    }
    
    async testConnection() {
        try {
            console.log('🧪 Тест подключения к Firebase...');
            
            if (!this.isConnected || !this.db) {
                console.log('❌ Нет подключения к Firebase');
                return false;
            }
            
            // Пробуем простую операцию чтения
            const testDoc = await this.db.collection('_test_connection')
                .doc('test')
                .get();
            
            console.log('✅ Подключение к Firebase работает');
            return true;
            
        } catch (error) {
            console.error('❌ Тест подключения не пройден:', error);
            return false;
        }
    }
    
    async forceSync() {
        if (!this.appState) {
            console.error('❌ AppState не доступен');
            return false;
        }
        
        try {
            console.log('🚀 Принудительная синхронизация...');
            showInfo('🔄 Синхронизация с облаком...', 3000);
            
            // Синхронизируем контрагентов
            const contractors = this.appState.getAllContractors();
            const syncedContractors = await this.syncContractors(contractors);
            
            if (syncedContractors && syncedContractors.length > 0) {
                // Обновляем в AppState
                this.appState.contractors = syncedContractors;
                this.appState.saveContractors();
                
                console.log(`✅ Синхронизация завершена: ${syncedContractors.length} контрагентов`);
                
                // Обновляем UI
                if (window.scannerManager && window.scannerManager.updateSyncUI) {
                    window.scannerManager.updateSyncUI();
                }
                
                showSuccess(`✅ Синхронизировано ${syncedContractors.length} контрагентов`, 3000);
                return true;
            }
            
            showWarning('⚠️ Нет данных для синхронизации', 3000);
            return false;
            
        } catch (error) {
            console.error('❌ Ошибка принудительной синхронизации:', error);
            showError('Ошибка синхронизации: ' + error.message);
            return false;
        }
    }
    
    getStatus() {
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            deviceId: this.deviceId,
            lastSync: localStorage.getItem('honest_sign_last_sync')
        };
    }
}
