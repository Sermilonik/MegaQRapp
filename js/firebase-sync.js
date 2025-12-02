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
            console.log('🔄 Синхронизация контрагентов с автоматическим удалением...');
            
            // 1. Сначала синхронизируем списки удаленных
            const allDeleted = await this.syncDeletedContractors();
            
            // 2. Получаем контрагентов со всех пользователей
            const allUsersContractors = await this.syncWithAllUsers(localContractors);
            
            // 3. Автоматически удаляем помеченных как удаленные
            const cleanedContractors = this.removeDeletedContractors(allUsersContractors, allDeleted);
            
            // 4. Фильтруем дополнительно по локальному списку удаленных
            const filteredContractors = await this.filterDeletedContractors(cleanedContractors);
            
            // 5. Сохраняем свои контрагенты
            await this.saveMyContractors(filteredContractors);
            
            console.log(`✅ Синхронизация завершена. Итог: ${filteredContractors.length} контрагентов`);
            return filteredContractors;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации контрагентов:', error);
            return localContractors;
        }
    }

    // Метод для автоматического удаления
    removeDeletedContractors(contractors, deletedList) {
        if (!deletedList || deletedList.length === 0) {
            console.log('ℹ️ Нет удаленных контрагентов для фильтрации');
            return contractors;
        }
        
        console.log(`🗑️ Автоматическое удаление ${deletedList.length} контрагентов...`);
        
        const deletedIds = new Set(deletedList.map(d => d.id));
        const initialCount = contractors.length;
        
        const filtered = contractors.filter(contractor => !deletedIds.has(contractor.id));
        
        const removedCount = initialCount - filtered.length;
        if (removedCount > 0) {
            console.log(`✅ Автоматически удалено ${removedCount} контрагентов`);
            
            // Показываем уведомление об удаленных контрагентах
            if (removedCount > 0 && window.scannerManager) {
                setTimeout(() => {
                    showInfo(`Автоматически удалено ${removedCount} контрагентов (помечены как удаленные на других устройствах)`, 5000);
                }, 1000);
            }
        }
        
        return filtered;
    }
    
    async filterDeletedContractors(contractors) {
        try {
            console.log('🗑️ Фильтрация удаленных контрагентов...');
            
            // Получаем список удаленных контрагентов
            const deletedContractors = await this.getDeletedContractors();
            
            if (deletedContractors.length === 0) {
                console.log('ℹ️ Удаленных контрагентов нет');
                return contractors;
            }
            
            // Фильтруем удаленных
            const deletedIds = new Set(deletedContractors.map(c => c.id));
            const filtered = contractors.filter(contractor => !deletedIds.has(contractor.id));
            
            console.log(`✅ Удалено ${deletedContractors.length} контрагентов из синхронизации`);
            return filtered;
            
        } catch (error) {
            console.error('❌ Ошибка фильтрации удаленных контрагентов:', error);
            return contractors;
        }
    }
    
    async getDeletedContractors() {
        try {
            console.log('🔍 Получение списка удаленных контрагентов...');
            
            const deletedDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId)
                .collection('qr_scanner_production_v1').doc('deleted_contractors');
            
            const doc = await deletedDocRef.get();
            if (doc.exists) {
                const data = doc.data();
                const deleted = data.contractors || [];
                console.log(`📊 Найдено ${deleted.length} удаленных контрагентов`);
                return deleted;
            }
            
            return [];
            
        } catch (error) {
            console.error('❌ Ошибка получения удаленных контрагентов:', error);
            return [];
        }
    }
    
    async markContractorAsDeleted(contractor) {
        if (!this.isConnected || !this.db) {
            console.log('ℹ️ Firebase не подключен, удаление локальное');
            return false;
        }
        
        try {
            console.log(`🗑️ Помечаем контрагента как удаленного: ${contractor.name}`);
            
            const deletedDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId)
                .collection('qr_scanner_production_v1').doc('deleted_contractors');
            
            // Получаем текущий список удаленных
            const doc = await deletedDocRef.get();
            let deletedContractors = [];
            
            if (doc.exists) {
                const data = doc.data();
                deletedContractors = data.contractors || [];
            }
            
            // Добавляем нового удаленного (только если его еще нет)
            const exists = deletedContractors.some(c => c.id === contractor.id);
            if (!exists) {
                deletedContractors.push({
                    ...contractor,
                    deletedAt: new Date().toISOString(),
                    deletedBy: this.deviceId,
                    deletedReason: 'user_action'
                });
                
                // Сохраняем обновленный список
                await deletedDocRef.set({
                    contractors: deletedContractors,
                    count: deletedContractors.length,
                    lastUpdate: new Date().toISOString(),
                    deviceId: this.deviceId
                }, { merge: true });
                
                console.log(`✅ Контрагент "${contractor.name}" помечен как удаленный`);
                return true;
            }
            
            console.log(`ℹ️ Контрагент "${contractor.name}" уже помечен как удаленный`);
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка пометки контрагента как удаленного:', error);
            return false;
        }
    }
    
    async syncDeletedContractors() {
        try {
            console.log('🔄 Синхронизация и применение удаленных контрагентов...');
            
            // Получаем удаленных контрагентов от всех пользователей
            const allUsers = await this.getAllUsers();
            const allDeleted = [];
            
            for (const user of allUsers) {
                if (user.id === this.userId) continue;
                
                const userDeleted = await this.getUserDeletedContractors(user.id);
                console.log(`👤 Пользователь ${user.id.substring(0, 10)}...: ${userDeleted.length} удаленных`);
                
                // Добавляем удаленные контрагенты от других пользователей
                allDeleted.push(...userDeleted);
            }
            
            // Получаем свои удаленные
            const myDeleted = await this.getDeletedContractors();
            
            // Объединяем все удаленные
            const mergedDeleted = this.mergeDeletedContractors(myDeleted, allDeleted);
            
            // Сохраняем объединенный список
            await this.saveDeletedContractors(mergedDeleted);
            
            // Сохраняем локально для быстрого доступа
            await this.saveDeletedLocally(mergedDeleted);
            
            console.log(`📊 Общий список удаленных: ${mergedDeleted.length} контрагентов`);
            
            // Автоматически применяем удаление к локальным данным
            await this.applyDeletedToLocal(mergedDeleted);
            
            return mergedDeleted;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации удаленных контрагентов:', error);
            return [];
        }
    }
    
    // Сохранение удаленных локально
    async saveDeletedLocally(deletedContractors) {
        try {
            // Сохраняем в localStorage
            localStorage.setItem('honest_sign_deleted_contractors', JSON.stringify(deletedContractors));
            
            // Сохраняем время последнего обновления
            localStorage.setItem('honest_sign_deleted_last_update', new Date().toISOString());
            
            console.log(`💾 Сохранено ${deletedContractors.length} удаленных контрагентов локально`);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения удаленных локально:', error);
        }
    }

    // Применение удаленных к локальным данным
    async applyDeletedToLocal(deletedContractors) {
        try {
            if (!this.appState) {
                console.log('ℹ️ AppState не доступен для применения удаления');
                return;
            }
            
            if (!deletedContractors || deletedContractors.length === 0) {
                console.log('ℹ️ Нет удаленных контрагентов для применения');
                return;
            }
            
            console.log('🔧 Применение удаленных контрагентов к локальным данным...');
            
            const deletedIds = new Set(deletedContractors.map(d => d.id));
            const localContractors = this.appState.getAllContractors();
            const initialCount = localContractors.length;
            
            // Фильтруем локальные контрагенты
            const filtered = localContractors.filter(contractor => !deletedIds.has(contractor.id));
            
            const removedCount = initialCount - filtered.length;
            if (removedCount > 0) {
                // Обновляем AppState
                this.appState.contractors = filtered;
                this.appState.saveContractors();
                
                console.log(`✅ Удалено ${removedCount} контрагентов из локальных данных`);
                
                // Оповещаем UI об изменении
                this.notifyLocalChanges(removedCount);
            }
            
        } catch (error) {
            console.error('❌ Ошибка применения удаленных к локальным данным:', error);
        }
    }

    // Оповещение об изменениях
    notifyLocalChanges(removedCount) {
        // Оповещаем ScannerManager если он существует
        if (window.scannerManager) {
            // Перезагружаем контрагентов в UI
            setTimeout(() => {
                if (window.scannerManager.loadContractors) {
                    window.scannerManager.loadContractors();
                    console.log('🔄 UI контрагентов обновлен после удаления');
                }
                
                // Показываем уведомление
                if (removedCount > 0) {
                    showInfo(`Удалено ${removedCount} контрагентов (синхронизировано с другими устройствами)`, 5000);
                }
            }, 500);
        }
    }
    
    async getUserDeletedContractors(userId) {
        try {
            const deletedDocRef = this.db.collection(this.baseCollectionPath).doc(userId)
                .collection('qr_scanner_production_v1').doc('deleted_contractors');
            
            const doc = await deletedDocRef.get();
            if (doc.exists) {
                const data = doc.data();
                return data.contractors || [];
            }
            return [];
            
        } catch (error) {
            console.error(`❌ Ошибка получения удаленных контрагентов пользователя ${userId}:`, error);
            return [];
        }
    }
    
    mergeDeletedContractors(myDeleted, otherDeleted) {
        const merged = [...myDeleted];
        const myIds = new Set(myDeleted.map(c => c.id));
        
        // Добавляем удаленные от других пользователей, которых нет у нас
        otherDeleted.forEach(deleted => {
            if (!myIds.has(deleted.id)) {
                merged.push(deleted);
                myIds.add(deleted.id);
            }
        });
        
        return merged;
    }
    
    async saveDeletedContractors(deletedContractors) {
        if (!this.isConnected || !this.db) return;
        
        try {
            const deletedDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId)
                .collection('qr_scanner_production_v1').doc('deleted_contractors');
            
            await deletedDocRef.set({
                contractors: deletedContractors,
                count: deletedContractors.length,
                lastSync: new Date().toISOString(),
                deviceId: this.deviceId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log(`✅ Сохранено ${deletedContractors.length} удаленных контрагентов`);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения удаленных контрагентов:', error);
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
            console.log('🚀 Принудительная синхронизация с удалением...');
            showInfo('🔄 Синхронизация с автоматическим удалением...', 5000);
            
            // 1. Сначала синхронизируем и применяем удаленные
            const allDeleted = await this.syncDeletedContractors();
            
            // 2. Получаем текущие контрагенты
            const contractors = this.appState.getAllContractors();
            
            // 3. Фильтруем удаленных
            const deletedIds = new Set(allDeleted.map(d => d.id));
            const filteredContractors = contractors.filter(c => !deletedIds.has(c.id));
            
            // 4. Сохраняем отфильтрованные контрагенты
            if (filteredContractors.length !== contractors.length) {
                this.appState.contractors = filteredContractors;
                this.appState.saveContractors();
                console.log(`✅ Локальные контрагенты обновлены: удалено ${contractors.length - filteredContractors.length}`);
            }
            
            // 5. Синхронизируем с облаком
            const syncedContractors = await this.syncContractors(filteredContractors);
            
            if (syncedContractors && syncedContractors.length > 0) {
                this.appState.contractors = syncedContractors;
                this.appState.saveContractors();
                console.log(`✅ Контрагенты синхронизированы: ${syncedContractors.length}`);
            }
            
            // 6. Синхронизируем отчеты
            const reports = this.appState.getAllReports();
            const syncedReports = await this.syncReports(reports);
            
            if (syncedReports && syncedReports.length > 0) {
                this.appState.reports = syncedReports;
                this.appState.saveReports();
                console.log(`✅ Отчеты синхронизированы: ${syncedReports.length}`);
            }
            
            // 7. Обновляем время синхронизации
            localStorage.setItem('honest_sign_last_sync', new Date().toISOString());
            
            console.log('✅ Полная синхронизация с удалением завершена');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка принудительной синхронизации:', error);
            return false;
        }
    }

    async clearDeletedContractorsList() {
        if (!this.isConnected || !this.db) {
            console.log('ℹ️ Firebase не подключен');
            return false;
        }
        
        try {
            console.log('🧹 Очистка списка удаленных контрагентов...');
            
            const deletedDocRef = this.db.collection(this.baseCollectionPath).doc(this.userId)
                .collection('qr_scanner_production_v1').doc('deleted_contractors');
            
            // Удаляем документ с удаленными контрагентами
            await deletedDocRef.delete();
            
            console.log('✅ Список удаленных контрагентов очищен');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка очистки списка удаленных контрагентов:', error);
            return false;
        }
    }
    
    async forceDeleteContractor(contractorId) {
        if (!this.isConnected || !this.db) {
            console.log('ℹ️ Firebase не подключен');
            return false;
        }
        
        try {
            console.log(`🗑️ Принудительное удаление контрагента ID: ${contractorId}`);
            
            // Удаляем контрагента из всех пользователей
            const allUsers = await this.getAllUsers();
            let deletedCount = 0;
            
            for (const user of allUsers) {
                try {
                    const userDocRef = this.db.collection(this.baseCollectionPath).doc(user.id);
                    const contractorsDocRef = userDocRef.collection('qr_scanner_production_v1').doc('contractors');
                    
                    // Получаем контрагентов пользователя
                    const doc = await contractorsDocRef.get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.contractors && Array.isArray(data.contractors)) {
                            // Фильтруем удаляемого контрагента
                            const filtered = data.contractors.filter(c => c.id !== contractorId);
                            
                            if (filtered.length !== data.contractors.length) {
                                // Сохраняем обновленный список
                                await contractorsDocRef.set({
                                    contractors: filtered,
                                    count: filtered.length,
                                    lastUpdate: new Date().toISOString()
                                }, { merge: true });
                                
                                deletedCount++;
                                console.log(`✅ Удален у пользователя ${user.id.substring(0, 10)}...`);
                            }
                        }
                    }
                } catch (userError) {
                    console.error(`❌ Ошибка удаления у пользователя ${user.id}:`, userError);
                }
            }
            
            console.log(`✅ Принудительно удален контрагент ID:${contractorId} у ${deletedCount} пользователей`);
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка принудительного удаления контрагента:', error);
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
