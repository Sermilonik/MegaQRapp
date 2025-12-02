// firebase-sync.js
class FirebaseSync {
    constructor(appState) {
        this.appState = appState;
        this.db = null;
        this.auth = null;
        this.isConnected = false;
        this.userId = null;
        this.deviceId = appState ? appState.deviceId : null;
        this.baseCollectionPath = 'users'; // Базовая коллекция
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
                console.log('📱 Firebase User ID:', this.userId);
                console.log('📱 Device ID:', this.deviceId);
                
                // Используем путь: users/{userId}/qr_scanner_production_v1
                console.log('📁 Путь к данным:', `users/${this.userId}/qr_scanner_production_v1`);
                
                return true;
            } catch (authError) {
                console.error('❌ Ошибка аутентификации Firebase:', authError);
                console.log('💡 Решение: Включите анонимную аутентификацию в Firebase Console');
                
                // Используем deviceId как userId для совместимости
                this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                this.isConnected = true;
                
                console.log('⚠️ Используем временный User ID:', this.userId);
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
            
            // Путь к данным: users/{userId}/qr_scanner_production_v1/contractors
            const userDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId);
            const contractorsCollectionRef = userDocRef.collection('qr_scanner_production_v1').doc('contractors');
            
            console.log('📁 Полный путь:', `${this.baseCollectionPath}/${this.userId}/qr_scanner_production_v1/contractors`);
            
