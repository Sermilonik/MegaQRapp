// firebase-sync.js
class FirebaseSync {
    constructor(appState) {
        this.appState = appState;
        this.db = null;
        this.auth = null;
        this.isConnected = false;
        this.userId = null;
        this.deviceId = appState ? appState.deviceId : null;
        this.baseCollectionPath = 'users';
        
        // Пытаемся восстановить существующий userId из localStorage
        this.existingUserId = localStorage.getItem('honest_sign_firebase_user_id');
        console.log('📋 Восстановленный userId:', this.existingUserId);
    }
    
    async init() {
        try {
            console.log('🔥 Инициализация FirebaseSync...');
            
            if (typeof firebase === 'undefined') {
                console.log('ℹ️ Firebase не загружен');
                return false;
            }
            
            if (!firebase.apps.length) {
                console.log('⚠️ Firebase не инициализирован');
                return false;
            }
            
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            // Пробуем найти существующего пользователя
            await this.findExistingUser();
            
            // Если не нашли существующего, создаем нового
            if (!this.userId) {
                await this.createNewUser();
            }
            
            console.log('✅ FirebaseSync подключен');
            console.log('📱 User ID:', this.userId);
            console.log('📱 Device ID:', this.deviceId);
            console.log('📁 Путь к данным:', `${this.baseCollectionPath}/${this.userId}/qr_scanner_production_v1`);
            
            this.isConnected = true;
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации FirebaseSync:', error);
            this.isConnected = false;
            return false;
        }
    }
    
    async findExistingUser() {
        try {
            console.log('🔍 Поиск существующего пользователя...');
            
            // Если есть сохраненный userId, проверяем его
            if (this.existingUserId) {
                console.log('🔍 Проверяем сохраненный userId:', this.existingUserId);
                
                const userDocRef = this.db.collection(this.baseCollectionPath).doc(this.existingUserId);
                const userDoc = await userDocRef.get();
                
                if (userDoc.exists) {
                    this.userId = this.existingUserId;
                    console.log('✅ Найден существующий пользователь:', this.userId);
                    
                    // Анонимная аутентификация с этим userId (если возможно)
                    try {
                        await this.auth.signInAnonymously();
                        console.log('✅ Аутентификация выполнена');
                    } catch (authError) {
                        console.log('⚠️ Аутентификация не требуется или не удалась');
                    }
                    
                    return true;
                } else {
                    console.log('⚠️ Сохраненный userId не найден в Firebase');
                }
            }
            
            // Ищем пользователей с нашим deviceId
            console.log('🔍 Ищем пользователей по deviceId:', this.deviceId);
            
            const usersSnapshot = await this.db.collection(this.baseCollectionPath)
                .where('deviceId', '==', this.deviceId)
                .limit(1)
                .get();
            
            if (!usersSnapshot.empty) {
                usersSnapshot.forEach(doc => {
                    this.userId = doc.id;
                    console.log('✅ Найден пользователь по deviceId:', this.userId);
                });
                
                // Сохраняем найденный userId
                localStorage.setItem('honest_sign_firebase_user_id', this.userId);
                
                return true;
            }
            
            console.log('ℹ️ Существующий пользователь не найден');
            return false;
            
        } catch (error) {
            console.error('❌ Ошибка поиска пользователя:', error);
            return false;
        }
    }
    
    async createNewUser() {
        try {
            console.log('👤 Создание нового пользователя...');
            
            // Анонимная аутентификация для создания нового пользователя
            await this.auth.signInAnonymously();
            
            // Используем Firebase UID как userId
            this.userId = this.auth.currentUser.uid;
            
            // Сохраняем в localStorage для будущего использования
            localStorage.setItem('honest_sign_firebase_user_id', this.userId);
            
            console.log('✅ Создан новый пользователь:', this.userId);
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка создания пользователя:', error);
            return false;
        }
    }
    
    async getAllUsers() {
        try {
            console.log('👥 Получение списка всех пользователей...');
            
            const usersSnapshot = await this.db.collection(this.baseCollectionPath).get();
            const users = [];
            
            usersSnapshot.forEach(doc => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`📊 Найдено ${users.length} пользователей`);
            return users;
            
        } catch (error) {
            console.error('❌ Ошибка получения пользователей:', error);
            return [];
        }
    }
    
    async syncWithAllUsers(localContractors) {
        try {
            console.log('🌐 Синхронизация со всеми пользователями...');
            
            const allUsers = await this.getAllUsers();
            let allContractors = [...localContractors];
            
            // Собираем контрагенты от всех пользователей
            for (const user of allUsers) {
                if (user.id === this.userId) continue; // Пропускаем себя
                
                const userContractors = await this.getUserContractors(user.id);
                console.log(`👤 Пользователь ${user.id.substring(0, 10)}...: ${userContractors.length} контрагентов`);
                
                // Объединяем контрагенты
                allContractors = this.mergeContractors(allContractors, userContractors);
            }
            
            console.log(`📊 После синхронизации со всеми: ${allContractors.length} контрагентов`);
            return allContractors;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации со всеми пользователями:', error);
            return localContractors;
        }
    }
    
    async getUserContractors(userId) {
        try {
            const userDocRef = this.db.collection(this.baseCollectionPath).doc(userId);
            const contractorsDocRef = userDocRef.collection('qr_scanner_production_v1').doc('contractors');
            
            const doc = await contractorsDocRef.get();
            if (doc.exists) {
                const data = doc.data();
                return data.contractors || [];
            }
            return [];
            
        } catch (error) {
            console.error(`❌ Ошибка получения контрагентов пользователя ${userId}:`, error);
            return [];
        }
    }
    
