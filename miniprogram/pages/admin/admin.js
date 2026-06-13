// pages/admin/admin.js
const db = wx.cloud.database()

Page({
  data: {
    list: [],
    currentTab: 0,
    isAuthorized: false // 增加一个状态标识
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
      
      this.setData({ list })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
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