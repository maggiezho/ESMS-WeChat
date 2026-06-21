const db = wx.cloud.database()

Page({
  data: {
    isEdit: false,
    editId: null,
    fromScan: false,
    autoShelfNo: '',           // 自动识别的货架位置
    validationMsg: '',         // 取件码校验提示
    isValid: false,            // 取件码是否有效
    showValidation: false,     // 是否显示取件码校验提示
    
    isPhoneValid: false,       // 手机号是否有效
    showPhoneValidation: false,
    phoneValidated: false,
    
    form: {
      trackingCode: '',
      recipientPhone: '',
      shelfNo: ''              // 自动计算，不显示
    }
  },

  onLoad(options) {
    console.log('接收参数：', options)
    
    // 处理扫码入库
    if (options.fromScan === 'true') {
      this.setData({ fromScan: true })
      
      if (options.trackingCode) {
        const code = decodeURIComponent(options.trackingCode)
        this.setData({ 'form.trackingCode': code })
        this.parseAndValidateTrackingCode(code)
        this.setData({ showValidation: true })
      }
      
      if (options.recipientPhone) {
        const phone = decodeURIComponent(options.recipientPhone)
        this.setData({ 'form.recipientPhone': phone })
        this.validatePhone(phone)
        this.setData({ showPhoneValidation: true })
      }
      
      wx.setNavigationBarTitle({ title: '扫码入库 - 添加快递' })
      wx.showToast({ title: '已自动识别信息', icon: 'success', duration: 2000 })
    }
    
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      this.loadParcel(options.id)
      wx.setNavigationBarTitle({ title: '编辑快递' })
    } else if (!options.fromScan) {
      wx.setNavigationBarTitle({ title: '添加快递' })
    }
  },

  // 解析并校验取件码
  parseAndValidateTrackingCode(trackingCode) {
    if (!trackingCode) {
      this.setData({ autoShelfNo: '', validationMsg: '', isValid: false, 'form.shelfNo': '' })
      return false
    }
    
    const pattern = /^(\d+)-([1-5])-(\d{4})$/
    const match = trackingCode.match(pattern)
    
    if (match) {
      const shelfNo = `${match[1]}-${match[2]}`
      const floor = parseInt(match[2])
      const code = match[3]
      
      if (floor >= 1 && floor <= 5 && code.length === 4) {
        this.setData({ 
          autoShelfNo: shelfNo,
          validationMsg: '✓ 取件码格式正确，货架位置：' + shelfNo,
          isValid: true,
          'form.shelfNo': shelfNo
        })
        return true
      }
    }
    
    // 错误提示
    let errorMsg = '× 取件码格式错误，正确格式：货架号-层数(1-5)-四位码'
    const parts = trackingCode.split('-')
    if (parts.length === 3) {
      const floor = parseInt(parts[1])
      const code = parts[2]
      if (isNaN(floor) || floor < 1 || floor > 5) {
        errorMsg = '× 层数必须是1-5层，当前为：' + parts[1]
      } else if (!/^\d{4}$/.test(code)) {
        errorMsg = '× 四位码必须是4位数字，当前为：' + code
      } else if (!/^\d+$/.test(parts[0])) {
        errorMsg = '× 货架号必须是数字'
      }
    }
    
    this.setData({ 
      autoShelfNo: '', 
      validationMsg: errorMsg,
      isValid: false,
      'form.shelfNo': ''
    })
    return false
  },

  // 校验手机号
  validatePhone(phone) {
    if (!phone) {
      this.setData({ isPhoneValid: false })
      return false
    }
    const isValid = /^\d{11}$/.test(phone)
    this.setData({ isPhoneValid: isValid })
    return isValid
  },

  // 取件码输入事件
  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    
    this.setData({ [`form.${field}`]: value })
    
    if (field === 'trackingCode') {
      if (this.data.showValidation) {
        this.parseAndValidateTrackingCode(value)
      } else if (!value) {
        this.setData({ validationMsg: '', isValid: false, autoShelfNo: '' })
      }
    }
  },

  // 手机号输入事件
  onPhoneInput(e) {
    const value = e.detail.value
    this.setData({ 'form.recipientPhone': value })
    
    if (this.data.showPhoneValidation) {
      this.validatePhone(value)
    } else if (!value) {
      this.setData({ isPhoneValid: false })
    }
  },

  // 取件码失焦校验
  onTrackingCodeBlur(e) {
    const trackingCode = e.detail.value
    this.setData({ showValidation: true })
    
    if (!trackingCode) {
      this.setData({ validationMsg: '✗ 请填写取件码', isValid: false, autoShelfNo: '' })
      return
    }
    this.parseAndValidateTrackingCode(trackingCode)
  },

  // 手机号失焦校验
  onPhoneBlur(e) {
    const phone = e.detail.value
    this.setData({ showPhoneValidation: true, phoneValidated: true })
    if (phone) {
      this.validatePhone(phone)
    } else {
      this.setData({ isPhoneValid: false })
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
      this.parseAndValidateTrackingCode(res.data.trackingCode)
      this.validatePhone(res.data.recipientPhone)
      this.setData({ showValidation: true, showPhoneValidation: true })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async submit() {
    const { trackingCode, recipientPhone } = this.data.form
    
    if (!trackingCode || !recipientPhone) {
      wx.showToast({ title: '请填写取件码和手机号', icon: 'none' })
      return
    }
    
    this.setData({ showValidation: true })
    const isValid = this.parseAndValidateTrackingCode(trackingCode)
    if (!isValid) {
      wx.showToast({ title: this.data.validationMsg || '取件码格式错误', icon: 'none', duration: 3000 })
      return
    }
    
    this.setData({ showPhoneValidation: true })
    const isPhoneValid = this.validatePhone(recipientPhone)
    if (!isPhoneValid) {
      wx.showToast({ title: '手机号必须是11位数字', icon: 'none' })
      return
    }
    
    const autoShelfNo = this.data.autoShelfNo
    if (!autoShelfNo) {
      wx.showToast({ title: '无法识别货架位置，请检查取件码格式', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '检查中...' })
    
    try {
      // 检查重复取件码
      const checkRes = await db.collection('parcels')
        .where({ trackingCode: trackingCode, status: 0 })
        .get()
      
      if (checkRes.data.length > 0 && !this.data.isEdit) {
        wx.hideLoading()
        wx.showModal({
          title: '重复入库提示',
          content: `取件码 ${trackingCode} 已有未取快递！\n货架位置：${checkRes.data[0].shelfNo}\n收件人：${checkRes.data[0].recipientPhone}\n请确认是否重复添加。`,
          confirmText: '仍要添加',
          confirmColor: '#ff9f43',
          success: async (res) => {
            if (res.confirm) {
              await this.saveParcel(autoShelfNo)
            }
          }
        })
        return
      }
      
      await this.saveParcel(autoShelfNo)
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'error' })
      wx.hideLoading()
    }
  },

  async saveParcel(autoShelfNo) {
    const { trackingCode, recipientPhone } = this.data.form
    
    if (this.data.isEdit) {
      await db.collection('parcels').doc(this.data.editId).update({
        data: { trackingCode, recipientPhone, shelfNo: autoShelfNo }
      })
      wx.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await db.collection('parcels').add({
        data: {
          trackingCode,
          recipientPhone,
          shelfNo: autoShelfNo,
          status: 0,
          createTime: new Date()
        }
      })
      wx.showToast({ title: '添加成功', icon: 'success' })
    }
    
    wx.hideLoading()
    setTimeout(() => { wx.navigateBack() }, 1500)
  }
})