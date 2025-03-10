document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('invite.html')) {
        initInvitePage();
        addInviteEventListeners();
    } else if (currentPath.includes('task.html')) {
        initTaskPage();
    } else if (currentPath.includes('my.html')) {
        initMyPage();
        addMyEventListeners();
    } else if (currentPath.includes('admin.html')) {
        initAdminPage();
        addAdminEventListeners();
    } else {
        initIndexPage();
    }
    
    initPullToRefresh();
    setActiveNavItem();
});

// 全局邀请记录缓存 - 存储最新的邀请记录
const inviteCache = {
    records: [], // 邀请记录数组
    isInitialized: false, // 是否已初始化
    clearNewMarksTimer: null, // 清除新标记的定时器
    
    // 初始化缓存
    async initialize(count = 10) {
        if (this.isInitialized) return this.records;
        
        try {
            // 从数据库加载记录
            const records = await inviteDB.getInvites(count);
            this.records = records;
            this.isInitialized = true;
            console.log('邀请记录缓存已初始化:', this.records.length, '条记录');
            return this.records;
        } catch (error) {
            console.error('初始化邀请记录缓存失败:', error);
            return [];
        }
    },
    
    // 添加新记录
    addRecords(newRecords) {
        if (!Array.isArray(newRecords)) {
            newRecords = [newRecords]; // 转换为数组
        }
        
        // 添加isNew标记
        newRecords.forEach(record => {
            record.isNew = true;
        });
        
        // 合并记录并按时间戳降序排序
        this.records = [...newRecords, ...this.records]
            .sort((a, b) => b.timestamp - a.timestamp);
            
        console.log('缓存已更新:', this.records.length, '条记录，新增', newRecords.length, '条');
        
        // 设置10秒后自动清除"新"标记
        this.scheduleNewMarksClear();
        
        return this.records;
    },
    
    // 获取指定数量的记录
    getRecords(count = 10) {
        return this.records.slice(0, count);
    },
    
    // 清除所有"新"标记
    clearNewFlags() {
        this.records.forEach(record => {
            record.isNew = false;
        });
        console.log('已清除所有新记录标记');
    },
    
    // 安排自动清除"新"标记
    scheduleNewMarksClear(delay = 10000) { // 默认10秒
        // 清除现有定时器
        if (this.clearNewMarksTimer) {
            clearTimeout(this.clearNewMarksTimer);
        }
        
        // 设置新的定时器
        this.clearNewMarksTimer = setTimeout(() => {
            this.clearNewFlags();
            // 如果在邀请页面，更新显示
            if (window.location.pathname.includes('invite.html')) {
                const container = document.getElementById('invite-list-container');
                if (container) {
                    // 移除所有高亮效果
                    document.querySelectorAll('.invite-record.new-invite-highlight').forEach(el => {
                        el.classList.remove('new-invite-highlight');
                        el.querySelector('.new-badge')?.remove();
                    });
                }
            }
        }, delay);
    }
};

// 首页相关函数
async function initIndexPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        updateStatistics(configs);
    } catch (error) {
        console.error('初始化首页数据失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function updateStatistics(configs) {
    const todayCount = document.getElementById('today-count');
    const totalCount = document.getElementById('total-count');
    const todayEarnings = document.getElementById('today-earnings');
    const totalEarnings = document.getElementById('total-earnings');
    
    if (todayCount) {
        todayCount.textContent = configs.todayCount;
    }
    
    if (totalCount) {
        totalCount.textContent = configs.totalCount;
    }
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `¥${earnings}`;
    }
    
    if (totalEarnings) {
        const earnings = (configs.totalCount * configs.invitePrice).toFixed(2);
        totalEarnings.textContent = `¥${earnings}`;
    }
}

// 邀请页面相关函数
async function initInvitePage() {
    try {
        // 获取配置数据
        const configs = await inviteDB.getAllConfig();
        
        // 设置邀请码
        const inviteCodeElement = document.getElementById('invite-code');
        if (inviteCodeElement) {
            inviteCodeElement.textContent = configs.inviteCode;
        }
        
        // 更新统计数据
        updateInviteStatistics(configs);
        
        // 初始化邀请记录缓存并渲染列表
        const displayCount = configs.inviteDisplayCount || 10;
        await inviteCache.initialize(displayCount);
        renderInviteList(inviteCache.getRecords(displayCount));
        
    } catch (error) {
        console.error('初始化邀请页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function addInviteEventListeners() {
    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', async function() {
            const inviteCode = document.getElementById('invite-code').textContent;
            try {
                await copyToClipboard(inviteCode);
                showToast('邀请码已复制到剪贴板');
            } catch (error) {
                console.error('复制邀请码失败:', error);
                showToast('复制失败，请手动复制');
            }
        });
    }
}

