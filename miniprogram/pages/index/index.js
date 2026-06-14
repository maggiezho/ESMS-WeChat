// pages/index/index.js
const db = wx.cloud.database()

Page({
  data: {
    phoneNum: '',        // 输入的手机号
    list: [],            // 快递列表
    hasSearched: false   // 是否查询过（用于区分首次加载空状态）
  },

  onShow() {
    // 可选：页面每次显示时清空搜索（看需求）
    // 这里注释掉，保留上次搜索结果
    // this.setData({ phoneNum: '', list: [], hasSearched: false })
  },

  // 监听手机号输入
  onPhoneInput(e) {
    this.setData({
      phoneNum: e.detail.value
    })
  },

  // 查询按钮点击
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
    this.loadParcels(phone)
  },

  // 根据手机号加载待取快递（status=0）
  async loadParcels(phone) {
    wx.showLoading({ title: '加载中...' })
    this.setData({ hasSearched: true })

    try {
      const res = await db.collection('parcels')
        .where({
          status: 0,
          recipientPhone: phone   // 关键：按手机号筛选
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

  // 扫码取件（保持不变）
  // 扫码取件
  scanToTake(e) {
    const { id, code: expectedCode } = e.currentTarget.dataset
    wx.scanCode({
      success: (res) => {
        const scannedContent = res.result
        const scannedCode = scannedContent.includes(' | ') ? scannedContent.split(' | ')[0] : scannedContent;

        if (scannedCode === expectedCode) {
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
      // 取件成功后重新查询当前手机号的待取件
      if (this.data.phoneNum) {
        this.loadParcels(this.data.phoneNum)
      } else {
        this.setData({ list: [] })
      }
    } catch (err) {
      console.error('取件失败', err)
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