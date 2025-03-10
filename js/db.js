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
                    const avatarColors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#34495e'];
                    const now = Date.now();
                    const oneDay = 24 * 60 * 60 * 1000;
                    
                    // 微信风格的昵称列表
                    const wechatNicknames = [
                        '小可爱😊', '阳光男孩', '微笑🌸', '快乐每一天', '幸福如意', 
                        'Amy123', 'Bob', 'Cathy🍀', 'David888', 'Emma', 
                        '😎酷酷的我', '🌟星星点灯', '✨闪闪惹人爱', '🌈彩虹糖果', '🌸樱花雨',
                        '李明', '王小花', '张大山', '刘晓华', '陈志远'
                    ];
                    
                    const initialInvites = [];
                    
                    for (let i = 0; i < 20; i++) {
                        const colorIndex = Math.floor(Math.random() * avatarColors.length);
                        const nicknameIndex = Math.floor(Math.random() * wechatNicknames.length);
                        
                        initialInvites.push({
                            name: wechatNicknames[nicknameIndex],
                            phone: `1${Math.floor(Math.random() * 9 + 1)}${Math.random().toString().slice(2, 10)}`,
                            timestamp: now - Math.floor(Math.random() * 10) * oneDay,
                            avatarColor: avatarColors[colorIndex],
                            amount: 1.2
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
            // 使用新的事务和新的请求，确保获取最新数据
            const transaction = this.db.transaction(['invites'], 'readonly');
            const store = transaction.objectStore('invites');
            const index = store.index('timestamp');
            
            // 添加事务完成事件处理
            transaction.oncomplete = () => {
                console.log('获取邀请记录事务完成，共获取到', invites.length, '条记录');
            };
            
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
                console.error('获取邀请记录失败:', event.target.error);
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
            
            // 添加事务完成事件处理
            transaction.oncomplete = () => {
                console.log('添加邀请记录事务完成');
            };
            
            transaction.onerror = (event) => {
                console.error('添加邀请记录事务失败:', event.target.error);
                reject(event.target.error);
            };
            
            const store = transaction.objectStore('invites');
            const request = store.add({
                ...invite,
                timestamp: invite.timestamp || Date.now()
            });

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('添加邀请记录请求失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 执行下拉刷新增加用户
     * @returns {Promise<Object>} - 返回包含增加数量和新增用户记录的对象
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
        const newInvites = []; // 存储新增的邀请记录
        
        if (increment > 0) {
            // 更新今日新增和总人数
            const currentTodayCount = await this.getConfig('todayCount');
            const currentTotalCount = await this.getConfig('totalCount');
            
            await this.setConfig('todayCount', currentTodayCount + increment);
            await this.setConfig('totalCount', currentTotalCount + increment);
            
            // 如果有新增用户，添加邀请记录
            const avatarColors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#34495e'];
            
            // 创建一个Promise数组，用于存储所有添加用户的Promise
            const addPromises = [];
            
            for (let i = 0; i < increment; i++) {
                const colorIndex = Math.floor(Math.random() * avatarColors.length);
                // 使用新的方法生成微信风格的昵称
                const name = this.generateWeChatNickname();
                
                // 创建新用户记录
                const newInvite = {
                    name: name,
                    phone: `1${Math.floor(Math.random() * 9 + 1)}${Math.random().toString().slice(2, 10)}`,
                    timestamp: Date.now() - Math.floor(Math.random() * 3600 * 1000), // 随机1小时内
                    avatarColor: avatarColors[colorIndex],
                    amount: invitePrice
                };
                
                // 将新记录添加到数组
                newInvites.push(newInvite);
                
                // 将添加用户的Promise添加到数组中
                addPromises.push(this.addInvite(newInvite));
            }
            
            // 等待所有添加用户的Promise完成
            await Promise.all(addPromises);
            
            // 添加一个强制刷新的步骤，确保所有事务都已提交
            await new Promise(resolve => {
                const transaction = this.db.transaction(['invites'], 'readonly');
                transaction.oncomplete = () => resolve();
                const store = transaction.objectStore('invites');
                store.count();
            });
        }
        
        // 返回包含增加数量和新增记录的对象
        return {
            increment: increment,
            newInvites: newInvites
        };
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
    
    /**
     * 生成微信风格的昵称
     * @returns {string} - 微信风格的昵称
     */
    generateWeChatNickname() {
        const nicknameTypes = [
            // 中文网名
            () => {
                const netNames = [
                    '小可爱', '阳光', '微笑', '快乐', '幸福', '温柔', '可爱多', '甜心', '暖暖',
                    '星星', '月亮', '天空', '海洋', '云朵', '雨滴', '雪花', '花朵', '草莓', '柠檬',
                    '奶茶', '咖啡', '巧克力', '冰淇淋', '蛋糕', '糖果', '棒棒糖', '果冻', '布丁',
                    '小仙女', '小王子', '小公主', '小天使', '小魔王', '小恶魔', '小精灵', '小妖精',
                    '大宝贝', '小宝贝', '小可爱', '小甜心', '小宝宝', '小朋友', '小可爱', '小甜甜',
                    '阿狸', '皮卡丘', '哆啦A梦', '小熊维尼', '米老鼠', '唐老鸭', '加菲猫', '史努比'
                ];
                return netNames[Math.floor(Math.random() * netNames.length)];
            },
            
            // 英文名+数字
            () => {
                const engNames = [
                    'Amy', 'Bob', 'Cathy', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
                    'Kelly', 'Leo', 'Mia', 'Nick', 'Olivia', 'Peter', 'Queen', 'Ryan', 'Sophia', 'Tom',
                    'Uma', 'Victor', 'Wendy', 'Xander', 'Yolanda', 'Zack', 'Alice', 'Ben', 'Cindy', 'Daniel',
                    'Ella', 'Felix', 'Gina', 'Harry', 'Irene', 'Jason', 'Kate', 'Liam', 'Megan', 'Nathan'
                ];
                const name = engNames[Math.floor(Math.random() * engNames.length)];
                // 50%概率添加数字
                if (Math.random() > 0.5) {
                    return name + Math.floor(Math.random() * 1000);
                }
                return name;
            },
            
            // 带emoji的昵称
            () => {
                const emojis = ['😊', '😄', '😍', '🥰', '😎', '🤩', '🌟', '✨', '🌈', '🌸', '🌺', '🌼', '🌻', '🍀', '🍓', '🍒', '🍎', '🍉', '🍭', '🍬', '🧸', '🎀', '🎵', '🎮', '📱', '💻', '📷', '🏀', '⚽', '🏆'];
                const baseNames = ['小可爱', '阳光', '微笑', '快乐', '幸福', '温柔', 'Amy', 'Bob', 'Cathy', 'David', 'Emma', 'Frank', 'Grace'];
                const name = baseNames[Math.floor(Math.random() * baseNames.length)];
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                // 随机emoji位置
                return Math.random() > 0.5 ? `${emoji}${name}` : `${name}${emoji}`;
            },
            
            // 传统中文姓名
            () => {
                const surnames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫', '蒋', '沈', '韩', '杨', '朱', '秦', '尤', '许', '何', '吕', '施', '张', '孔', '曹', '严', '华', '金', '魏', '陶', '姜'];
                const nameChars = '明东林华国建立志远山水木火土金天正平学诚如荣宝永祥伟涛强军磊晓';
                const surname = surnames[Math.floor(Math.random() * surnames.length)];
                let name = '';
                for (let i = 0; i < (Math.random() > 0.7 ? 2 : 1); i++) {
                    name += nameChars[Math.floor(Math.random() * nameChars.length)];
                }
                return surname + name;
            }
        ];
        
        // 随机选择一种昵称类型
        const nicknameGenerator = nicknameTypes[Math.floor(Math.random() * nicknameTypes.length)];
        return nicknameGenerator();
    }
}

// 创建全局数据库实例
const inviteDB = new InviteDB(); 
