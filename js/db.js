/**
 * IndexedDB 数据库操作工具
 */
class InviteDB {
    constructor() {
        this.dbName = 'inviteShareDB';
        this.dbVersion = 1;
        this.db = null;
        this.initPromise = this.init();
    }

    /**
     * 初始化数据库
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('数据库打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('数据库连接成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('数据库升级');

                // 创建配置表
                if (!db.objectStoreNames.contains('config')) {
                    const configStore = db.createObjectStore('config', { keyPath: 'key' });
                    
                    // 初始化默认配置
                    const defaultConfigs = [
                        { key: 'invitePrice', value: 1.2 },                     // 邀请单价
                        { key: 'todayCount', value: 3 },                      // 今日新增
                        { key: 'totalCount', value: 8653 },                   // 总邀请人数
                        { key: 'inviteCode', value: '6985' },                 // 邀请码
                        { key: 'inviteDisplayCount', value: 6 },              // 邀请界面显示条数
                        { key: 'refreshRules', value: [
                            { increment: 0, probability: 50 },
                            { increment: 1, probability: 30 },
                            { increment: 2, probability: 15 },
                            { increment: 3, probability: 5 }
                        ]}                                                   // 下拉刷新规则
                    ];
                    
                    defaultConfigs.forEach(config => {
                        configStore.add(config);
                    });
                }

                // 创建邀请记录表
                if (!db.objectStoreNames.contains('invites')) {
                    const inviteStore = db.createObjectStore('invites', { keyPath: 'id', autoIncrement: true });
                    inviteStore.createIndex('timestamp', 'timestamp', { unique: false });

                    // 生成一些初始的邀请记录
                    const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];
                    const avatarColors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#34495e'];
                    const now = Date.now();
                    const oneDay = 24 * 60 * 60 * 1000;
                    
                    const initialInvites = [];
                    for (let i = 0; i < 20; i++) {
                        const nameIndex = Math.floor(Math.random() * names.length);
                        const colorIndex = Math.floor(Math.random() * avatarColors.length);
                        
                        initialInvites.push({
                            name: names[nameIndex],
                            phone: `1${Math.floor(Math.random() * 9 + 1)}${Math.random().toString().slice(2, 10)}`,
                            timestamp: now - Math.floor(Math.random() * 10) * oneDay,
                            avatarColor: avatarColors[colorIndex],
                            amount: 5
                        });
                    }
                    
                    initialInvites.forEach(invite => {
                        inviteStore.add(invite);
                    });
                }
            };
        });
    }

    /**
     * 获取配置值
     * @param {string} key - 配置键
     * @returns {Promise<any>} - 配置值
     */
    async getConfig(key) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 设置配置值
     * @param {string} key - 配置键
     * @param {any} value - 配置值
     * @returns {Promise<void>}
     */
    async setConfig(key, value) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');
            const request = store.put({ key, value });

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取所有配置
     * @returns {Promise<Object>} - 所有配置的对象
     */
    async getAllConfig() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.getAll();

            request.onsuccess = () => {
                const configs = {};
                request.result.forEach(item => {
                    configs[item.key] = item.value;
                });
                resolve(configs);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取邀请记录
     * @param {number} limit - 限制数量
     * @returns {Promise<Array>} - 邀请记录数组
     */
    async getInvites(limit = 10) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invites'], 'readonly');
            const store = transaction.objectStore('invites');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');

            const invites = [];
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    invites.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(invites);
                }
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 添加邀请记录
     * @param {Object} invite - 邀请记录
     * @returns {Promise<number>} - 新记录的ID
     */
    async addInvite(invite) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invites'], 'readwrite');
            const store = transaction.objectStore('invites');
            const request = store.add({
                ...invite,
                timestamp: invite.timestamp || Date.now()
            });

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 执行下拉刷新增加用户
     * @returns {Promise<number>} - 增加的用户数
     */
    async refreshAddUsers() {
        const rules = await this.getConfig('refreshRules');
        const invitePrice = await this.getConfig('invitePrice');
        
        // 根据概率随机选择一个增长规则
        let random = Math.random() * 100;
        let cumulativeProbability = 0;
        let selectedRule = rules[0];
        
        for (const rule of rules) {
            cumulativeProbability += rule.probability;
            if (random <= cumulativeProbability) {
                selectedRule = rule;
                break;
            }
        }
        
        const increment = selectedRule.increment;
        
        if (increment > 0) {
            // 更新今日新增和总人数
            const currentTodayCount = await this.getConfig('todayCount');
            const currentTotalCount = await this.getConfig('totalCount');
            
            await this.setConfig('todayCount', currentTodayCount + increment);
            await this.setConfig('totalCount', currentTotalCount + increment);
            
            // 如果有新增用户，添加邀请记录
            const names = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫'];
            const avatarColors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#34495e'];
            
            for (let i = 0; i < increment; i++) {
                const nameIndex = Math.floor(Math.random() * names.length);
                const colorIndex = Math.floor(Math.random() * avatarColors.length);
                const surname = names[nameIndex];
                const name = surname + this.generateRandomChineseName(1);
                
                await this.addInvite({
                    name: name,
                    phone: `1${Math.floor(Math.random() * 9 + 1)}${Math.random().toString().slice(2, 10)}`,
                    timestamp: Date.now() - Math.floor(Math.random() * 3600 * 1000), // 随机1小时内
                    avatarColor: avatarColors[colorIndex],
                    amount: invitePrice
                });
            }
        }
        
        return increment;
    }
    
    /**
     * 生成随机中文名字
     * @param {number} length - 名字长度
     * @returns {string} - 随机中文名字
     */
    generateRandomChineseName(length) {
        const nameChars = '明东林华国建立志远山水木火土金天正平学诚如荣宝永祥伟涛强军磊晓';
        let result = '';
        for (let i = 0; i < length; i++) {
            const index = Math.floor(Math.random() * nameChars.length);
            result += nameChars[index];
        }
        return result;
    }
}

// 创建全局数据库实例
const inviteDB = new InviteDB(); 
