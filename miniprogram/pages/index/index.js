// pages/index/index.js
const db = wx.cloud.database()

Page({
  data: {
    list: []
  },

  onShow() {
    console.log('待取列表页 onShow 触发')
    this.loadParcels()
  },

  // 加载待取快递（status=0）
  async loadParcels() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await db.collection('parcels')
        .where({
            status: 0
        })
        .orderBy('createTime', 'desc')
        .get()
      
      console.log('查询结果数量：', res.data.length)

      const list = res.data.map(item => {
        return {
          ...item,
          createTimeFormatted: this.formatTime(item.createTime)
        }
      })
      
      this.setData({ list })
    } catch (err) {
      console.error('加载失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 扫码取件
  scanToTake(e) {
    console.log('dataset:', e.currentTarget.dataset);
    const { id, code: expectedCode } = e.currentTarget.dataset
    
    wx.scanCode({
      success: (res) => {
        if (res.result === expectedCode) {
          this.confirmTake(id, expectedCode)
        } else {
          wx.showToast({ title: '取件码不匹配', icon: 'error' })
        }
      },
      fail: () => {
        wx.showToast({ title: '扫码失败', icon: 'none' })
      }
    })
  },

  // 确认取件
  async confirmTake(id, code) {
    const result = await wx.showModal({
      title: '确认取件',
      content: `确认取走取件码为 ${code} 的快递吗？`,
      confirmColor: '#07c160'
    })
    
    if (!result.confirm) return
    
    wx.showLoading({ title: '处理中...' })
    
    try {
      await db.collection('parcels').doc(id).update({
        data: {
          status: 1,
          takeTime: new Date()
        }
      })
      
      wx.showToast({ title: '取件成功', icon: 'success' })
      this.loadParcels()
    } catch (err) {
      console.error('取件失败', err)
      wx.showToast({ title: '取件失败', icon: 'error' })
    } finally {
      wx.hideLoading()
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
  }
})