function updateInviteStatistics(configs) {
    const todayCount = document.getElementById('today-count');
    const totalCount = document.getElementById('total-count');
    const todayEarnings = document.getElementById('today-earnings');
    const totalEarnings = document.getElementById('total-earnings');
    const inviteTotalCount = document.getElementById('invite-total-count');
    
    if (todayCount) {
        todayCount.textContent = configs.todayCount;
    }
    
    if (totalCount) {
        totalCount.textContent = configs.totalCount;
    }
    
    if (inviteTotalCount) {
        inviteTotalCount.textContent = configs.totalCount;
    }
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `¥${earnings}`;
    }
    
    if (totalEarnings) {
        const earnings = (configs.totalCount * configs.invitePrice).toFixed(2);
        totalEarnings.textContent = `¥${earnings}`;
    }
}

// 将updateInviteList函数添加到全局作用域
window.updateInviteList = updateInviteList;

async function updateInviteList() {
    try {
        console.log('开始更新邀请列表...');
        
        // 获取显示数量
        const displayCount = await inviteDB.getConfig('inviteDisplayCount') || 10;
        console.log('需要显示的邀请记录数量:', displayCount);
        
        // 如果缓存未初始化，先初始化
        if (!inviteCache.isInitialized) {
            await inviteCache.initialize(displayCount);
        }
        
        // 获取记录并渲染
        const records = inviteCache.getRecords(displayCount);
        renderInviteList(records);
        
        console.log('邀请列表更新完成，显示', records.length, '条记录');
    } catch (error) {
        console.error('更新邀请列表失败:', error);
    }
}

// 将renderInviteList函数添加到全局作用域
window.renderInviteList = renderInviteList;

function renderInviteList(invites) {
    const container = document.getElementById('invite-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!invites || invites.length === 0) {
        container.innerHTML = '<div class="text-center py-5 text-gray-500">暂无邀请记录</div>';
        return;
    }
    
    invites.forEach(invite => {
        const inviteEl = document.createElement('div');
        
        // 判断是否为新增用户，添加高亮样式
        const isNewInvite = invite.isNew === true;
        inviteEl.className = isNewInvite 
            ? 'invite-record fade-in new-invite-highlight' 
            : 'invite-record fade-in';
        
        // 获取昵称的第一个字符，处理emoji的情况
        let firstChar = invite.name.charAt(0);
        // 如果第一个字符是emoji（通常是4字节的UTF-16编码），则使用它
        if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(invite.name.substring(0, 2))) {
            firstChar = invite.name.substring(0, 2);
        }
        
        inviteEl.innerHTML = `
            <div class="avatar" style="background-color: ${invite.avatarColor || '#3498db'}">
                ${firstChar}
            </div>
            <div class="invite-info">
                <div class="invite-name">${invite.name}</div>
                <div class="invite-time">${formatDateTime(invite.timestamp)}</div>
            </div>
            <div class="invite-amount">+¥${invite.amount.toFixed(2)}</div>
            ${isNewInvite ? '<div class="new-badge">新</div>' : ''}
        `;
        
        container.appendChild(inviteEl);
    });
}

// 任务页面相关函数
async function initTaskPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        updateTaskStatistics(configs);
    } catch (error) {
        console.error('初始化任务页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function updateTaskStatistics(configs) {
    const todayEarnings = document.getElementById('today-earnings');
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `¥${earnings}`;
    }
}

// 个人中心页面相关函数
async function initMyPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        
        const inviteCodeElement = document.getElementById('invite-code');
        if (inviteCodeElement) {
            inviteCodeElement.textContent = configs.inviteCode;
        }
        
        updateMyStatistics(configs);
        
    } catch (error) {
        console.error('初始化个人中心页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function addMyEventListeners() {
    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', async function() {
            const inviteCode = document.getElementById('invite-code').textContent;
            try {
                await copyToClipboard(inviteCode);
                showToast('邀请码已复制到剪贴板');
            } catch (error) {
                console.error('复制邀请码失败:', error);
                showToast('复制失败，请手动复制');
            }
        });
    }
}

function updateMyStatistics(configs) {
    const totalCount = document.getElementById('total-count');
    const todayEarnings = document.getElementById('today-earnings');
    const totalEarnings = document.getElementById('total-earnings');
    
    if (totalCount) {
        totalCount.textContent = `${configs.totalCount}人`;
    }
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `+¥${earnings}`;
    }
    
    if (totalEarnings) {
        const earnings = (configs.totalCount * configs.invitePrice).toFixed(2);
        totalEarnings.textContent = earnings;
    }
}

