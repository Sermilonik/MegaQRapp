// firebase-sync.js
class FirebaseSync {
    constructor(appState) {
        this.appState = appState;
        this.db = null;
        this.auth = null;
        this.isConnected = false;
        this.userId = null;
        this.deviceId = appState ? appState.deviceId : null;
    }
    
    async init() {
        try {
            console.log('🔥 Инициализация FirebaseSync...');
            
            // Проверяем Firebase
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
            
            // Пробуем анонимную аутентификацию
            try {
                await this.auth.signInAnonymously();
                this.userId = this.auth.currentUser.uid;
                this.isConnected = true;
                console.log('✅ FirebaseSync подключен, User ID:', this.userId);
                return true;
            } catch (authError) {
                console.log('⚠️ Анонимная аутентификация не удалась, работаем локально');
                this.isConnected = false;
                return false;
            }
            
        } catch (error) {
            console.error('❌ Ошибка инициализации FirebaseSync:', error);
            this.isConnected = false;
            return false;
        }
    }
    
    async syncContractors(contractors) {
        if (!this.isConnected || !this.db) {
            console.log('ℹ️ Firebase не подключен, пропускаем синхронизацию');
            return contractors;
        }
        
        try {
            console.log('🔄 Синхронизация контрагентов...');
            
            // Используем общую коллекцию для всех пользователей
            const collectionRef = this.db.collection('contractors');
            
            // Получаем из облака
            const snapshot = await collectionRef.get();
            const cloudContractors = [];
            
            snapshot.forEach(doc => {
                cloudContractors.push({ 
                    id: doc.id, 
                    ...doc.data(),
                    firebaseId: doc.id // Сохраняем Firebase ID
                });
            });
            
            console.log(`📊 Облачные: ${cloudContractors.length}, Локальные: ${contractors.length}`);
            
            // Объединяем данные
            const merged = this.mergeContractorsData(contractors, cloudContractors);
            
            // Сохраняем обратно в облако
            await this.saveContractorsToCloud(merged);
            
            return merged;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации контрагентов:', error);
            return contractors;
        }
    }
    
    mergeContractorsData(local, cloud) {
        const merged = [...local];
        
        // Создаем карту для быстрого поиска
        const localMap = new Map();
        local.forEach(c => localMap.set(c.id, c));
        
        cloud.forEach(cloudContractor => {
            const localContractor = localMap.get(cloudContractor.id);
            
            if (localContractor) {
                // Сравниваем даты обновления
                const localDate = new Date(localContractor.updatedAt || localContractor.createdAt);
                const cloudDate = new Date(cloudContractor.updatedAt || cloudContractor.createdAt);
                
                if (cloudDate > localDate) {
                    // Обновляем локальные данные облачными
                    const index = merged.findIndex(c => c.id === cloudContractor.id);
                    if (index !== -1) {
                        merged[index] = cloudContractor;
                    }
                }
            } else {
                // Добавляем новый контрагент из облака
                merged.push(cloudContractor);
            }
        });
        
        return merged;
    }
    
    async saveContractorsToCloud(contractors) {
        if (!this.isConnected || !this.db) return;
        
        try {
            const batch = this.db.batch();
            const collectionRef = this.db.collection('contractors');
            
            // Сохраняем только свои контрагенты (с deviceId)
            const myContractors = contractors.filter(c => c.deviceId === this.deviceId);
            
            myContractors.forEach(contractor => {
                const docId = contractor.id.toString();
                const docRef = collectionRef.doc(docId);
                
                batch.set(docRef, {
                    ...contractor,
                    updatedAt: new Date().toISOString(),
                    lastSync: new Date().toISOString()
                }, { merge: true });
            });
            
            await batch.commit();
            console.log(`✅ Сохранено ${myContractors.length} контрагентов в облако`);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения в облако:', error);
        }
    }
    
    getStatus() {
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            deviceId: this.deviceId
        };
    }
}