    async syncContractors(localContractors) {
        if (!this.isConnected) {
            console.log('ℹ️ FirebaseSync не подключен');
            return localContractors;
        }
        
        try {
            console.log('🔄 Синхронизация контрагентов...');
            
            // 1. Сначала синхронизируем со всеми пользователями
            const allUsersContractors = await this.syncWithAllUsers(localContractors);
            
            // 2. Сохраняем свои контрагенты
            await this.saveMyContractors(allUsersContractors);
            
            console.log(`✅ Синхронизация завершена. Итог: ${allUsersContractors.length} контрагентов`);
            return allUsersContractors;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации контрагентов:', error);
            return localContractors;
        }
    }
    
    async saveMyContractors(contractors) {
        if (!this.isConnected || !this.db) return;
        
        try {
            // Обновляем метаданные пользователя
            const userDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId);
            await userDocRef.set({
                userId: this.userId,
                deviceId: this.deviceId,
                lastActivity: new Date().toISOString(),
                lastSync: new Date().toISOString(),
                userAgent: navigator.userAgent,
                version: '1.0',
                contractorsCount: contractors.length,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('✅ Метаданные пользователя обновлены');
            
            // Сохраняем контрагенты
            const contractorsDocRef = userDocRef.collection('qr_scanner_production_v1').doc('contractors');
            await contractorsDocRef.set({
                contractors: contractors,
                count: contractors.length,
                lastSync: new Date().toISOString(),
                deviceId: this.deviceId,
                userId: this.userId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log(`✅ Сохранено ${contractors.length} контрагентов`);
            
            // Обновляем время синхронизации
            localStorage.setItem('honest_sign_last_sync', new Date().toISOString());
            
        } catch (error) {
            console.error('❌ Ошибка сохранения контрагентов:', error);
        }
    }
    
    mergeContractors(localData, cloudData) {
        const merged = [...localData];
        const mergedIds = new Set(localData.map(c => c.id));
        
        // Добавляем облачные контрагенты, которых нет локально
        cloudData.forEach(cloudContractor => {
            if (!mergedIds.has(cloudContractor.id)) {
                merged.push(cloudContractor);
                mergedIds.add(cloudContractor.id);
            }
        });
        
        return merged;
    }
    
    async syncReports(localReports) {
        if (!this.isConnected) {
            console.log('ℹ️ FirebaseSync не подключен, пропускаем синхронизацию отчетов');
            return localReports;
        }
        
        try {
            console.log('🔄 Синхронизация отчетов...');
            
            // Получаем отчеты всех пользователей
            const allUsersReports = await this.getAllUsersReports();
            
            // Объединяем с локальными
            const mergedReports = this.mergeReports(localReports, allUsersReports);
            
            // Сохраняем свои отчеты
            await this.saveMyReports(mergedReports);
            
            console.log(`✅ Синхронизация отчетов завершена: ${mergedReports.length} отчетов`);
            return mergedReports;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации отчетов:', error);
            return localReports;
        }
    }
    
    async getAllUsersReports() {
        try {
            const allUsers = await this.getAllUsers();
            let allReports = [];
            
            for (const user of allUsers) {
                const userReports = await this.getUserReports(user.id);
                allReports = [...allReports, ...userReports];
            }
            
            return allReports;
            
        } catch (error) {
            console.error('❌ Ошибка получения отчетов всех пользователей:', error);
            return [];
        }
    }
    
    async getUserReports(userId) {
        try {
            const userDocRef = this.db.collection(this.baseCollectionPath).doc(userId);
            const reportsDocRef = userDocRef.collection('qr_scanner_production_v1').doc('reports');
            
            const doc = await reportsDocRef.get();
            if (doc.exists) {
                const data = doc.data();
                return data.reports || [];
            }
            return [];
            
        } catch (error) {
            console.error(`❌ Ошибка получения отчетов пользователя ${userId}:`, error);
            return [];
        }
    }
    
    mergeReports(localData, cloudData) {
        const merged = [...localData];
        const mergedIds = new Set(localData.map(r => r.id));
        
        // Добавляем облачные отчеты, которых нет локально
        cloudData.forEach(cloudReport => {
            if (!mergedIds.has(cloudReport.id)) {
                merged.push(cloudReport);
                mergedIds.add(cloudReport.id);
            }
        });
        
        return merged;
    }
    
    async saveMyReports(reports) {
        if (!this.isConnected || !this.db) return;
        
        try {
            const userDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId);
            const reportsDocRef = userDocRef.collection('qr_scanner_production_v1').doc('reports');
            
            await reportsDocRef.set({
                reports: reports,
                count: reports.length,
                lastSync: new Date().toISOString(),
                deviceId: this.deviceId,
                userId: this.userId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log(`✅ Сохранено ${reports.length} отчетов`);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения отчетов:', error);
        }
    }
    
    async forceSync() {
        if (!this.appState) {
            console.error('❌ AppState не доступен');
            return false;
        }
        
        try {
            console.log('🚀 Принудительная синхронизация всех данных...');
            
            // 1. Синхронизируем контрагентов со всеми пользователями
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
        const usersCount = localStorage.getItem('honest_sign_users_count') || '?';
        
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            deviceId: this.deviceId,
            lastSync: localStorage.getItem('honest_sign_last_sync'),
            usersCount: usersCount,
            basePath: `${this.baseCollectionPath}/${this.userId}/qr_scanner_production_v1`
        };
    }
}