            // Получаем данные из Firebase
            let cloudContractors = [];
            try {
                const doc = await contractorsCollectionRef.get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data.contractors && Array.isArray(data.contractors)) {
                        cloudContractors = data.contractors;
                        console.log(`📊 Найдено ${cloudContractors.length} контрагентов в облаке`);
                    } else {
                        console.log('ℹ️ Нет данных контрагентов в облаке');
                    }
                } else {
                    console.log('ℹ️ Документ контрагентов не существует в облаке');
                }
            } catch (firestoreError) {
                console.error('❌ Ошибка чтения из Firestore:', firestoreError);
                // Создаем новый документ
                console.log('🆕 Создаем новый документ для контрагентов...');
            }
            
            // Объединяем данные
            const mergedContractors = this.mergeContractorsData(localContractors, cloudContractors);
            
            // Сохраняем обратно в Firebase
            await this.saveContractorsToFirebase(mergedContractors, contractorsCollectionRef);
            
            console.log(`✅ Синхронизация завершена. Итог: ${mergedContractors.length} контрагентов`);
            return mergedContractors;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации контрагентов:', error);
            return localContractors;
        }
    }
    
    mergeContractorsData(localData, cloudData) {
        console.log('🔄 Объединение данных...');
        console.log(`📱 Локальные: ${localData.length}, ☁️ Облачные: ${cloudData.length}`);
        
        // Создаем карту для быстрого поиска
        const mergedMap = new Map();
        
        // Сначала добавляем облачные данные
        cloudData.forEach(cloudItem => {
            mergedMap.set(cloudItem.id, { ...cloudItem, source: 'cloud' });
        });
        
        // Затем добавляем/обновляем локальными данными
        localData.forEach(localItem => {
            const cloudItem = mergedMap.get(localItem.id);
            
            if (cloudItem) {
                // Сравниваем даты обновления - берем более новую версию
                const localDate = new Date(localItem.updatedAt || localItem.createdAt);
                const cloudDate = new Date(cloudItem.updatedAt || cloudItem.createdAt);
                
                if (localDate > cloudDate) {
                    // Локальные данные новее
                    mergedMap.set(localItem.id, { ...localItem, source: 'local', deviceId: this.deviceId });
                }
                // Иначе оставляем облачные данные
            } else {
                // Новый контрагент из локальных данных
                mergedMap.set(localItem.id, { ...localItem, source: 'local', deviceId: this.deviceId });
            }
        });
        
        // Преобразуем обратно в массив
        const merged = Array.from(mergedMap.values()).map(({ source, ...item }) => item);
        
        console.log(`📊 После объединения: ${merged.length} контрагентов`);
        return merged;
    }
    
    async saveContractorsToFirebase(contractors, contractorsCollectionRef) {
        if (!this.isConnected || !this.db) {
            console.log('ℹ️ Не могу сохранить в Firebase: нет подключения');
            return;
        }
        
        try {
            console.log(`💾 Сохраняем ${contractors.length} контрагентов в Firebase...`);
            
            // Обновляем метаданные пользователя
            const userDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId);
            await userDocRef.set({
                userId: this.userId,
                deviceId: this.deviceId,
                lastActivity: new Date().toISOString(),
                userAgent: navigator.userAgent,
                version: '1.0'
            }, { merge: true });
            
            console.log('✅ Метаданные пользователя обновлены');
            
            // Сохраняем контрагенты
            await contractorsCollectionRef.set({
                contractors: contractors,
                count: contractors.length,
                lastSync: new Date().toISOString(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                deviceId: this.deviceId,
                userId: this.userId
            }, { merge: true });
            
            console.log(`✅ Сохранено ${contractors.length} контрагентов в Firebase`);
            
            // Обновляем время последней синхронизации
            localStorage.setItem('honest_sign_last_sync', new Date().toISOString());
            console.log('🕐 Время синхронизации обновлено');
            
        } catch (error) {
            console.error('❌ Ошибка сохранения в Firebase:', error);
        }
    }
    
    async syncReports(localReports) {
        if (!this.isConnected) {
            console.log('ℹ️ FirebaseSync не подключен, пропускаем синхронизацию отчетов');
            return localReports;
        }
        
        try {
            console.log('🔄 Синхронизация отчетов...');
            
            // Путь к данным: users/{userId}/qr_scanner_production_v1/reports
            const userDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId);
            const reportsCollectionRef = userDocRef.collection('qr_scanner_production_v1').doc('reports');
            
            // Получаем данные из Firebase
            let cloudReports = [];
            try {
                const doc = await reportsCollectionRef.get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data.reports && Array.isArray(data.reports)) {
                        cloudReports = data.reports;
                        console.log(`📊 Найдено ${cloudReports.length} отчетов в облаке`);
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка чтения отчетов из Firestore:', error);
            }
            
            // Объединяем данные
            const mergedReports = this.mergeReportsData(localReports, cloudReports);
            
            // Сохраняем обратно в Firebase
            await reportsCollectionRef.set({
                reports: mergedReports,
                count: mergedReports.length,
                lastSync: new Date().toISOString(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                deviceId: this.deviceId
            }, { merge: true });
            
            console.log(`✅ Синхронизация отчетов завершена: ${mergedReports.length} отчетов`);
            return mergedReports;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации отчетов:', error);
            return localReports;
        }
    }
    
    mergeReportsData(localData, cloudData) {
        const merged = [...localData];
        const cloudMap = new Map();
        
        // Создаем карту облачных отчетов
        cloudData.forEach(report => cloudMap.set(report.id, report));
        
        // Добавляем облачные отчеты, которых нет локально
        cloudData.forEach(cloudReport => {
            const exists = merged.some(localReport => localReport.id === cloudReport.id);
            if (!exists) {
                merged.push(cloudReport);
            }
        });
        
        return merged;
    }
    
    async testConnection() {
        try {
            console.log('🧪 Тест подключения к Firebase...');
            
            if (!this.isConnected || !this.db) {
                console.log('❌ Нет подключения к Firebase');
                return false;
            }
            
            // Пробуем простую операцию чтения/записи
            const testDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId);
            
            // Читаем
            const doc = await testDocRef.get();
            console.log('✅ Чтение из Firebase работает');
            
            // Пишем
            await testDocRef.set({
                test: true,
                timestamp: new Date().toISOString(),
                deviceId: this.deviceId
            }, { merge: true });
            console.log('✅ Запись в Firebase работает');
            
            console.log('✅ Полный тест подключения пройден');
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
            console.log('🚀 Принудительная синхронизация всех данных...');
            
            // 1. Синхронизируем контрагентов
            const contractors = this.appState.getAllContractors();
            const syncedContractors = await this.syncContractors(contractors);
            
            if (syncedContractors && syncedContractors.length > 0) {
                this.appState.contractors = syncedContractors;
                this.appState.saveContractors();
                console.log(`✅ Контрагенты синхронизированы: ${syncedContractors.length}`);
            }
            
            // 2. Синхронизируем отчеты
            const reports = this.appState.getAllReports();
            const syncedReports = await this.syncReports(reports);
            
            if (syncedReports && syncedReports.length > 0) {
                this.appState.reports = syncedReports;
                this.appState.saveReports();
                console.log(`✅ Отчеты синхронизированы: ${syncedReports.length}`);
            }
            
            // 3. Обновляем время синхронизации
            localStorage.setItem('honest_sign_last_sync', new Date().toISOString());
            
            console.log('✅ Полная синхронизация завершена');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка принудительной синхронизации:', error);
            return false;
        }
    }
    
    getStatus() {
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            deviceId: this.deviceId,
            lastSync: localStorage.getItem('honest_sign_last_sync'),
            basePath: `${this.baseCollectionPath}/${this.userId}/qr_scanner_production_v1`
        };
    }
}
