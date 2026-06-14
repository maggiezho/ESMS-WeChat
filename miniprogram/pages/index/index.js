// pages/index/index.js
const db = wx.cloud.database()

Page({
  data: {
    phoneNum: '',
    hasSearched: false,
    currentTab: 0,           // 0:待取 1:历史
    waitingList: [],         // 待取列表
    historyList: [],         // 历史列表
    waitingCount: 0,
    historyCount: 0
  },

  onPhoneInput(e) {
    this.setData({ phoneNum: e.detail.value })
  },

  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab)
    this.setData({ currentTab: tab })
  },

  searchParcels() {
    const phone = this.data.phoneNum.trim()
    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!/^\d{11}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    this.loadAllData(phone)
  },

  // 一次性加载待取和历史
  async loadAllData(phone) {
    wx.showLoading({ title: '加载中...' })
    this.setData({ hasSearched: true })

    try {
      // 并行查询两个集合（实际是一个表，不同状态）
      const [waitingRes, historyRes] = await Promise.all([
        db.collection('parcels')
          .where({ status: 0, recipientPhone: phone })
          .orderBy('createTime', 'desc')
          .get(),
        db.collection('parcels')
          .where({ status: 1, recipientPhone: phone })
          .orderBy('takeTime', 'desc')
          .get()
      ])

      const formatTime = (date) => {
        if (!date) return ''
        const d = new Date(date)
        return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
      }

      const waitingList = waitingRes.data.map(item => ({
        ...item,
        createTimeFormatted: formatTime(item.createTime)
      }))

      const historyList = historyRes.data.map(item => ({
        ...item,
        takeTimeFormatted: formatTime(item.takeTime)
      }))

      this.setData({
        waitingList,
        historyList,
        waitingCount: waitingList.length,
        historyCount: historyList.length
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 扫码取件（只在待取 Tab 使用）
  scanToTake(e) {
    const { id, code: expectedCode } = e.currentTarget.dataset
    wx.scanCode({
      success: (res) => {
        const scannedContent = res.result
        const scannedCode = scannedContent.includes(' | ') ? scannedContent.split(' | ')[0] : scannedContent
        if (scannedCode === expectedCode) {
          this.confirmTake(id, expectedCode)
        } else {
          wx.showToast({ title: '取件码不匹配', icon: 'error' })
        }
      }
    })
  },

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
        data: { status: 1, takeTime: new Date() }
      })
      wx.showToast({ title: '取件成功', icon: 'success' })
      // 刷新数据
      if (this.data.phoneNum) {
        this.loadAllData(this.data.phoneNum)
      }
    } catch (err) {
      wx.showToast({ title: '取件失败', icon: 'error' })
    } finally {
      wx.hideLoading()
    }
  },

  // 格式化时间（保持不变）
  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
  }
})