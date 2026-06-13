// pages/admin/admin.js
const db = wx.cloud.database()

Page({
  data: {
    list: [],
    currentTab: 0
  },

  onShow() {
    this.loadData()
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