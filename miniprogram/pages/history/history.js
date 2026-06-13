// pages/history/history.js
const db = wx.cloud.database()

Page({
  data: {
    list: []
  },

  onShow() {
    this.loadHistory()
  },

  async loadHistory() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await db.collection('parcels')
        .where({ status: 1 })
        .orderBy('takeTime', 'desc')
        .get()
      
      const list = res.data.map(item => {
        let takeTimeFormatted = ''
        if (item.takeTime) {
          const d = new Date(item.takeTime)
          takeTimeFormatted = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
        }
        return { ...item, takeTimeFormatted }
      })
      
      this.setData({ list })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})