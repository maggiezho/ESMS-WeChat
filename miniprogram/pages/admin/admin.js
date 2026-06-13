// pages/admin/admin.js
const db = wx.cloud.database()

Page({
  data: {
    list: [],
    currentTab: 0,
    isAuthorized: false, // 增加一个状态标识
    allList: [], // 存储从云数据库拉取的全部原始数据
    countWaiting: 0,
    countToday: 0,
    searchTypes: ['手机号', '取件码'], // 下拉选项
    searchTypeIndex: 0
  },

  onShow() {
    // 只有在已授权的情况下才自动加载数据
    if (this.data.isAuthorized) {
      this.loadData();
    } else {
      this.checkPassword();
    }
  },

  // 密码校验逻辑
  checkPassword() {
    wx.showModal({
      title: '管理员验证',
      content: '',
      editable: true, // 开启输入框
      placeholderText: '请输入密码',
      success: (res) => {
        if (res.confirm) {
          // 这里设置你的课设密码，例如 123456
          if (res.content === '123456') {
            this.setData({ isAuthorized: true });
            this.loadData();
          } else {
            wx.showToast({ title: '密码错误', icon: 'error' });
            // 密码错误返回首页或重试
            setTimeout(() => { wx.switchTab({ url: '/pages/index/index' }) }, 1000);
          }
        } else if (res.cancel) {
          wx.switchTab({ url: '/pages/index/index' });
        }
      }
    })
  },

  // 搜索触发函数
  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    // 如果没有关键字，恢复全量数据
    if (!keyword) {
      this.setData({ list: this.data.allList });
      return;
    }
  
    // 获取当前选中的搜索类型
    const searchType = this.data.searchTypes[this.data.searchTypeIndex];
    // 根据类型过滤
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
      let query = db.collection('parcels')
      
      if (this.data.currentTab === 0) {
        query = query.where({ status: 0 })
      }
      
      const res = await query.orderBy('createTime', 'desc').get()
      
      const list = res.data.map(item => {
        let createTimeFormatted = ''
        if (item.createTime) {
          const d = new Date(item.createTime)
          createTimeFormatted = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
        }
        return { ...item, createTimeFormatted }
      })
      
      this.setData({
          list: list,      // 页面显示用
          allList: list    // 备份一份，搜索时永远从这里过滤
        })
      this.getStatistics()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 切换搜索类型
  onSearchTypeChange(e) {
    this.setData({
      searchTypeIndex: e.detail.value
    });
    // 切换后重新触发搜索（如果有输入内容）
    const searchInput = wx.createSelectorQuery().select('.search-input');
    searchInput.fields({ value: true }, res => {
      if (res.value) {
        this.onSearchInput({ detail: { value: res.value } });
      }
    }).exec();
  },
  
  async getStatistics() {
    // 获取云端全部数据
    const res = await db.collection('parcels').get();
    const allData = res.data;
    
    const now = new Date();
    
    const countWaiting = allData.filter(i => i.status === 0).length;
    
    const countToday = allData.filter(i => {
      // 确保 i.createTime 存在
      if (!i.createTime) return false;
      const d = new Date(i.createTime);
      // 判断年、月、日是否相等
      return d.getFullYear() === now.getFullYear() && 
             d.getMonth() === now.getMonth() && 
             d.getDate() === now.getDate();
    }).length;
  
    this.setData({ countWaiting, countToday });
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