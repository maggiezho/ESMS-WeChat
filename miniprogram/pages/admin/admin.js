// pages/admin/admin.js
const db = wx.cloud.database()

Page({
  data: {
    list: [],
    currentTab: 0,
    isAuthorized: false,
    allList: [],
    countWaiting: 0,
    countToday: 0,
    searchTypes: ['手机号', '取件码'],
    searchTypeIndex: 0
  },

  onShow() {
    if (this.data.isAuthorized) {
      this.loadData();
    } else {
      this.checkPassword();
    }
  },

  checkPassword() {
    wx.showModal({
      title: '管理员验证',
      editable: true,
      placeholderText: '请输入密码',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '校验中...' })
          try {
            const result = await wx.cloud.callFunction({
              name: 'checkAdmin',
              data: { password: res.content }
            })
            wx.hideLoading()
            if (result.result.success) {
              this.setData({ isAuthorized: true });
              this.loadData();
            } else {
              wx.showToast({ title: '密码错误', icon: 'error' });
              setTimeout(() => { wx.switchTab({ url: '/pages/index/index' }) }, 1000);
            }
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '网络错误', icon: 'none' })
          }
        } else if (res.cancel) {
          wx.switchTab({ url: '/pages/index/index' });
        }
      }
    })
  },

  // ========== 管理员扫码取件（不变） ==========
  async adminScanTake() {
    try {
      const scanRes = await wx.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode', 'barCode']
      })
      
      // 解析二维码内容：格式 "取件码 | 手机号"
      const qrContent = scanRes.result
      let trackingCode = qrContent
      let phoneNum = ''
      
      // 尝试解析竖线分隔的格式
      if (qrContent.includes('|')) {
        const parts = qrContent.split('|')
        trackingCode = parts[0].trim()
        phoneNum = parts[1] ? parts[1].trim() : ''
      }
      
      wx.showLoading({ title: '查询中...' })
      
      // 根据取件码查询未取件的快递
      const res = await db.collection('parcels')
        .where({
          trackingCode: trackingCode,
          status: 0
        })
        .get()
      
      wx.hideLoading()
      
      if (res.data.length === 0) {
        wx.showModal({
          title: '未找到快递',
          content: `取件码 "${trackingCode}" 没有对应的待取快递，请确认是否正确。`,
          showCancel: false
        })
        return
      }
      
      let parcelToTake = res.data[0]
      if (res.data.length > 1) {
        const items = res.data.map(item => ({
          ...item,
          label: `${item.trackingCode} - ${item.shelfNo} - ${item.recipientPhone}`
        }))
        
        const actionRes = await new Promise((resolve) => {
          wx.showActionSheet({
            itemList: items.map(item => item.label),
            success: (result) => {
              resolve(items[result.tapIndex])
            },
            fail: () => {
              resolve(null)
            }
          })
        })
        
        if (!actionRes) return
        parcelToTake = actionRes
      }
      
      const confirmRes = await wx.showModal({
        title: '确认取件',
        content: `取件码：${parcelToTake.trackingCode}\n确认帮TA取走吗？`,
        confirmColor: '#07c160'
      })
      
      if (!confirmRes.confirm) return
      
      wx.showLoading({ title: '处理中...' })
      await db.collection('parcels').doc(parcelToTake._id).update({
        data: {
          status: 1,
          takeTime: new Date(),
          takenByAdmin: true
        }
      })
      
      wx.hideLoading()
      wx.showToast({ title: '取件成功', icon: 'success' })
      this.loadData()
      
    } catch (err) {
      console.error('扫码取件失败', err)
      wx.hideLoading()
      if (err.errMsg !== 'scanCode:fail cancel') {
        wx.showToast({ title: '操作失败', icon: 'error' })
      }
    }
  },

  // ========== 升级版：智能扫码入库（自动解析所有字段） ==========
  async adminScanAdd() {
    try {
      // 1. 扫描二维码
      const scanRes = await wx.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode', 'barCode']
      })
      
      const qrContent = scanRes.result
      console.log('扫描内容：', qrContent)
      
      // 2. 解析二维码内容
      // 格式：取件码 | 手机号
      // 取件码格式：货架号-层数-四位码（如 53-4-2001）
      let trackingCode = ''
      let phoneNum = ''
      
      if (qrContent.includes('|')) {
        const parts = qrContent.split('|')
        trackingCode = parts[0].trim()
        phoneNum = parts[1] ? parts[1].trim() : ''
      } else {
        // 兼容只有取件码的情况
        trackingCode = qrContent.trim()
        phoneNum = ''
      }
      
      // 3. 从取件码解析出货架位置
      // 取件码格式：货架号-层数-四位码（如 53-4-2001）
      const shelfNo = this.parseShelfNoFromTrackingCode(trackingCode)
      
      if (!shelfNo) {
        // 如果无法自动解析，让管理员手动输入
        wx.showModal({
          title: '解析提示',
          content: `取件码 "${trackingCode}" 格式不正确，无法自动识别货架位置。\n正确格式示例：53-4-2001\n将跳转到手动添加页面。`,
          showCancel: false,
          success: () => {
            this.goToAddWithData(trackingCode, phoneNum, '')
          }
        })
        return
      }
      
      // 4. 检查是否已有相同取件码的未取快递
      const checkRes = await db.collection('parcels')
        .where({
          trackingCode: trackingCode,
          status: 0
        })
        .get()
      
      if (checkRes.data.length > 0) {
        wx.showModal({
          title: '重复入库提示',
          content: `取件码 ${trackingCode} 已有待取快递！\n货架位置：${checkRes.data[0].shelfNo}\n收件人：${checkRes.data[0].recipientPhone}\n是否仍要添加？（同一取件码一般不应重复）`,
          confirmText: '仍要添加',
          confirmColor: '#ff9f43',
          success: async (res) => {
            if (res.confirm) {
              this.goToAddWithData(trackingCode, phoneNum, shelfNo)
            }
          }
        })
        return
      }
      
      // 5. 自动填充并跳转到添加页面
      this.goToAddWithData(trackingCode, phoneNum, shelfNo)
      
    } catch (err) {
      console.error('扫码入库失败', err)
      if (err.errMsg !== 'scanCode:fail cancel') {
        wx.showToast({ title: '扫码失败', icon: 'error' })
      }
    }
  },

  // 从取件码解析货架位置
  // 输入：53-4-2001 → 输出：53-4（货架号-层数）
  parseShelfNoFromTrackingCode(trackingCode) {
    if (!trackingCode) return ''
    
    // 匹配格式：数字-数字-数字
    const pattern = /^(\d+)-(\d+)-(\d+)$/
    const match = trackingCode.match(pattern)
    
    if (match) {
      // 返回 货架号-层数
      return `${match[1]}-${match[2]}`
    }
    
    return ''
  },

  // 跳转到添加页面并传递解析的数据
  goToAddWithData(trackingCode, phoneNum, shelfNo) {
    let url = `/pages/add/add?trackingCode=${encodeURIComponent(trackingCode)}`
    
    if (phoneNum) {
      url += `&recipientPhone=${encodeURIComponent(phoneNum)}`
    }
    
    if (shelfNo) {
      url += `&shelfNo=${encodeURIComponent(shelfNo)}`
    }
    
    url += `&fromScan=true`
    
    wx.navigateTo({ url })
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    if (!keyword) {
      this.setData({ list: this.data.allList });
      return;
    }
  
    const searchType = this.data.searchTypes[this.data.searchTypeIndex];
    const filtered = this.data.allList.filter(item => {
      if (searchType === '手机号') {
        return String(item.recipientPhone).includes(keyword);
      } else if (searchType === '取件码') {
        return String(item.trackingCode).includes(keyword);
      }
      return false;
    });
    this.setData({ list: filtered });
  },

  sendSMS(e) {
    const phone = e.currentTarget.dataset.phone;
    wx.showModal({
      title: '模拟发送短信',
      content: `即将发送通知给 ${phone}，是否确认？`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '提醒已发送', icon: 'success' });
        }
      }
    });
  },
  
  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab)
    this.setData({ currentTab: tab })
    this.loadData()
  },

  async loadData() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const allRes = await db.collection('parcels').orderBy('createTime', 'desc').get();
      const allList = allRes.data;
      
      // 定义格式化时间的辅助函数
      const formatTime = (time) => {
        if (!time) return '';
        const d = new Date(time);
        return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
      };

      // 预处理所有数据（格式化时间）
      const formattedAllList = allList.map(item => ({
        ...item,
        createTimeFormatted: formatTime(item.createTime),
        takeTimeFormatted: formatTime(item.takeTime)
      }));

      // 筛选待取件数据
      const formattedWaitingList = formattedAllList.filter(item => item.status === 0);
      
      // 根据当前 tab 决定渲染哪一份列表
      const displayList = (this.data.currentTab === 0) ? formattedWaitingList : formattedAllList;
      
      this.setData({
        list: displayList,
        allList: formattedAllList, // 保存格式化后的完整数据，以便搜索过滤
        countWaiting: formattedWaitingList.length,
        countAll: formattedAllList.length
      });
      
      this.getStatistics();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSearchTypeChange(e) {
    this.setData({
      searchTypeIndex: e.detail.value
    });
    const searchInput = wx.createSelectorQuery().select('.search-input');
    searchInput.fields({ value: true }, res => {
      if (res && res.value) {
        this.onSearchInput({ detail: { value: res.value } });
      }
    }).exec();
  },
  
  // admin.js 中的 getStatistics 函数
  async getStatistics() {
    const res = await db.collection('parcels').get();
    const allData = res.data;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  
    // 统计今日入库：根据 createTime
    const countTodayIn = allData.filter(i => {
      if (!i.createTime) return false;
      const d = new Date(i.createTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayStr;
    }).length;
  
    // 统计今日取件：根据 takeTime
    const countTodayOut = allData.filter(i => {
      if (!i.takeTime) return false;
      const d = new Date(i.takeTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayStr;
    }).length;
  
    this.setData({ countTodayIn, countTodayOut });
  },

  goToAdd() {
    wx.navigateTo({
      url: '/pages/add/add'
    })
  },

  editParcel(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/add/add?id=${id}`
    })
  },

  async deleteParcel(e) {
    const id = e.currentTarget.dataset.id
    
    const result = await wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除吗？',
      confirmColor: '#fa5151'
    })
    
    if (!result.confirm) return
    
    wx.showLoading({ title: '删除中...' })
    
    try {
      await db.collection('parcels').doc(id).remove()
      wx.showToast({ title: '删除成功', icon: 'success' })
      this.loadData()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '删除失败', icon: 'error' })
    } finally {
      wx.hideLoading()
    }
  }
})