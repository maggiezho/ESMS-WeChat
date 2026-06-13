// pages/add/add.js
const db = wx.cloud.database()

Page({
  data: {
    isEdit: false,
    editId: null,
    form: {
      trackingCode: '',
      recipientPhone: '',
      shelfNo: ''
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      this.loadParcel(options.id)
      wx.setNavigationBarTitle({ title: '编辑快递' })
    } else {
      wx.setNavigationBarTitle({ title: '添加快递' })
    }
  },

  async loadParcel(id) {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await db.collection('parcels').doc(id).get()
      this.setData({
        form: {
          trackingCode: res.data.trackingCode,
          recipientPhone: res.data.recipientPhone,
          shelfNo: res.data.shelfNo
        }
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },
  async submit() {
    const { trackingCode, recipientPhone, shelfNo } = this.data.form
    
    // 1. 基础校验
    if (!trackingCode || !recipientPhone || !shelfNo) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '检查中...' })
    
    try {
      // 2. 检查逻辑：查询是否有相同货架、相同取件码且状态为“未取”的记录
      const checkRes = await db.collection('parcels')
        .where({
          shelfNo: shelfNo,
          trackingCode: trackingCode,
          status: 0
        })
        .get()
      
      // 如果查询结果长度大于0，说明已经存在重复
      if (checkRes.data.length > 0) {
        wx.hideLoading()
        wx.showModal({
          title: '温馨提示',
          content: '该货架已有相同取件码的未取快递，请检查！',
          showCancel: false
        })
        return
      }

      // 3. 原有的添加/更新逻辑
      if (this.data.isEdit) {
        // ... (保持原有的更新逻辑不变)
      } else {
        await db.collection('parcels').add({
          data: {
            trackingCode,
            recipientPhone,
            shelfNo,
            status: 0,
            createTime: new Date()
          }
        })
        wx.showToast({ title: '添加成功', icon: 'success' })
      }
      
      setTimeout(() => { wx.navigateBack() }, 1500)
      
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'error' })
    } finally {
      wx.hideLoading()
    }
  }
})