// 管理页面相关函数
async function initAdminPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        fillFormData(configs);
        renderRules(configs.refreshRules);
    } catch (error) {
        console.error('初始化管理后台页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function fillFormData(configs) {
    document.getElementById('invite-price').value = configs.invitePrice;
    document.getElementById('today-count').value = configs.todayCount;
    document.getElementById('total-count').value = configs.totalCount;
    document.getElementById('invite-code').value = configs.inviteCode;
    document.getElementById('invite-display-count').value = configs.inviteDisplayCount;
}

function renderRules(rules) {
    const container = document.getElementById('rules-container');
    container.innerHTML = '';
    
    if (!rules || rules.length === 0) {
        return;
    }
    
    const template = document.getElementById('rule-template');
    
    rules.forEach(rule => {
        const ruleElement = document.importNode(template.content, true);
        
        ruleElement.querySelector('.rule-increment').value = rule.increment;
        ruleElement.querySelector('.rule-probability').value = rule.probability;
        
        ruleElement.querySelector('.delete-rule').addEventListener('click', function() {
            this.closest('.rule-item').remove();
        });
        
        container.appendChild(ruleElement);
    });
}

function addAdminEventListeners() {
    document.getElementById('add-rule-btn').addEventListener('click', function() {
        const template = document.getElementById('rule-template');
        const ruleElement = document.importNode(template.content, true);
        
        // 确保添加的规则输入框使用正确的属性
        ruleElement.querySelector('.rule-increment').value = "0";
        ruleElement.querySelector('.rule-increment').min = "0";
        ruleElement.querySelector('.rule-probability').value = "0";
        ruleElement.querySelector('.rule-probability').min = "0";
        ruleElement.querySelector('.rule-probability').max = "100";
        ruleElement.querySelector('.rule-probability').step = "0.1";
        
        ruleElement.querySelector('.delete-rule').addEventListener('click', function() {
            this.closest('.rule-item').remove();
        });
        
        document.getElementById('rules-container').appendChild(ruleElement);
    });
    
    document.getElementById('save-settings-btn').addEventListener('click', async function() {
        await saveSettings();
    });
    
    document.getElementById('reset-all-btn').addEventListener('click', function() {
        if (confirm('确定要重置所有数据吗？此操作不可恢复！')) {
            resetAllData();
        }
    });
}

async function saveSettings() {
    try {
        const invitePrice = parseFloat(document.getElementById('invite-price').value);
        const todayCount = parseInt(document.getElementById('today-count').value);
        const totalCount = parseInt(document.getElementById('total-count').value);
        const inviteCode = document.getElementById('invite-code').value;
        const inviteDisplayCount = parseInt(document.getElementById('invite-display-count').value);
        
        if (isNaN(invitePrice) || invitePrice < 0) {
            showToast('邀请单价不能为负数');
            return;
        }
        
        if (isNaN(todayCount) || todayCount < 0) {
            showToast('今日新增用户不能为负数');
            return;
        }
        
        if (isNaN(totalCount) || totalCount < 0) {
            showToast('总邀请人数不能为负数');
            return;
        }
        
        if (!inviteCode.trim()) {
            showToast('邀请码不能为空');
            return;
        }
        
        if (isNaN(inviteDisplayCount) || inviteDisplayCount < 1) {
            showToast('邀请界面显示条数必须大于0');
            return;
        }
        
        const rules = [];
        const ruleItems = document.querySelectorAll('.rule-item');
        let totalProbability = 0;
        
        ruleItems.forEach(item => {
            const increment = parseInt(item.querySelector('.rule-increment').value);
            const probability = parseFloat(item.querySelector('.rule-probability').value);
            
            if (!isNaN(increment) && !isNaN(probability) && increment >= 0 && probability >= 0) {
                rules.push({ increment, probability });
                totalProbability += probability;
                console.log(`添加规则: 增长人数=${increment}, 概率=${probability}%`);
            } else {
                console.warn(`忽略无效规则: 增长人数=${increment}, 概率=${probability}%`);
            }
        });
        
        if (rules.length === 0) {
            showToast('至少需要添加一条规则');
            return;
        }
        
        // 添加日志以便于调试
        console.log('规则总概率:', totalProbability);
        
        // 放宽对总概率的要求，允许有0.5%的误差
        if (Math.abs(totalProbability - 100) > 0.5) {
            showToast(`所有规则的概率之和必须接近100%，当前总和为${totalProbability}%`);
            return;
        }
        
        await inviteDB.setConfig('invitePrice', invitePrice);
        await inviteDB.setConfig('todayCount', todayCount);
        await inviteDB.setConfig('totalCount', totalCount);
        await inviteDB.setConfig('inviteCode', inviteCode);
        await inviteDB.setConfig('inviteDisplayCount', inviteDisplayCount);
        await inviteDB.setConfig('refreshRules', rules);
        
        console.log('保存的规则:', rules);
        
        // 显示更详细的成功信息
        showToast(`设置保存成功！共保存了${rules.length}条规则，总概率: ${totalProbability.toFixed(1)}%`);
    } catch (error) {
        console.error('保存设置失败:', error);
        showToast('保存设置失败，请重试');
    }
}

async function resetAllData() {
    try {
        const DBDeleteRequest = indexedDB.deleteDatabase('inviteShareDB');
        
        DBDeleteRequest.onsuccess = function() {
            window.location.reload();
        };
        
        DBDeleteRequest.onerror = function() {
            showToast('重置数据失败，请重试');
        };
    } catch (error) {
        console.error('重置数据失败:', error);
        showToast('重置数据失败，请重试');
    }
} 
